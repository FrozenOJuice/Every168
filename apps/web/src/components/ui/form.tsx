"use client";
import { useId, useRef, useState } from "react";
import { ApiError, uncertainWrite } from "@168hours/api-client";
import {
  FormProvider,
  useForm,
  useFormContext,
  useWatch,
  type Path,
  type DefaultValues,
  type FieldValues,
  type Resolver,
  type UseFormReturn,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
export function useZodForm<T extends FieldValues>(
  schema: z.ZodType<T>,
  defaults: NoInfer<DefaultValues<T>>,
) {
  const values =
    schema instanceof z.ZodObject
      ? (Object.fromEntries(
          Object.entries(defaults).filter(([key]) => key in schema.shape),
        ) as DefaultValues<T>)
      : defaults;
  return useForm<T>({
    resolver: zodResolver(schema as z.ZodType<T, T>) as Resolver<T>,
    defaultValues: values,
  });
}
export function Form<T extends FieldValues>({
  form,
  onSubmit,
  children,
  retrySafe = true,
}: {
  form: UseFormReturn<T>;
  retrySafe?: boolean;
  onSubmit: (values: T, requestKey: string) => Promise<void>;
  children: React.ReactNode;
}) {
  const [pending, setPending] = useState<{ values: T; key: string } | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [stale, setStale] = useState(false);
  const running = useRef(false);
  async function save(values: T) {
    if (running.current) return;
    running.current = true;
    setSaving(true);
    const attempt = pending ?? {
      values: structuredClone(values),
      key: crypto.randomUUID(),
    };
    form.clearErrors("root");
    setStale(false);
    try {
      await onSubmit(attempt.values, attempt.key);
      setPending(null);
    } catch (error) {
      setPending(retrySafe && uncertainWrite(error) ? attempt : null);
      setStale(error instanceof ApiError && error.code === "STALE_REVISION");
      if (error instanceof z.ZodError) {
        for (const issue of error.issues)
          if (issue.path.length)
            form.setError(issue.path.join(".") as Path<T>, {
              message: issue.message,
            });
      }
      form.setError("root", {
        message:
          error instanceof z.ZodError
            ? error.issues.map((issue) => issue.message).join(" ")
            : error instanceof Error
              ? error.message
              : "Unable to save. Please try again.",
      });
    } finally {
      running.current = false;
      setSaving(false);
    }
  }
  return (
    <FormProvider {...form}>
      <form
        noValidate
        onSubmit={(event) => void form.handleSubmit(save)(event)}
        className="form-stack"
      >
        <fieldset className="form-stack" disabled={!!pending || saving}>
          {children}
        </fieldset>
        {form.formState.errors.root && (
          <p role="alert" className="error">
            {form.formState.errors.root.message}
          </p>
        )}
        {pending && (
          <div role="status">
            <p>
              The save could not be confirmed. Retry this same change before
              making another.
            </p>
            <button
              className="button primary"
              type="button"
              onClick={() => void save(pending.values)}
              disabled={saving}
            >
              Retry save
            </button>
          </div>
        )}
        {stale && (
          <button
            className="button"
            type="button"
            onClick={() => window.location.reload()}
          >
            Reload latest (discard edits)
          </button>
        )}
      </form>
    </FormProvider>
  );
}
export function Field({
  name,
  label,
  type = "text",
  children,
  optional = false,
  step,
  min,
  max,
  help,
  autoComplete,
  required = false,
  onChange,
}: {
  name: string;
  label: string;
  type?: string;
  children?: React.ReactNode;
  optional?: boolean;
  step?: number | string;
  min?: number | string;
  max?: number | string;
  help?: string;
  autoComplete?: string;
  required?: boolean;
  onChange?: (value: string) => void;
}) {
  const id = useId();
  const { register, getFieldState, formState, control } = useFormContext();
  const selected = useWatch({ control, name });
  const error = getFieldState(name, formState).error;
  const numeric = type === "number";
  const registration = register(name, {
    setValueAs: numeric
      ? (v: unknown) =>
          v === "" || v === null || v === undefined
            ? optional
              ? null
              : NaN
            : Number(v)
      : optional
        ? (v: string) => (v === "" ? null : v)
        : undefined,
  });
  const props = {
    id,
    ...registration,
    onChange: (
      event: React.ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => {
      void registration.onChange(event);
      onChange?.(event.target.value);
    },
    "aria-invalid": !!error,
    "aria-describedby": error ? id + "-error" : help ? id + "-help" : undefined,
    required,
  };
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children ? (
        <select
          {...props}
          value={
            typeof selected === "string" || typeof selected === "number"
              ? selected
              : ""
          }
        >
          {children}
        </select>
      ) : type === "textarea" ? (
        <textarea {...props} rows={3} />
      ) : (
        <input
          {...props}
          type={type}
          step={step}
          min={min}
          max={max}
          autoComplete={autoComplete}
        />
      )}
      {help && <small id={id + "-help"}>{help}</small>}
      {error && (
        <small id={id + "-error"} className="error" role="alert">
          {error.message}
        </small>
      )}
    </div>
  );
}
export function Submit({ children = "Save" }: { children?: React.ReactNode }) {
  const {
    formState: { isSubmitting },
  } = useFormContext();
  return (
    <button className="button primary" type="submit" disabled={isSubmitting}>
      {isSubmitting ? "Saving…" : children}
    </button>
  );
}
