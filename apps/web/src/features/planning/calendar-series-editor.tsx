import { z } from "zod";
import { useWatch } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { seriesInput, type CalendarSeries } from "@168hours/contracts";
import { addDays, weekday, localDate } from "@168hours/domain-utils";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { useCommand, CommandError } from "@/lib/use-command";
import { Dialog } from "@/components/ui/dialog";
import { Field, Form, Submit, useZodForm } from "@/components/ui/form";
import { ErrorState, Loading } from "@/components/ui/feedback";
import { invalidateCalendar } from "./invalidate-calendar";
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
  const q = useQuery({
    queryKey: ["calendar-series", id],
    queryFn: () => api.getCalendarSeries(id!),
    enabled: !!id,
  });
  return (
    <Dialog
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
          date={date}
          onSaved={onSaved}
        />
      )}
    </Dialog>
  );
}
function SeriesForm({
  series,
  date,
  onSaved,
}: {
  series?: CalendarSeries;
  date: string;
  onSaved: (message: string, date?: string) => void;
}) {
  const { preferences } = useMe(),
    cache = useQueryClient();
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
  const [frequency, days] = useWatch({
    control: form.control,
    name: ["frequency", "weekdays"],
  });
  const cats = useQuery({
    queryKey: ["categories"],
    queryFn: api.getCategories,
  });
  const goals = useQuery({
    queryKey: ["goals", "selector"],
    queryFn: () => api.getGoals({ limit: 100, status: "active" }),
  });
  const remove = useCommand({
    mutationFn: (_: void, key: string) =>
      api.deleteCalendarSeries(series!.id, series!.version, key),
    onSuccess: async () => {
      await invalidateCalendar(cache);
      onSaved("Repeating plan deleted. Recorded activity remains.");
    },
  });
  return (
    <>
      {series && (
        <p className="notice">
          Saving updates every occurrence and replaces individual edits. Deleted
          occurrences stay excluded. Recorded activity keeps its original times.
        </p>
      )}
      <Form
        form={form}
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
        <Field
          name="timezone"
          label="Timezone"
          help="The series keeps this timezone even if your account timezone changes."
        />
        <small>
          Repeat through a date within one year. Missing clock times are
          skipped; repeated times use the first occurrence. Duration is elapsed
          time.
        </small>
        <Field name="categoryId" label="Category" optional>
          <option value="">Uncategorized</option>
          {cats.data
            ?.filter((c) => !c.archivedAt || c.id === series?.categoryId)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </Field>
        <Field name="goalId" label="Goal (optional)" optional>
          <option value="">No linked goal</option>
          {series?.goalId &&
            !goals.data?.items.some((g) => g.id === series.goalId) && (
              <option value={series.goalId}>Previously linked goal</option>
            )}
          {goals.data?.items.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title}
            </option>
          ))}
        </Field>
        <Field name="notes" label="Notes (optional)" type="textarea" optional />
        <Submit>
          {series ? "Save entire series" : "Create repeating plan"}
        </Submit>
      </Form>
      {series && (
        <div className="editor-actions">
          <button
            className="button danger"
            disabled={remove.isPending}
            onClick={() => {
              if (
                confirm(
                  "Delete every occurrence of this repeating plan? Recorded activity will remain.",
                )
              )
                remove.mutate();
            }}
          >
            Delete entire series
          </button>
        </div>
      )}
      <CommandError command={remove} />
    </>
  );
}
