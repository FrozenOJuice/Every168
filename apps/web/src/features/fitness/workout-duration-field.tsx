"use client";
import { fromSeconds, toSeconds } from "@168hours/domain-utils";
import { useMe } from "@/features/identity/me";
import { useId, useState } from "react";
import { WorkoutNumericInput } from "./workout-numeric-input";
const split = (value: number | null) => ({
  value,
  minutes:
    value !== null && Math.abs(value) >= 60
      ? String(Math.trunc(value / 60))
      : "",
  seconds:
    value === null || (value !== 0 && value % 60 === 0)
      ? ""
      : String(value % 60),
});
export function WorkoutDurationField({
  label,
  value,
  onChange,
  disabled,
  error,
  hideLabel,
  placeholder,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  disabled: boolean;
  error?: string;
  hideLabel?: boolean;
  placeholder?: string;
}) {
  const id = useId();
  const unit = useMe().preferences.durationUnit;
  const name = label.replace(" (seconds)", "");
  const [draft, setDraft] = useState(() => split(value));
  if (draft.value !== value) setDraft(split(value));
  const change = (part: "minutes" | "seconds", text: string) => {
    const next = { ...draft, [part]: text };
    const total =
      next.minutes === "" && next.seconds === ""
        ? null
        : Number(next.minutes) * 60 + Number(next.seconds);
    setDraft({ ...next, value: total });
    onChange(total);
  };
  if (unit !== "min_sec") {
    const unitName =
      unit === "s" ? "seconds" : unit === "min" ? "minutes" : "hours";
    return (
      <div className="field">
        <label htmlFor={id} className={hideLabel ? "sr-only" : undefined}>
          {name.replace(/^Target |^Actual /, "").replace(/^d/, "D")} ({unit})
        </label>
        <WorkoutNumericInput
          id={id}
          controlLabel={`${name} ${unitName}`}
          aria-label={`${name} (${unitName})`}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          value={
            value === null ? "" : Number(fromSeconds(value, unit).toFixed(9))
          }
          disabled={disabled}
          min={0}
          step={unit === "s" ? 1 : "any"}
          inputMode="decimal"
          placeholder={placeholder ?? "—"}
          onFocus={(event) => event.currentTarget.select()}
          onValueChange={(text) =>
            onChange(text === "" ? null : toSeconds(Number(text), unit))
          }
        />
        {error && (
          <p
            id={`${id}-error`}
            className="error fitness-field-error"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    );
  }
  return (
    <div
      className="field fitness-duration-target"
      role="group"
      aria-label={name}
    >
      <label
        htmlFor={`${id}-minutes`}
        className={hideLabel ? "sr-only" : undefined}
      >
        {name.replace(/^Target |^Actual /, "").replace(/^d/, "D")}
      </label>
      <div className="fitness-duration-target-inputs">
        {(["minutes", "seconds"] as const).map((part) => (
          <label key={part}>
            <WorkoutNumericInput
              id={`${id}-${part}`}
              controlLabel={`${name} ${part}`}
              aria-label={`${name} (${part})`}
              aria-invalid={!!error}
              aria-describedby={error ? `${id}-error` : undefined}
              min={0}
              step={1}
              inputMode="numeric"
              disabled={disabled}
              value={draft[part]}
              placeholder={placeholder ?? "—"}
              onFocus={(event) => event.currentTarget.select()}
              onValueChange={(text) => change(part, text)}
              onBlur={() => setDraft(split(value))}
            />
            <span>{part === "minutes" ? "min" : "sec"}</span>
          </label>
        ))}
      </div>
      {error && (
        <p
          id={`${id}-error`}
          className="error fitness-field-error"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
