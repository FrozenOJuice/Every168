import { z } from "zod";
import { useState } from "react";
import { useWatch } from "react-hook-form";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import {
  copyInput,
  dateSchema,
  templateCaptureInput,
  type CalendarTemplate,
  type CopyInput,
  type CopyPreview,
} from "@168hours/contracts";
import { addDays } from "@168hours/domain-utils";
import { api } from "@/lib/api";
import { useCommand, CommandError } from "@/lib/use-command";
import { Dialog } from "@/components/ui/dialog";
import { Form, Field, Submit, useZodForm } from "@/components/ui/form";
import { ErrorState, Loading } from "@/components/ui/feedback";
import { CalendarCopyPreview } from "./calendar-copy-preview";
import { useCalendarInteractions } from "./calendar-interactions";
import { invalidateCalendar } from "./invalidate-calendar";
type Template = Omit<CalendarTemplate, "entries">;
type Review =
  | { preview: CopyPreview; input: CopyInput; token: string }
  | {
      preview: CopyPreview;
      template: Template;
      version: number;
      preferencesVersion: number;
      cycles: number;
    };
export function CalendarTemplates({
  mode,
  sourceId,
  sourceKind = "block",
  date,
  onClose,
  onSaved,
}: {
  mode: "copy" | "templates";
  sourceId?: string;
  sourceKind?: "block" | "item";
  date: string;
  onClose: () => void;
  onSaved: (message: string, date?: string) => void;
}) {
  const [review, setReview] = useState<Review | null>(null);
  const cache = useQueryClient();
  const interaction = useCalendarInteractions();
  const apply = useCommand({
    mutationFn: async (v: Review, key: string) => {
      if ("template" in v)
        return {
          kind: "template" as const,
          result: await api.applyCalendarTemplate(
            v.template.id,
            v.preview.targetDate,
            v.cycles,
            v.version,
            v.preferencesVersion,
            key,
          ),
        };
      return {
        kind: "copy" as const,
        key,
        result: await api.copyCalendar({ ...v.input, token: v.token }, key),
      };
    },
    onSuccess: async (outcome) => {
      if (outcome.kind === "copy")
        interaction?.history.record({
          kind: "copy",
          key: outcome.key,
          blocks: outcome.result.createdBlocks.map(({ id, version }) => ({
            id,
            version,
          })),
          items: outcome.result.createdItems,
        });
      await invalidateCalendar(cache);
      onSaved(
        `${outcome.result.count} plans added.`,
        outcome.result.targetDate,
      );
    },
  });
  return (
    <Dialog
      title={mode === "copy" ? "Copy plans" : "Templates"}
      onClose={onClose}
    >
      {review ? (
        <>
          <CalendarCopyPreview preview={review.preview} />
          <div className="editor-actions">
            <button
              className="button"
              disabled={apply.isPending}
              onClick={() => setReview(null)}
            >
              Back
            </button>
            <button
              className="button primary"
              disabled={
                apply.isPending ||
                review.preview.blocks.length + review.preview.items.length === 0
              }
              onClick={() => apply.mutate(review)}
            >
              Add these plans
            </button>
          </div>
          <CommandError command={apply} />
        </>
      ) : (
        <>
          <p className="muted text-small">
            {mode === "copy"
              ? "Copy up to 100 plans once. Weeks follow your account’s first day; overnight plans stay whole."
              : "Save a pattern of up to 31 days, then place it once or in cycles."}
          </p>
          {mode === "copy" ? (
            <CopyForm
              date={date}
              sourceId={sourceId}
              sourceKind={sourceKind}
              onReview={setReview}
            />
          ) : (
            <TemplateLibrary date={date} onReview={setReview} />
          )}
        </>
      )}
    </Dialog>
  );
}
function CopyForm({
  date,
  sourceId,
  sourceKind,
  onReview,
}: {
  date: string;
  sourceId?: string;
  sourceKind: "block" | "item";
  onReview: (review: Review) => void;
}) {
  const form = useZodForm(copyInput, {
    sourceDate: date,
    targetDate: addDays(date, 7),
    span: sourceId ? "single" : "week",
    sourceId,
    sourceKind: sourceId ? sourceKind : undefined,
    sourceEndDate: undefined,
  });
  const span = useWatch({ control: form.control, name: "span" });
  return (
    <Form
      form={form}
      retrySafe={false}
      onSubmit={async (input) => {
        const preview = await api.previewCalendarCopy(input);
        onReview({ preview, input, token: preview.token });
      }}
    >
      <Field name="span" label="Copy">
        <option value="single" disabled={!sourceId}>
          Selected plan
        </option>
        <option value="day">Day</option>
        <option value="week">Week</option>
        <option value="range">Date range</option>
      </Field>
      {span !== "single" && (
        <Field name="sourceDate" label="Copy from" type="date" />
      )}
      {span === "range" && (
        <Field name="sourceEndDate" label="Through" type="date" required />
      )}
      <Field name="targetDate" label="Copy to" type="date" />
      <Submit>Preview copy</Submit>
    </Form>
  );
}
function TemplateLibrary({
  date,
  onReview,
}: {
  date: string;
  onReview: (review: Review) => void;
}) {
  const cache = useQueryClient();
  const [selected, setSelected] = useState<Template | null>(null),
    [capture, setCapture] = useState(false);
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
  if (selected)
    return (
      <>
        <button className="button" onClick={() => setSelected(null)}>
          Back to templates
        </button>
        <h3>{selected.name}</h3>
        <ApplyForm template={selected} date={date} onReview={onReview} />
      </>
    );
  if (capture)
    return (
      <>
        <button className="button" onClick={() => setCapture(false)}>
          Back to templates
        </button>
        <CaptureForm date={date} onSaved={() => setCapture(false)} />
      </>
    );
  return (
    <div className="stack">
      <button className="button primary" onClick={() => setCapture(true)}>
        Save calendar as template
      </button>
      {q.isPending && <Loading />}
      {q.error && <ErrorState error={q.error} retry={() => void q.refetch()} />}
      <ul className="record-list">
        {q.data?.pages
          .flatMap((p) => p.items)
          .map((t) => (
            <li key={t.id}>
              <div>
                <strong>{t.name}</strong>
                <small>
                  {t.span === "range"
                    ? `${t.rangeDays}-day`
                    : t.span === "week"
                      ? "7-day"
                      : "1-day"}{" "}
                  template
                </small>
              </div>
              <div className="row wrap">
                <button className="button" onClick={() => setSelected(t)}>
                  Use template
                </button>
                <button
                  className="button"
                  disabled={rename.isPending}
                  onClick={() => {
                    const name = prompt("Template name", t.name)?.trim();
                    if (name) rename.mutate({ template: t, name });
                  }}
                >
                  Rename
                </button>
                <button
                  className="button danger"
                  disabled={remove.isPending}
                  onClick={() => {
                    if (
                      confirm(
                        "Delete this template? Applied plans will remain.",
                      )
                    )
                      remove.mutate(t);
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
      </ul>
      {!q.isPending && !q.error && !q.data?.pages[0]?.items.length && (
        <p>No saved templates.</p>
      )}
      {q.hasNextPage && (
        <button
          className="button"
          disabled={q.isFetchingNextPage}
          onClick={() => void q.fetchNextPage()}
        >
          Load more
        </button>
      )}
      <CommandError command={remove} />
      <CommandError command={rename} />
    </div>
  );
}
function ApplyForm({
  template,
  date,
  onReview,
}: {
  template: Template;
  date: string;
  onReview: (review: Review) => void;
}) {
  const form = useZodForm(
    z.object({
      targetDate: dateSchema,
      cycles: z.coerce.number().int().min(1).max(52),
    }),
    {
      targetDate: date,
      cycles: 1,
    },
  );
  return (
    <Form
      form={form}
      retrySafe={false}
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
      <Field name="targetDate" label="Apply to date" type="date" />
      <Field name="cycles" label="Cycles" type="number" min={1} max={52} />
      <Submit>Preview template</Submit>
    </Form>
  );
}
function CaptureForm({ date, onSaved }: { date: string; onSaved: () => void }) {
  const cache = useQueryClient(),
    form = useZodForm(templateCaptureInput, {
      name: "",
      sourceDate: date,
      span: "week",
      sourceEndDate: undefined,
    });
  const span = useWatch({ control: form.control, name: "span" });
  return (
    <Form
      form={form}
      onSubmit={async (v, key) => {
        await api.captureCalendarTemplate(v, key);
        await cache.invalidateQueries({ queryKey: ["calendar-templates"] });
        onSaved();
      }}
    >
      <Field name="name" label="Template name" />
      <Field name="span" label="Save">
        <option value="day">Day</option>
        <option value="week">Week</option>
        <option value="range">Date range</option>
      </Field>
      <Field name="sourceDate" label="Source date" type="date" />
      {span === "range" && (
        <Field name="sourceEndDate" label="Through" type="date" required />
      )}
      <Submit>Save template</Submit>
    </Form>
  );
}
