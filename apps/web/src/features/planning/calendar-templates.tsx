import { z } from "zod";
import { useState } from "react";
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
import { invalidateCalendar } from "./invalidate-calendar";
type Template = Omit<CalendarTemplate, "entries">;
type Review =
  | { preview: CopyPreview; input: CopyInput; token: string }
  | {
      preview: CopyPreview;
      template: Template;
      version: number;
      preferencesVersion: number;
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
  const [tab, setTab] = useState<"copy" | "templates">("copy"),
    [review, setReview] = useState<Review | null>(null);
  const cache = useQueryClient();
  const apply = useCommand({
    mutationFn: (v: Review, key: string) =>
      "template" in v
        ? api.applyCalendarTemplate(
            v.template.id,
            v.preview.targetDate,
            v.version,
            v.preferencesVersion,
            key,
          )
        : api.copyCalendar({ ...v.input, token: v.token }, key),
    onSuccess: async (result) => {
      await invalidateCalendar(cache);
      onSaved(`${result.count} plans added.`, result.targetDate);
    },
  });
  return (
    <Dialog title="Copy and templates" onClose={onClose}>
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
          <div className="tabs" role="group" aria-label="Copy options">
            <button
              aria-pressed={tab === "copy"}
              onClick={() => setTab("copy")}
            >
              Copy a day or week
            </button>
            <button
              aria-pressed={tab === "templates"}
              onClick={() => setTab("templates")}
            >
              Templates
            </button>
          </div>
          <p className="muted text-small">
            Use up to 100 plans whose start date falls in the selected period.
            Weeks follow your account’s first day. Overnight plans are copied in
            full.
          </p>
          {tab === "copy" ? (
            <CopyForm date={date} onReview={setReview} />
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
  onReview,
}: {
  date: string;
  onReview: (review: Review) => void;
}) {
  const form = useZodForm(copyInput, {
    sourceDate: date,
    targetDate: addDays(date, 7),
    span: "week",
  });
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
        <option value="day">Day</option>
        <option value="week">Week</option>
      </Field>
      <Field name="sourceDate" label="Copy from" type="date" />
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
                <small>{t.span === "week" ? "Weekly" : "Daily"} routine</small>
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
  const form = useZodForm(z.object({ targetDate: dateSchema }), {
    targetDate: date,
  });
  return (
    <Form
      form={form}
      retrySafe={false}
      onSubmit={async (v) => {
        const preview = await api.previewCalendarTemplate(
          template.id,
          v.targetDate,
        );
        onReview({
          preview,
          template,
          version: preview.version,
          preferencesVersion: preview.preferencesVersion,
        });
      }}
    >
      <Field name="targetDate" label="Apply to date" type="date" />
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
    });
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
      </Field>
      <Field name="sourceDate" label="Source date" type="date" />
      <Submit>Save template</Submit>
    </Form>
  );
}
