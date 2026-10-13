import { z } from "zod";
import { useWatch } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  seriesInput,
  type CalendarSeries,
  type Block,
  type CalendarItem,
} from "@168hours/contracts";
import {
  addDays,
  daysBetween,
  expandPlannedSeries,
  weekday,
  localDate,
  instantToLocalInput,
} from "@168hours/domain-utils";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { useCommand, CommandError } from "@/lib/use-command";
import { CalendarPlanPopover } from "./calendar-plan-popover";
import { useState, useEffect, useRef } from "react";
import { Field, Form, Submit, useZodForm } from "@/components/ui/form";
import { ErrorState, Loading } from "@/components/ui/feedback";
import { invalidateCalendar } from "./invalidate-calendar";
import { formatDate } from "@/lib/format";
import { useCalendarInteractions } from "./calendar-interactions";
import { repeatSummary } from "./calendar-repeating";

export function CalendarSeriesEditor({
  id,
  date,
  source,
  occurrenceDate,
  onClose,
  onSaved,
}: {
  id?: string;
  date: string;
  source?: Block | CalendarItem;
  occurrenceDate?: string;
  onClose: () => void;
  onSaved: (message: string, date?: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(false);
  const q = useQuery({
    queryKey: ["calendar-series", id],
    queryFn: () => api.getCalendarSeries(id!),
    enabled: !!id,
  });
  return (
    <CalendarPlanPopover
      date={date}
      recordId={source?.id}
      busy={removing}
      onBusyChange={setBusy}
      title={id ? "Edit repeating plan" : "Add repeating plan"}
      onClose={onClose}
    >
      {id && q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => void q.refetch()} />
      ) : (
        <SeriesForm
          key={id ?? source?.id ?? "new"}
          series={q.data}
          source={source}
          date={date}
          occurrenceDate={occurrenceDate}
          formBusy={busy}
          onRemoveBusy={setRemoving}
          onSaved={onSaved}
        />
      )}
    </CalendarPlanPopover>
  );
}
function SeriesForm({
  series,
  source,
  date,
  occurrenceDate,
  formBusy,
  onRemoveBusy,
  onSaved,
}: {
  series?: CalendarSeries;
  source?: Block | CalendarItem;
  date: string;
  occurrenceDate?: string;
  formBusy: boolean;
  onRemoveBusy: (busy: boolean) => void;
  onSaved: (message: string, date?: string) => void;
}) {
  const { preferences } = useMe();
  const version = useRef(series?.version).current;
  const cache = useQueryClient(),
    interaction = useCalendarInteractions();
  const sourceBlock = source && "startsAt" in source ? source : undefined;
  const sourceItem = source && "kind" in source ? source : undefined;
  const start = sourceBlock
    ? instantToLocalInput(sourceBlock.startsAt, preferences.timezone)
    : undefined;
  const firstDay =
    series?.startDate ?? sourceItem?.date ?? start?.slice(0, 10) ?? date;
  const minute =
    series?.startMinute ??
    (start
      ? Number(start.slice(11, 13)) * 60 + Number(start.slice(14, 16))
      : 540);
  const kind = series?.kind ?? (sourceItem ? "all_day" : "timed");
  const [preserve, setPreserve] = useState(true);
  const [stopDate, setStopDate] = useState(
    series ? [series.startDate, date, series.untilDate].sort()[1]! : date,
  );
  const schema = z.object({
    ...seriesInput.shape,
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    scope: z.enum(["all", "following"]),
  });
  const form = useZodForm(schema, {
    title: series?.title ?? source?.title ?? "",
    categoryId: series?.categoryId ?? source?.categoryId ?? null,
    goalId: series?.goalId ?? source?.goalId ?? null,
    notes: series?.notes ?? source?.notes ?? null,
    kind,
    dateSpan:
      series?.dateSpan ??
      (sourceItem ? daysBetween(sourceItem.date!, sourceItem.endDate!) + 1 : 1),
    timezone: series?.timezone ?? preferences.timezone,
    startDate: firstDay,
    untilDate: series?.untilDate ?? addDays(firstDay, 83),
    startMinute: minute,
    startTime: `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`,
    durationMinutes:
      series?.durationMinutes ??
      (sourceBlock
        ? (Date.parse(sourceBlock.endsAt) - Date.parse(sourceBlock.startsAt)) /
          60000
        : 60),
    frequency: series?.frequency ?? "weekly",
    interval: series?.interval ?? 1,
    weekdays: series?.weekdays ?? [weekday(firstDay)],
    scope: "all",
  });
  const values = useWatch({ control: form.control });
  const frequency = values.frequency ?? "weekly",
    days = values.weekdays ?? [],
    scope = values.scope ?? "all";
  const { startTime: time, scope: _scope, ...previewValues } = values;
  const [hour, minutes] = (time ?? "").split(":").map(Number);
  const parsed = seriesInput.safeParse({
    ...previewValues,
    startMinute: kind === "all_day" ? 0 : hour! * 60 + minutes!,
  });
  const preview = parsed.success
    ? expandPlannedSeries(parsed.data, series?.excludedDates)
    : null;
  const remove = useCommand({
    mutationFn: async (operation: "delete" | "stop", key: string) => {
      const result =
        operation === "stop"
          ? await api.changeCalendarSeries(
              series!.id,
              {
                scope: "following",
                fromDate: addDays(stopDate, 1),
                operation: "stop",
              },
              version!,
              key,
            )
          : scope === "following"
            ? await api.changeCalendarSeries(
                series!.id,
                {
                  scope: "following",
                  fromDate: occurrenceDate ?? firstDay,
                  operation: "delete",
                },
                version!,
                key,
              )
            : await api.deleteCalendarSeries(series!.id, version!, key);
      interaction?.history.record({
        key,
        kind: "series",
        undoId: result.undoId,
        blocks: result.blocks,
        items: result.items,
      });
      return { key, operation };
    },
    onSuccess: async ({ key, operation }) => {
      await invalidateCalendar(cache);
      interaction?.showNotice(
        operation === "stop"
          ? "Repeating plan ended"
          : "Repeating plans deleted",
        { undoKey: key, kind: "change" },
      );
      onSaved(
        operation === "stop"
          ? "Repeating plan ended."
          : "Repeating plans deleted.",
      );
    },
  });
  useEffect(
    () => onRemoveBusy(remove.isPending),
    [remove.isPending, onRemoveBusy],
  );
  return (
    <>
      {series && (
        <>
          <p className="muted text-small">{repeatSummary(series)}</p>
          <small>
            Changes apply to the scope below. Deleted occurrences stay excluded.
          </small>
        </>
      )}
      <Form
        form={form}
        disabled={remove.isPending || interaction?.busy}
        onSubmit={async (value, key) => {
          const { startTime, scope, ...v } = value;
          const [h, m] = startTime.split(":").map(Number);
          const input = seriesInput.parse({
            ...v,
            startMinute: kind === "all_day" ? 0 : h! * 60 + m!,
          });
          const result = series
            ? await api.updateCalendarSeries(
                series.id,
                {
                  ...input,
                  scope,
                  fromDate: occurrenceDate ?? series.startDate,
                  preserveExceptions: preserve,
                },
                version!,
                key,
              )
            : await api.createCalendarSeries(
                {
                  ...input,
                  ...(source
                    ? {
                        source: {
                          kind: sourceBlock
                            ? ("block" as const)
                            : ("item" as const),
                          id: source.id,
                          version: source.version,
                        },
                      }
                    : {}),
                },
                key,
              );
          interaction?.history.record({
            key,
            kind: "series",
            undoId: result.undoId,
            blocks: result.blocks,
            items: result.items,
          });
          await invalidateCalendar(cache);
          onSaved(
            `${result.count} occurrences saved.${result.skippedDates.length ? " Skipped missing clock times: " + result.skippedDates.join(", ") + "." : ""}`,
            result.series.kind === "all_day"
              ? result.series.startDate
              : localDate(result.firstStartsAt, preferences.timezone),
          );
        }}
      >
        <Field name="title" label="Title" />
        {series && (
          <>
            <Field
              name="scope"
              label="Apply changes to"
              onChange={(value) => {
                if (value === "following")
                  form.setValue(
                    "startDate",
                    occurrenceDate ?? series.startDate,
                  );
                else form.setValue("startDate", series.startDate);
              }}
            >
              <option value="all">Entire series</option>
              <option value="following">This and following occurrences</option>
            </Field>
            <label className="calendar-all-day-toggle">
              <input
                type="checkbox"
                checked={!preserve}
                onChange={(e) => setPreserve(!e.target.checked)}
              />
              Replace individual edits
            </label>
            <small>
              {preserve
                ? "Individual edits within the new date range are preserved, even on days no longer in the rule."
                : "Individual edits will be replaced by this rule."}
            </small>
          </>
        )}
        <div className="form-grid">
          <Field name="startDate" label="First day" type="date" />
          <Field name="untilDate" label="Repeat through" type="date" />
        </div>
        {kind === "all_day" ? (
          <Field
            name="dateSpan"
            label="Days per occurrence"
            type="number"
            min={1}
            max={31}
          />
        ) : (
          <div className="form-grid">
            <Field name="startTime" label="Start time" type="time" />
            <Field
              name="durationMinutes"
              label="Duration (minutes)"
              type="number"
              min={1}
              max={44640}
            />
          </div>
        )}
        <div className="form-grid">
          <Field name="frequency" label="Repeat">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </Field>
          <Field
            name="interval"
            label={frequency === "daily" ? "Every N days" : "Every N weeks"}
            type="number"
            min={1}
            max={52}
          />
        </div>
        {frequency === "weekly" && (
          <div className="weekday-choices" role="group" aria-label="Repeat on">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
              (label, index) => (
                <button
                  type="button"
                  className="button"
                  key={label}
                  aria-pressed={days.includes(index)}
                  onClick={() =>
                    form.setValue(
                      "weekdays",
                      days.includes(index)
                        ? days.filter((d) => d !== index)
                        : [...days, index],
                      { shouldDirty: true, shouldValidate: true },
                    )
                  }
                >
                  {label}
                </button>
              ),
            )}
            {form.formState.errors.weekdays && (
              <p role="alert" className="error">
                Choose at least one weekday.
              </p>
            )}
          </div>
        )}
        <details>
          <summary>More details</summary>
          <div className="form-stack">
            <Field
              name="timezone"
              label="Timezone"
              help="The series keeps this timezone even if your account timezone changes."
            />
            <small>
              Choose an end within one year. Timed plans skip missing clock
              times and use the first repeated time. All-day spans use calendar
              dates.
            </small>
            <Field
              name="notes"
              label="Notes (optional)"
              type="textarea"
              optional
            />
          </div>
        </details>
        {preview && (
          <div className="calendar-repeat-preview">
            <strong>{preview.occurrences.length} plans in this rule</strong>
            <p>{parsed.success ? repeatSummary(parsed.data) : ""}</p>
            <p>
              First dates:{" "}
              {preview.occurrences
                .slice(0, 3)
                .map((o) => formatDate(o.date))
                .join(", ")}
              {preview.occurrences.length > 3 ? "…" : ""}
            </p>
            {preview.skippedDates.length > 0 && (
              <p>
                Missing clock times skipped: {preview.skippedDates.join(", ")}.
              </p>
            )}
          </div>
        )}
        <Submit>
          {series
            ? scope === "following"
              ? "Save this and following"
              : "Save entire series"
            : "Create repeating plan"}
        </Submit>
      </Form>
      {series && (
        <fieldset
          className="editor-actions"
          disabled={formBusy || remove.isPending || interaction?.busy}
        >
          <label>
            Last repeating date
            <input
              type="date"
              value={stopDate}
              min={series.startDate}
              max={series.untilDate}
              onChange={(e) => setStopDate(e.target.value)}
            />
          </label>
          <button
            className="button"
            disabled={
              !stopDate ||
              stopDate < series.startDate ||
              stopDate > series.untilDate
            }
            onClick={() => remove.mutate("stop")}
          >
            Stop repeating after this date
          </button>
          <button
            className="button danger"
            onClick={() => remove.mutate("delete")}
          >
            {scope === "following"
              ? "Delete this and following"
              : "Delete entire series"}
          </button>
        </fieldset>
      )}
      <CommandError command={remove} />
    </>
  );
}
