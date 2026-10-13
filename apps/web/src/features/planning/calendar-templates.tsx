import { z } from "zod";
import { useState } from "react";
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
import { Form, Field, Submit, useZodForm } from "@/components/ui/form";
import { ErrorState, Loading } from "@/components/ui/feedback";
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
    onSuccess: async (outcome) => {
      interaction?.history.record({
        kind: "copy",
        transient: true,
        key: outcome.key,
        blocks: outcome.result.createdBlocks.map(({ id, version }) => ({
          id,
          version,
        })),
        items: outcome.result.createdItems,
      });
      interaction?.showNotice("Template applied", {
        undoKey: outcome.key,
        kind: "change",
      });
      await invalidateCalendar(cache);
      onSaved(
        `${outcome.result.count} plans added.`,
        outcome.result.targetDate,
      );
    },
  });
  return (
    <Dialog title="Templates" onClose={onClose}>
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
            Save a pattern of up to 31 days, then place it once or in cycles.
          </p>
          <TemplateLibrary date={date} onReview={setReview} />
        </>
      )}
    </Dialog>
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
