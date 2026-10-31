import { z } from "zod";
import { useWatch } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  seriesInput,
  dateSchema,
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
import { useState, useRef } from "react";
import { Field, Form, Submit, useZodForm } from "@/components/ui/form";
import { ErrorState, Loading } from "@/components/ui/feedback";
import { invalidateCalendar } from "./invalidate-calendar";
import { formatDate } from "@/lib/format";
import { useCalendarInteractions } from "./calendar-interactions";
import { CalendarEditorActions } from "./calendar-editor-actions";
import {
  CalendarDateField,
  CalendarTimeField,
  CalendarChoiceField,
} from "./calendar-form-fields";
import { repeatSummary } from "./calendar-repeating";

export function CalendarSeriesEditor({
  id,
  date,
  source,
  occurrenceDate,
  container,
  onClose,
  onSaved,
}: {
  id?: string;
  date: string;
  source?: Block | CalendarItem;
  occurrenceDate?: string;
  container?: Element | null;
  onClose: () => void;
  onSaved: (message: string, date?: string) => void;
}) {
  const q = useQuery({
    queryKey: ["calendar-series", id],
    queryFn: () => api.getCalendarSeries(id!),
    enabled: !!id,
  });
  if ((id && q.isPending) || q.error)
    return (
      <CalendarPlanPopover
        container={container}
        date={date}
        recordId={source?.id}
        width={380}
        className="calendar-event-editor"
        title={id ? "Edit repeating plan" : "Add repeating plan"}
        onClose={onClose}
      >
        {q.error ? (
          <ErrorState error={q.error} retry={() => void q.refetch()} />
        ) : (
          <Loading />
        )}
      </CalendarPlanPopover>
    );
  return (
    <SeriesForm
      key={id ?? source?.id ?? "new"}
      series={q.data}
      source={source}
      date={date}
      occurrenceDate={occurrenceDate}
      container={container}
      onClose={onClose}
      onSaved={onSaved}
    />
  );
}
function SeriesForm({
  series,
  source,
  date,
  occurrenceDate,
  container,
  onClose,
  onSaved,
}: {
  series?: CalendarSeries;
  source?: Block | CalendarItem;
  date: string;
  occurrenceDate?: string;
  container?: Element | null;
  onClose: () => void;
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
  const [formBusy, setFormBusy] = useState(false);
  const [stopping, setStopping] = useState(false);
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
    mutationFn: async (
      value:
        | { operation: "stop"; date: string }
        | { operation: "delete"; scope: "all" | "following" },
      key: string,
    ) => {
      const result =
        value.operation === "stop"
          ? await api.changeCalendarSeries(
              series!.id,
              {
                scope: "following",
                fromDate: addDays(
                  value.operation === "stop" ? value.date : firstDay,
                  1,
                ),
                operation: "stop",
              },
              version!,
              key,
            )
          : value.operation === "delete" && value.scope === "following"
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
      return { key, operation: value.operation };
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
  const locked = formBusy || remove.isPending || !!interaction?.busy;
  return (
    <CalendarPlanPopover
      container={container}
      date={date}
      recordId={source?.id}
      width={380}
      className="calendar-event-editor"
      title={
        stopping
          ? "Stop repeating"
          : series
            ? "Edit repeating plan"
            : "Add repeating plan"
      }
      onClose={onClose}
      busy={remove.isPending}
      onBusyChange={setFormBusy}
      headerActions={
        series && !stopping ? (
          <CalendarEditorActions
            label="Repeating plan actions"
            disabled={locked}
            actions={[
              { label: "Stop repeating…", run: () => setStopping(true) },
              { separator: true },
              {
                label:
                  scope === "following"
                    ? "Delete this and following"
                    : "Delete entire series",
                destructive: true,
                run: () => remove.mutate({ operation: "delete", scope }),
              },
            ]}
          />
        ) : undefined
      }
    >
      {stopping && series ? (
        <StopRepeatingForm
          series={series}
          date={date}
          disabled={remove.isPending}
          onCancel={() => setStopping(false)}
          onStop={(date) => remove.mutate({ operation: "stop", date })}
        />
      ) : (
        <Form
          form={form}
          disabled={remove.isPending || interaction?.busy}
          footer={
            <>
              <button type="button" className="button" onClick={onClose}>
                Cancel
              </button>
              <Submit>
                {series
                  ? scope === "following"
                    ? "Save this and following"
                    : "Save entire series"
                  : "Create repeating plan"}
              </Submit>
            </>
          }
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
              <p className="muted text-small">{repeatSummary(series)}</p>
              <Field
                name="scope"
                label="Apply changes to"
                onChange={(value) =>
                  form.setValue(
                    "startDate",
                    value === "following"
                      ? (occurrenceDate ?? series.startDate)
                      : series.startDate,
                  )
                }
              >
                <option value="all">Entire series</option>
                <option value="following">
                  This and following occurrences
                </option>
              </Field>
              <label className="calendar-all-day-toggle">
                <input
                  type="checkbox"
                  checked={!preserve}
                  onChange={(event) => setPreserve(!event.target.checked)}
                />
                Replace individual edits
              </label>
              <small>
                {preserve
                  ? "Individual edits stay as they are."
                  : "Individual edits will be replaced."}{" "}
                Deleted occurrences stay excluded.
              </small>
            </>
          )}
          <div className="calendar-paired-fields">
            <CalendarDateField
              name="startDate"
              label="First day"
              timezone={series?.timezone ?? preferences.timezone}
            />
            <CalendarDateField
              name="untilDate"
              label="Repeat through"
              timezone={series?.timezone ?? preferences.timezone}
              fallbackDate={values.startDate}
            />
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
            <div className="calendar-paired-fields">
              <CalendarTimeField name="startTime" label="Start time" />
              <Field
                name="durationMinutes"
                label="Duration (minutes)"
                type="number"
                min={1}
                max={44640}
              />
            </div>
          )}
          <CalendarChoiceField
            name="frequency"
            label="Repeat"
            options={[
              { value: "daily", label: "Daily" },
              { value: "weekly", label: "Weekly" },
            ]}
          />
          <Field
            name="interval"
            label={
              frequency === "daily"
                ? "Repeat every (days)"
                : "Repeat every (weeks)"
            }
            type="number"
            min={1}
            max={52}
          />
          {frequency === "weekly" && (
            <div>
              <span className="text-small">Repeat on</span>
              <div
                className="weekday-choices"
                role="group"
                aria-label="Repeat on"
              >
                {Array.from(
                  { length: 7 },
                  (_, index) => (preferences.weekStartsOn + index) % 7,
                ).map((day) => (
                  <button
                    type="button"
                    className="button"
                    key={day}
                    aria-pressed={days.includes(day)}
                    onClick={() =>
                      form.setValue(
                        "weekdays",
                        days.includes(day)
                          ? days.filter((d) => d !== day)
                          : [...days, day],
                        { shouldDirty: true, shouldValidate: true },
                      )
                    }
                  >
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day]}
                  </button>
                ))}
              </div>
              {form.formState.errors.weekdays && (
                <p role="alert" className="error">
                  Choose at least one weekday.
                </p>
              )}
            </div>
          )}
          <Field
            name="notes"
            label="Notes (optional)"
            type="textarea"
            optional
          />
          <details>
            <summary>Time zone settings</summary>
            <Field
              name="timezone"
              label="Timezone"
              help="This rule keeps its timezone when your account setting changes."
            />
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
                  Missing clock times skipped: {preview.skippedDates.join(", ")}
                  .
                </p>
              )}
            </div>
          )}
        </Form>
      )}
      <CommandError command={remove} />
    </CalendarPlanPopover>
  );
}
function StopRepeatingForm({
  series,
  date,
  disabled,
  onCancel,
  onStop,
}: {
  series: CalendarSeries;
  date: string;
  disabled: boolean;
  onCancel: () => void;
  onStop: (date: string) => void;
}) {
  const form = useZodForm(
    z.object({
      date: dateSchema.refine(
        (value) => value >= series.startDate && value <= series.untilDate,
        "Choose a date within this rule.",
      ),
    }),
    { date: [series.startDate, date, series.untilDate].sort()[1]! },
  );
  return (
    <Form
      form={form}
      disabled={disabled}
      footer={
        <>
          <button type="button" className="button" onClick={onCancel}>
            Cancel
          </button>
          <Submit>Stop repeating</Submit>
        </>
      }
      onSubmit={async (value) => onStop(value.date)}
    >
      <p className="text-small">
        Keep occurrences through this date and remove those starting later.
      </p>
      <CalendarDateField
        name="date"
        autoFocus
        label="Last repeating date"
        timezone={series.timezone}
      />
    </Form>
  );
}
