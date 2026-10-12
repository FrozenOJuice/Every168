import { z } from "zod";
import { useWatch } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { seriesInput, type CalendarSeries } from "@168hours/contracts";
import {
  addDays,
  expandPlannedSeries,
  weekday,
  localDate,
} from "@168hours/domain-utils";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { useCommand, CommandError } from "@/lib/use-command";
import { CalendarPlanPopover } from "./calendar-plan-popover";
import { useEffect, useState } from "react";
import { Field, Form, Submit, useZodForm } from "@/components/ui/form";
import { ErrorState, Loading } from "@/components/ui/feedback";
import { invalidateCalendar } from "./invalidate-calendar";
import { formatDate } from "@/lib/format";
import { useCalendarInteractions } from "./calendar-interactions";
export function CalendarSeriesEditor({
  id,
  date,
  onClose,
  onSaved,
}: {
  id?: string;
  date: string;
  onClose: () => void;
  onSaved: (message: string, date?: string) => void;
}) {
  const [formBusy, setFormBusy] = useState(false);
  const [removeBusy, setRemoveBusy] = useState(false);
  const q = useQuery({
    queryKey: ["calendar-series", id],
    queryFn: () => api.getCalendarSeries(id!),
    enabled: !!id,
  });
  return (
    <CalendarPlanPopover
      date={date}
      busy={removeBusy}
      onBusyChange={setFormBusy}
      title={id ? "Edit repeating plan" : "Add repeating plan"}
      onClose={onClose}
    >
      {id && q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => void q.refetch()} />
      ) : (
        <SeriesForm
          key={id ?? "new"}
          series={q.data}
          formBusy={formBusy}
          onRemoveBusy={setRemoveBusy}
          date={date}
          onSaved={onSaved}
        />
      )}
    </CalendarPlanPopover>
  );
}
function SeriesForm({
  series,
  formBusy,
  onRemoveBusy,
  date,
  onSaved,
}: {
  series?: CalendarSeries;
  formBusy: boolean;
  onRemoveBusy: (busy: boolean) => void;
  date: string;
  onSaved: (message: string, date?: string) => void;
}) {
  const { preferences } = useMe(),
    cache = useQueryClient();
  const interaction = useCalendarInteractions();
  const schema = z.object({
    ...seriesInput.shape,
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  });
  const minute = series?.startMinute ?? 540;
  const form = useZodForm(schema, {
    ...series,
    title: series?.title ?? "",
    categoryId: series?.categoryId ?? null,
    goalId: series?.goalId ?? null,
    notes: series?.notes ?? null,
    timezone: series?.timezone ?? preferences.timezone,
    startDate: series?.startDate ?? date,
    untilDate: series?.untilDate ?? addDays(date, 83),
    startMinute: minute,
    startTime: `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`,
    durationMinutes: series?.durationMinutes ?? 60,
    frequency: series?.frequency ?? "weekly",
    interval: series?.interval ?? 1,
    weekdays: series?.weekdays ?? [weekday(date)],
  });
  const values = useWatch({ control: form.control });
  const frequency = values.frequency ?? "weekly";
  const days = values.weekdays ?? [];
  const { startTime: previewTime, ...previewValues } = values;
  const [previewHour, previewMinute] = (previewTime ?? "")
    .split(":")
    .map(Number);
  const previewInput = seriesInput.safeParse({
    ...previewValues,
    startMinute: (previewHour ?? NaN) * 60 + (previewMinute ?? NaN),
  });
  const preview = previewInput.success
    ? expandPlannedSeries(previewInput.data, series?.excludedDates)
    : null;
  const remove = useCommand({
    mutationFn: async (_: void, key: string) => {
      const result = await api.deleteCalendarSeries(
        series!.id,
        series!.version,
        key,
      );
      interaction?.history.record({
        key,
        kind: "series",
        undoId: result.undoId,
        blocks: [],
      });
      return { ...result, key };
    },
    onSuccess: async ({ key }) => {
      await invalidateCalendar(cache);
      interaction?.showNotice("Repeating plan deleted", {
        undoKey: key,
        kind: "change",
      });
      onSaved("Repeating plan deleted. Recorded activity remains.");
    },
  });
  useEffect(() => {
    onRemoveBusy(remove.isPending);
  }, [remove.isPending, onRemoveBusy]);
  return (
    <>
      {series && (
        <p className="notice">
          You are editing the entire series. Saving replaces individual edits;
          deleted occurrences stay excluded. To change one occurrence, close
          this editor and edit that block. Recorded activity keeps its original
          times.
        </p>
      )}
      <Form
        form={form}
        disabled={remove.isPending}
        onSubmit={async (value, key) => {
          const { startTime, ...v } = value;
          const [hour, minute] = startTime.split(":").map(Number);
          const input = seriesInput.parse({
            ...v,
            startMinute: hour! * 60 + minute!,
          });
          const result = series
            ? await api.updateCalendarSeries(
                series.id,
                input,
                series.version,
                key,
              )
            : await api.createCalendarSeries(input, key);
          interaction?.history.record({
            key,
            kind: "series",
            undoId: result.undoId,
            blocks: result.blocks,
          });
          await invalidateCalendar(cache);
          onSaved(
            `${result.count} occurrences saved.${result.skippedDates.length ? " Skipped missing clock times: " + result.skippedDates.join(", ") + "." : ""}`,
            localDate(result.firstStartsAt, preferences.timezone),
          );
        }}
      >
        <Field name="title" label="Title" />
        <div className="form-grid">
          <Field name="startDate" label="First day" type="date" />
          <Field name="untilDate" label="Repeat through" type="date" />
        </div>
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
              Repeat through a date within one year. Missing clock times are
              skipped; repeated times use the first occurrence. Duration is
              elapsed time.
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
            <strong>{preview.occurrences.length} plans in this series</strong>
            {preview.occurrences.length > 0 && (
              <p>
                First dates:{" "}
                {preview.occurrences
                  .slice(0, 3)
                  .map((occurrence) => formatDate(occurrence.date))
                  .join(", ")}
                {preview.occurrences.length > 3 ? "…" : ""}
              </p>
            )}
            {preview.skippedDates.length > 0 && (
              <p>
                Missing clock times skipped: {preview.skippedDates.join(", ")}.
              </p>
            )}
          </div>
        )}
        <Submit>
          {series ? "Save entire series" : "Create repeating plan"}
        </Submit>
      </Form>
      {series && (
        <div className="editor-actions">
          <button
            className="button danger"
            disabled={formBusy || remove.isPending}
            onClick={() => remove.mutate()}
          >
            Delete entire series
          </button>
        </div>
      )}
      <CommandError command={remove} />
    </>
  );
}
