import {
  useTextPrompt,
  useConfirm,
} from "@/components/ui/confirmation-provider";
import { z } from "zod";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useWatch } from "react-hook-form";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import {
  dateSchema,
  templateCaptureInput,
  type CalendarTemplate,
  type CopyPreview,
} from "@168hours/contracts";
import { api } from "@/lib/api";
import { useCommand, CommandError } from "@/lib/use-command";
import { Dialog } from "@/components/ui/dialog";
import {
  Form,
  Field,
  Submit,
  useZodForm,
  FormBusyContext,
} from "@/components/ui/form";
import { ErrorState, Loading } from "@/components/ui/feedback";
import { useMe } from "@/features/identity/me";
import { CalendarDateField, CalendarChoiceField } from "./calendar-form-fields";
import { CalendarEditorActions } from "./calendar-editor-actions";
import { CalendarCopyPreview } from "./calendar-copy-preview";
import { useCalendarInteractions } from "./calendar-interactions";
import { invalidateCalendar } from "./invalidate-calendar";
type Template = Omit<CalendarTemplate, "entries">;
type Review = {
  preview: CopyPreview;
  template: Template;
  version: number;
  preferencesVersion: number;
  cycles: number;
};
const templateSpan = (template: Template) =>
  `${template.span === "range" ? template.rangeDays : template.span === "week" ? 7 : 1}-day template`;

export function CalendarTemplates({
  date,
  onClose,
  onSaved,
}: {
  date: string;
  onClose: () => void;
  onSaved: (message: string, date?: string) => void;
}) {
  const [review, setReview] = useState<Review | null>(null);
  const [selected, setSelected] = useState<Template | null>(null);
  const [capture, setCapture] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement | null>(null);
  const stage = review
    ? "review"
    : capture
      ? "capture"
      : selected
        ? "apply"
        : "library";
  useLayoutEffect(() => {
    const selector =
      stage === "review"
        ? ".calendar-template-body h3"
        : stage === "capture"
          ? 'input[name="name"]'
          : stage === "apply"
            ? ".calendar-template-stage button"
            : ".calendar-template-body button";
    dialog.current
      ?.querySelector<HTMLElement>(selector)
      ?.focus({ preventScroll: true });
  }, [stage]);
  const cache = useQueryClient();
  const interaction = useCalendarInteractions();
  const apply = useCommand({
    mutationFn: async (v: Review, key: string) => ({
      key,
      result: await api.applyCalendarTemplate(
        v.template.id,
        v.preview.targetDate,
        v.cycles,
        v.version,
        v.preferencesVersion,
        key,
      ),
    }),
    onSuccess: async ({ key, result }) => {
      interaction?.history.record({
        kind: "copy",
        key,
        blocks: result.createdBlocks.map(({ id, version }) => ({
          id,
          version,
        })),
        items: result.createdItems,
      });
      interaction?.showNotice("Template applied", {
        undoKey: key,
        kind: "change",
      });
      await invalidateCalendar(cache);
      onSaved(`${result.count} plans added.`, result.targetDate);
    },
  });
  const busy = formBusy || apply.isPending;
  return (
    <Dialog
      title={
        review
          ? "Review template"
          : capture
            ? "Save template"
            : selected
              ? "Use template"
              : "Templates"
      }
      dialogRef={(element) => {
        dialog.current = element;
      }}
      className="calendar-template-dialog"
      busy={busy}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <FormBusyContext.Provider value={setFormBusy}>
        {capture ? (
          <CaptureForm
            date={date}
            onCancel={() => setCapture(false)}
            onSaved={() => setCapture(false)}
          />
        ) : (
          <>
            {selected ? (
              <div className="calendar-template-stage" hidden={!!review}>
                <div className="calendar-template-context">
                  <h3>{selected.name}</h3>
                  <small>{templateSpan(selected)}</small>
                </div>
                <ApplyForm
                  template={selected}
                  date={date}
                  onCancel={() => setSelected(null)}
                  onReview={setReview}
                />
              </div>
            ) : (
              <TemplateLibrary
                onSelect={setSelected}
                onCapture={() => setCapture(true)}
                onClose={onClose}
                onBusy={setFormBusy}
              />
            )}
            {review && (
              <>
                <div
                  className="calendar-template-body"
                  role="region"
                  aria-label="Plans to add"
                  tabIndex={0}
                >
                  <h3 tabIndex={-1}>{review.template.name}</h3>
                  <CalendarCopyPreview preview={review.preview} />
                  <CommandError command={apply} />
                </div>
                <div className="form-footer">
                  <button
                    type="button"
                    className="button"
                    disabled={busy}
                    onClick={() => setReview(null)}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="button primary"
                    disabled={
                      busy ||
                      review.preview.blocks.length +
                        review.preview.items.length ===
                        0
                    }
                    onClick={() => apply.mutate(review)}
                  >
                    Apply template
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </FormBusyContext.Provider>
    </Dialog>
  );
}
function TemplateLibrary({
  onSelect,
  onCapture,
  onClose,
  onBusy,
}: {
  onSelect: (template: Template) => void;
  onCapture: () => void;
  onClose: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const prompt = useTextPrompt(),
    confirm = useConfirm(),
    cache = useQueryClient();
  const q = useInfiniteQuery({
    queryKey: ["calendar-templates"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.getCalendarTemplates({ cursor: pageParam }),
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const remove = useCommand({
    mutationFn: (t: Template, key: string) =>
      api.deleteCalendarTemplate(t.id, t.version, key),
    onSuccess: () =>
      cache.invalidateQueries({ queryKey: ["calendar-templates"] }),
  });
  const rename = useCommand({
    mutationFn: (v: { template: Template; name: string }, key: string) =>
      api.renameCalendarTemplate(
        v.template.id,
        v.name,
        v.template.version,
        key,
      ),
    onSuccess: () =>
      cache.invalidateQueries({ queryKey: ["calendar-templates"] }),
  });
  const busy = remove.isPending || rename.isPending;
  useEffect(() => {
    onBusy(busy);
    return () => onBusy(false);
  }, [busy, onBusy]);
  const items = q.data?.pages.flatMap((page) => page.items) ?? [];
  return (
    <>
      <div className="calendar-template-body">
        <p className="muted text-small">
          Reuse a day, week or repeating pattern of plans.
        </p>
        <button
          type="button"
          className="button primary"
          disabled={busy}
          onClick={onCapture}
        >
          Save calendar as template
        </button>
        {q.isPending && <Loading />}
        {q.error && (
          <ErrorState error={q.error} retry={() => void q.refetch()} />
        )}
        <ul className="calendar-template-list">
          {items.map((template) => (
            <li key={template.id}>
              <div className="row between">
                <div>
                  <strong>{template.name}</strong>
                  <small>{templateSpan(template)}</small>
                </div>
                <CalendarEditorActions
                  label={`Template actions for ${template.name}`}
                  disabled={busy}
                  actions={[
                    {
                      label: "Rename",
                      run: () => {
                        void (async () => {
                          const name = (
                            await prompt("Template name", template.name)
                          )?.trim();
                          if (name) rename.mutate({ template, name });
                        })();
                      },
                    },
                    {
                      label: "Delete",
                      destructive: true,
                      run: () => {
                        void (async () => {
                          if (
                            await confirm(
                              "Delete this template? Applied plans will remain.",
                            )
                          )
                            remove.mutate(template);
                        })();
                      },
                    },
                  ]}
                />
              </div>
              <button
                type="button"
                className="button"
                disabled={busy}
                onClick={() => onSelect(template)}
              >
                Use template
              </button>
            </li>
          ))}
        </ul>
        {!q.isPending && !q.error && !items.length && (
          <p className="empty">
            No saved templates. Save a calendar pattern to reuse it later.
          </p>
        )}
        {q.hasNextPage && (
          <button
            type="button"
            className="button"
            disabled={busy || q.isFetchingNextPage}
            onClick={() => void q.fetchNextPage()}
          >
            Load more
          </button>
        )}
        <CommandError command={remove} />
        <CommandError command={rename} />
      </div>
      <div className="form-footer">
        <button
          type="button"
          className="button"
          disabled={busy}
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </>
  );
}
function ApplyForm({
  template,
  date,
  onCancel,
  onReview,
}: {
  template: Template;
  date: string;
  onCancel: () => void;
  onReview: (review: Review) => void;
}) {
  const { preferences } = useMe();
  const form = useZodForm(
    z.object({
      targetDate: dateSchema,
      cycles: z.coerce.number().int().min(1).max(52),
    }),
    { targetDate: date, cycles: 1 },
  );
  return (
    <Form
      form={form}
      retrySafe={false}
      footer={
        <>
          <button type="button" className="button" onClick={onCancel}>
            Back to templates
          </button>
          <Submit>Preview template</Submit>
        </>
      }
      onSubmit={async (v) => {
        const preview = await api.previewCalendarTemplate(
          template.id,
          v.targetDate,
          v.cycles,
        );
        onReview({
          preview,
          template,
          version: preview.version,
          preferencesVersion: preview.preferencesVersion,
          cycles: v.cycles,
        });
      }}
    >
      <CalendarDateField
        name="targetDate"
        label="Apply to date"
        timezone={preferences.timezone}
      />
      <Field
        name="cycles"
        label="Cycles"
        type="number"
        min={1}
        max={52}
        help={`Each cycle repeats the ${templateSpan(template).replace(" template", "")} pattern.`}
      />
    </Form>
  );
}
function CaptureForm({
  date,
  onSaved,
  onCancel,
}: {
  date: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { preferences } = useMe();
  const cache = useQueryClient();
  const form = useZodForm(templateCaptureInput, {
    name: "",
    sourceDate: date,
    span: "week",
    sourceEndDate: undefined,
  });
  const [span, sourceDate] = useWatch({
    control: form.control,
    name: ["span", "sourceDate"],
  });
  return (
    <Form
      form={form}
      footer={
        <>
          <button type="button" className="button" onClick={onCancel}>
            Cancel
          </button>
          <Submit>Save template</Submit>
        </>
      }
      onSubmit={async (v, key) => {
        await api.captureCalendarTemplate(v, key);
        await cache.invalidateQueries({ queryKey: ["calendar-templates"] });
        onSaved();
      }}
    >
      <Field name="name" label="Template name" />
      <CalendarChoiceField
        name="span"
        label="Save"
        options={[
          { value: "day", label: "Day" },
          { value: "week", label: "Week" },
          { value: "range", label: "Date range" },
        ]}
        onChange={(value) => {
          if (value === "range" && !form.getValues("sourceEndDate"))
            form.setValue("sourceEndDate", sourceDate);
        }}
      />
      <CalendarDateField
        name="sourceDate"
        label="Source date"
        timezone={preferences.timezone}
      />
      {span === "range" && (
        <CalendarDateField
          name="sourceEndDate"
          label="Through"
          timezone={preferences.timezone}
          fallbackDate={sourceDate}
        />
      )}
    </Form>
  );
}
