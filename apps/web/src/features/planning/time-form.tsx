"use client";
import {
  CalendarOccurrenceOptions,
  changeOccurrence,
  convertPlan,
  type OccurrenceScope,
} from "./calendar-repeating";
import { invalidateCalendar } from "./invalidate-calendar";
import { z } from "zod";
import { useEffect, useRef, useState } from "react";
import { useWatch } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import {
  blockInput,
  calendarItemInput,
  dateSchema,
  seriesInput,
  timeEntryInput,
} from "@168hours/contracts";
import {
  daysBetween,
  expandPlannedSeries,
  localInputToInstant,
  weekday,
} from "@168hours/domain-utils";
import { useMe } from "@/features/identity/me";
import { api } from "@/lib/api";
import { Field, Form, Submit, useZodForm } from "@/components/ui/form";
import { formatDate, localTimeField } from "@/lib/format";
import {
  editorTimes,
  elapsedMilliseconds,
  endAfter,
  coveredPlanDates,
  inputAtMinute,
} from "./calendar-times";
import type {
  TimeEditor,
  CalendarDraft,
  CalendarSaveResult,
} from "./calendar-layout";
import { useCalendarInteractions } from "./calendar-interactions";
export function TimeForm({
  kind,
  item,
  allDayItem,
  date,
  minute,
  durationMinutes,
  scheduledItem,
  fromItem,
  linkedBlock,
  duplicateOf,
  onSaved,
  compact = false,
  disabled = false,
  onDraftChange,
  allowRepeat = false,
  initialRepeat = "never",
  allowAllDay = false,
  initialAllDay = false,
}: TimeEditor & {
  onSaved: (result: CalendarSaveResult) => void;
  compact?: boolean;
  disabled?: boolean;
  onDraftChange?: (draft: CalendarDraft | null) => void;
  allowRepeat?: boolean;
  initialRepeat?: "never" | "weekly";
  allowAllDay?: boolean;
  initialAllDay?: boolean;
}) {
  const [scope, setScope] = useState<OccurrenceScope>("this");
  const [preserve, setPreserve] = useState(true);
  const { preferences } = useMe();
  const [settings] = useState(() => preferences);
  const { timezone, weekStartsOn } = settings;
  const cache = useQueryClient();
  const interaction = useCalendarInteractions();
  const schema = z
    .object({
      ...blockInput.shape,
      timeBlockId: timeEntryInput.shape.timeBlockId,
      startsAt: z.string(),
      endsAt: z.string(),
      repeat: z.enum(["never", "daily", "weekly", "custom"]),
      repeatUntil: z.string(),
      repeatFrequency: z.enum(["daily", "weekly"]),
      repeatInterval: z.number().int().min(1).max(52),
      repeatWeekdays: z.array(z.number().int().min(0).max(6)),
      allDay: z.boolean(),
      allDayDate: z.string(),
      allDayEndDate: z.string(),
      spansMultipleDays: z.boolean(),
    })
    .superRefine((value, context) => {
      if (value.allDay) {
        const startDate = value.allDayDate;
        const endDate = value.spansMultipleDays
          ? value.allDayEndDate
          : startDate;
        if (
          !dateSchema.safeParse(startDate).success ||
          !dateSchema.safeParse(endDate).success ||
          endDate < startDate ||
          daysBetween(startDate, endDate) >= 31
        )
          context.addIssue({
            code: "custom",
            path: [value.spansMultipleDays ? "allDayEndDate" : "allDayDate"],
            message: "Choose dates spanning no more than 31 days.",
          });
      }
      if (!value.allDay)
        for (const field of ["startsAt", "endsAt"] as const) {
          const result = localTimeField(timezone).safeParse(value[field]);
          if (!result.success)
            context.addIssue({
              code: "custom",
              path: [field],
              message:
                result.error.issues[0]?.message ?? "Choose a valid time.",
            });
        }
      if (value.repeat === "never") return;
      const repeatDate = value.allDay
        ? value.allDayDate
        : value.startsAt.slice(0, 10);
      if (
        !dateSchema.safeParse(value.repeatUntil).success ||
        !dateSchema.safeParse(repeatDate).success ||
        value.repeatUntil < repeatDate ||
        daysBetween(repeatDate, value.repeatUntil) >= 366
      )
        context.addIssue({
          code: "custom",
          path: ["repeatUntil"],
          message: "Choose an end date within one year of the start.",
        });
      const weekly =
        value.repeat === "weekly" ||
        (value.repeat === "custom" && value.repeatFrequency === "weekly");
      if (weekly && value.repeatWeekdays.length === 0)
        context.addIssue({
          code: "custom",
          path: ["repeatWeekdays"],
          message: "Choose at least one weekday.",
        });
    });
  const initial = editorTimes(
    {
      kind,
      item,
      allDayItem,
      date,
      minute,
      linkedBlock,
      duplicateOf,
      durationMinutes,
    },
    timezone,
  );
  const source = item ?? allDayItem ?? duplicateOf ?? scheduledItem ?? fromItem;
  const savedPlan =
    allDayItem ??
    (kind === "block" && item && "seriesId" in item ? item : undefined);
  const dates = allDayItem
    ? { date: allDayItem.date!, endDate: allDayItem.endDate! }
    : item && kind === "block"
      ? coveredPlanDates(item.startsAt, item.endsAt, timezone)
      : {
          date: initial.startsAt.slice(0, 10),
          endDate: initial.startsAt.slice(0, 10),
        };
  const duration = useRef(initial.duration);
  const timedRange = useRef({
    start: initial.startsAt,
    end: initial.endsAt,
    date: dates.date,
    endDate: dates.endDate,
  });
  const form = useZodForm(schema, {
    title: source?.title ?? linkedBlock?.title ?? "",
    categoryId: source?.categoryId ?? linkedBlock?.categoryId ?? null,
    goalId: source && "goalId" in source ? source.goalId : null,
    notes: source && "notes" in source ? source.notes : null,
    timeBlockId:
      item && "timeBlockId" in item
        ? item.timeBlockId
        : (linkedBlock?.id ?? null),
    startsAt: initial.startsAt,
    endsAt: initial.endsAt,
    repeat: initialRepeat,
    repeatUntil: "",
    repeatFrequency: "weekly",
    repeatInterval: 1,
    repeatWeekdays: [weekday(initial.startsAt.slice(0, 10))],
    allDay: !!allDayItem || initialAllDay,
    allDayDate: dates.date,
    allDayEndDate: dates.endDate,
    spansMultipleDays: dates.date !== dates.endDate,
  });
  const [
    start,
    end,
    title,
    repeat,
    repeatUntil,
    repeatFrequency,
    repeatInterval,
    repeatWeekdays,
    allDay,
    allDayEndDate,
    allDayDate,
    spansMultipleDays,
  ] = useWatch({
    control: form.control,
    name: [
      "startsAt",
      "endsAt",
      "title",
      "repeat",
      "repeatUntil",
      "repeatFrequency",
      "repeatInterval",
      "repeatWeekdays",
      "allDay",
      "allDayEndDate",
      "allDayDate",
      "spansMultipleDays",
    ],
  });
  let selectedDuration: number | null = null;
  try {
    selectedDuration = elapsedMilliseconds(start, end, timezone) / 60000;
  } catch {
    /* Incomplete or invalid local input remains editable. */
  }
  const weekly =
    repeat === "weekly" ||
    (repeat === "custom" && repeatFrequency === "weekly");
  const frequency = repeat === "custom" ? repeatFrequency : repeat;
  const interval = repeat === "custom" ? repeatInterval : 1;
  const seriesPreview =
    repeat !== "never" &&
    selectedDuration !== null &&
    Number.isInteger(selectedDuration) &&
    repeatUntil &&
    dateSchema.safeParse(repeatUntil).success &&
    repeatUntil >= (allDay ? allDayDate : start.slice(0, 10)) &&
    dateSchema.safeParse(start.slice(0, 10)).success &&
    daysBetween(allDay ? allDayDate : start.slice(0, 10), repeatUntil) < 366 &&
    (!weekly || repeatWeekdays.length)
      ? expandPlannedSeries({
          kind: allDay ? "all_day" : "timed",
          startDate: allDay ? allDayDate : start.slice(0, 10),
          untilDate: repeatUntil,
          startMinute:
            Number(start.slice(11, 13)) * 60 + Number(start.slice(14, 16)),
          durationMinutes: selectedDuration,
          frequency: frequency as "daily" | "weekly",
          interval,
          weekdays: repeatWeekdays,
          timezone,
        })
      : null;
  const previewStart = seriesPreview?.occurrences[0]?.startsAt;
  const previewEnd = seriesPreview?.occurrences[0]?.endsAt;
  const hasPreview = seriesPreview !== null;
  useEffect(() => {
    if (!onDraftChange) return;
    if (allDay) {
      onDraftChange(null);
      return;
    }
    if (repeat !== "never" && hasPreview && !previewStart) {
      onDraftChange(null);
      return;
    }
    if (previewStart && previewEnd) {
      onDraftChange({ title, startsAt: previewStart, endsAt: previewEnd });
      return;
    }
    try {
      const startsAt = localInputToInstant(start, timezone);
      const endsAt = localInputToInstant(end, timezone);
      if (Date.parse(endsAt) > Date.parse(startsAt))
        onDraftChange({ title, startsAt, endsAt });
    } catch {
      /* Keep the last valid range visible while a time is incomplete. */
    }
  }, [
    start,
    end,
    title,
    timezone,
    repeat,
    allDay,
    hasPreview,
    previewStart,
    previewEnd,
    onDraftChange,
  ]);
  const repeatDays = Array.from(
    { length: 7 },
    (_, index) => (weekStartsOn + index) % 7,
  )
    .filter((day) => repeatWeekdays.includes(day))
    .map(
      (day) =>
        [
          "Sunday",
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
        ][day],
    );
  const repeatSummary =
    frequency === "daily"
      ? interval === 1
        ? "Every day"
        : `Every ${interval} days`
      : `${interval === 1 ? "Every week" : `Every ${interval} weeks`} on ${repeatDays.join(", ")}`;
  function setEnd(start: string, milliseconds: number) {
    try {
      form.setValue("endsAt", endAfter(start, milliseconds, timezone), {
        shouldDirty: true,
        shouldValidate: form.formState.isSubmitted,
      });
    } catch {
      /* The field validator explains missing/repeated clock times on submit. */
    }
  }
  const allDayRegistration = form.register("allDay");
  const spanRegistration = form.register("spansMultipleDays");
  return (
    <Form
      form={form}
      disabled={disabled || interaction?.busy}
      onSubmit={async (v, key) => {
        if (savedPlan && v.allDay !== !!allDayItem) {
          const target = v.allDay
            ? {
                kind: "all_day" as const,
                input: calendarItemInput.parse({
                  title: v.title,
                  categoryId: v.categoryId,
                  goalId: v.goalId,
                  notes: v.notes,
                  kind: "all_day",
                  date: v.allDayDate,
                  endDate: v.spansMultipleDays ? v.allDayEndDate : v.allDayDate,
                }),
              }
            : {
                kind: "timed" as const,
                input: blockInput.parse({
                  title: v.title,
                  categoryId: v.categoryId,
                  goalId: v.goalId,
                  notes: v.notes,
                  startsAt: localInputToInstant(v.startsAt, timezone),
                  endsAt: localInputToInstant(v.endsAt, timezone),
                }),
              };
          const result = await convertPlan(
            savedPlan,
            target,
            scope,
            timezone,
            preserve,
            key,
          );
          interaction?.history.record({ key, kind: "conversion", ...result });
          await invalidateCalendar(cache);
          onSaved(
            target.kind === "all_day"
              ? { kind: "all_day", date: target.input.date! }
              : { kind: "timed", startsAt: target.input.startsAt },
          );
          return;
        }
        if (allDayItem && v.allDay) {
          const input = calendarItemInput.parse({
            title: v.title,
            notes: v.notes,
            categoryId: v.categoryId,
            goalId: v.goalId,
            kind: "all_day",
            date: v.allDayDate,
            endDate: v.spansMultipleDays ? v.allDayEndDate : v.allDayDate,
          });
          if (allDayItem.seriesId && scope !== "this") {
            const result = await changeOccurrence(
              allDayItem,
              "item",
              "edit",
              scope,
              key,
              undefined,
              input,
              preserve,
            );
            interaction?.history.record({ key, kind: "series", ...result });
          } else {
            const result = await api.updateCalendarItem(
              allDayItem.id,
              input,
              allDayItem.version,
              key,
            );
            interaction?.history.record({
              key,
              kind: "item-edit",
              itemId: result.id,
              version: result.version,
              before: {
                title: allDayItem.title,
                notes: allDayItem.notes,
                categoryId: allDayItem.categoryId,
                goalId: allDayItem.goalId,
                kind: "all_day",
                date: allDayItem.date,
                endDate: allDayItem.endDate,
                isException: allDayItem.isException,
              },
              after: { ...input, isException: result.isException },
            });
          }
          await invalidateCalendar(cache);
          onSaved({ kind: "all_day", date: input.date! });
          return;
        }
        if (kind === "block" && allowAllDay && v.allDay) {
          const input = calendarItemInput.parse({
            title: v.title,
            categoryId: v.categoryId,
            goalId: v.goalId,
            notes: v.notes,
            kind: "all_day",
            date: v.allDayDate,
            endDate: v.spansMultipleDays ? v.allDayEndDate : v.allDayDate,
          });
          if (allowRepeat && v.repeat !== "never") {
            const result = await api.createCalendarSeries(
              seriesInput.parse({
                title: v.title,
                notes: v.notes,
                categoryId: v.categoryId,
                goalId: v.goalId,
                kind: "all_day",
                dateSpan: daysBetween(input.date!, input.endDate!) + 1,
                timezone,
                startDate: v.allDayDate,
                untilDate: v.repeatUntil,
                startMinute: 0,
                durationMinutes: 1440,
                frequency: v.repeat === "custom" ? v.repeatFrequency : v.repeat,
                interval: v.repeat === "custom" ? v.repeatInterval : 1,
                weekdays: v.repeatWeekdays,
              }),
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
            onSaved({ kind: "all_day", date: v.allDayDate });
            return;
          }
          const result = await api.createCalendarItem(input, key);
          interaction?.history.record({
            key,
            kind: "copy",
            blocks: [],
            items: [{ id: result.id, version: result.version }],
          });
          await invalidateCalendar(cache);
          onSaved({ kind: "all_day", date: v.allDayDate });
          return;
        }
        const times = {
          title: v.title,
          categoryId: v.categoryId,
          startsAt: localInputToInstant(v.startsAt, timezone),
          endsAt: localInputToInstant(v.endsAt, timezone),
        };
        if (Date.parse(times.endsAt) <= Date.parse(times.startsAt)) {
          form.setError("endsAt", { message: "End must be after start." });
          return;
        }
        if (kind === "block" && allowRepeat && v.repeat !== "never") {
          const input = seriesInput.parse({
            title: v.title,
            categoryId: v.categoryId,
            goalId: v.goalId,
            notes: v.notes,
            timezone,
            startDate: v.startsAt.slice(0, 10),
            untilDate: v.repeatUntil,
            startMinute:
              Number(v.startsAt.slice(11, 13)) * 60 +
              Number(v.startsAt.slice(14, 16)),
            durationMinutes:
              elapsedMilliseconds(v.startsAt, v.endsAt, timezone) / 60000,
            frequency: v.repeat === "custom" ? v.repeatFrequency : v.repeat,
            interval: v.repeat === "custom" ? v.repeatInterval : 1,
            weekdays: v.repeatWeekdays,
          });
          const result = await api.createCalendarSeries(input, key);
          interaction?.history.record({
            key,
            kind: "series",
            undoId: result.undoId,
            blocks: result.blocks,
            items: result.items,
          });
          await invalidateCalendar(cache);
          onSaved({
            kind: "timed",
            startsAt: result.firstStartsAt,
            count: result.count,
          });
          return;
        }
        if (kind === "block") {
          const input = blockInput.parse({
            ...times,
            goalId: v.goalId,
            notes: v.notes,
          });
          if (item && "seriesId" in item && item.seriesId && scope !== "this") {
            const result = await changeOccurrence(
              item,
              "block",
              "edit",
              scope,
              key,
              input,
              undefined,
              preserve,
            );
            interaction?.history.record({
              key,
              kind: "series",
              undoId: result.undoId,
              blocks: result.blocks,
              items: result.items,
            });
          } else if (item) {
            const result = await api.updateTimeBlock(
              item.id,
              input,
              item.version,
              key,
            );
            interaction?.history.record({
              key,
              kind: "edit",
              blockId: result.id,
              title: result.title,
              version: result.version,
              previousVersion: item.version,
              undoId: result.undoId,
            });
          } else if (scheduledItem)
            await api.scheduleCalendarItem(
              scheduledItem.id,
              input,
              scheduledItem.version,
              key,
            );
          else {
            const result = await api.createTimeBlock(input, key);
            interaction?.history.record({
              key,
              kind: "create",
              blockId: result.id,
              title: result.title,
              version: result.version,
            });
          }
        } else {
          const input = timeEntryInput.parse({
            ...times,
            timeBlockId: v.timeBlockId,
          });
          if (item)
            await api.updateTimeEntry(item.id, input, item.version, key);
          else {
            const result = await api.createTimeEntry(input, key);
            interaction?.history.record({
              key,
              kind: "activity-create",
              resource: "entry",
              id: result.id,
              version: result.version,
            });
          }
        }
        await invalidateCalendar(cache);
        onSaved({ kind: "timed", startsAt: times.startsAt });
      }}
    >
      {duplicateOf && (
        <p className="notice">
          New plan copied from {duplicateOf.title}. Review the date and details
          before creating it. Recorded time stays with the original.
        </p>
      )}
      {fromItem && (
        <p className="notice">
          This adds a separate timed plan. The all-day plan stays on the
          calendar.
        </p>
      )}
      <Field name="title" label="Title" />
      {savedPlan?.seriesId && (
        <CalendarOccurrenceOptions
          scope={scope}
          onScope={setScope}
          preserve={preserve}
          onPreserve={setPreserve}
        />
      )}
      {kind === "block" && allowAllDay && (
        <label className="calendar-all-day-toggle">
          <input
            type="checkbox"
            {...allDayRegistration}
            onChange={(event) => {
              if (event.target.checked) {
                try {
                  const dates = coveredPlanDates(
                    localInputToInstant(form.getValues("startsAt"), timezone),
                    localInputToInstant(form.getValues("endsAt"), timezone),
                    timezone,
                  );
                  timedRange.current = {
                    start: form.getValues("startsAt"),
                    end: form.getValues("endsAt"),
                    ...dates,
                  };
                  form.setValue("allDayDate", dates.date);
                  form.setValue("allDayEndDate", dates.endDate);
                  form.setValue(
                    "spansMultipleDays",
                    dates.date !== dates.endDate,
                  );
                } catch {
                  /* Invalid time fields remain editable when switching back. */
                }
              } else {
                const selectedDate = form.getValues("allDayDate");
                const previous = form.getValues("startsAt");
                if (dateSchema.safeParse(selectedDate).success) {
                  const next = selectedDate + previous.slice(10);
                  form.setValue("startsAt", next);
                  const last = form.getValues("spansMultipleDays")
                    ? form.getValues("allDayEndDate")
                    : selectedDate;
                  if (
                    selectedDate === timedRange.current.date &&
                    last === timedRange.current.endDate
                  ) {
                    form.setValue("startsAt", timedRange.current.start);
                    form.setValue("endsAt", timedRange.current.end);
                    void allDayRegistration.onChange(event);
                    return;
                  }
                  const oldEnd = form.getValues("endsAt");
                  const endMinute =
                    Number(oldEnd.slice(11, 13)) * 60 +
                    Number(oldEnd.slice(14, 16));
                  const end = inputAtMinute(last, endMinute);
                  form.setValue(
                    "endsAt",
                    end > next
                      ? end
                      : inputAtMinute(
                          last,
                          Number(next.slice(11, 13)) * 60 +
                            Number(next.slice(14, 16)) +
                            60,
                        ),
                  );
                  try {
                    duration.current = elapsedMilliseconds(
                      next,
                      form.getValues("endsAt"),
                      timezone,
                    );
                  } catch {
                    /* Validate clock-change choices on save. */
                  }
                }
              }
              void allDayRegistration.onChange(event);
            }}
          />
          All day
        </label>
      )}
      {savedPlan && allDay !== !!allDayItem && (
        <small>
          {allDay
            ? "Save changes this plan to all-day."
            : "Save changes this plan to one continuous timed plan, including any nights between its start and end."}
        </small>
      )}
      {allDay ? (
        <div key="all-day" className="calendar-all-day-fields">
          <Field
            name="allDayDate"
            label="Date"
            type="date"
            required
            onChange={(value) => {
              if (!spansMultipleDays || allDayEndDate < value)
                form.setValue("allDayEndDate", value);
            }}
          />
          <label className="calendar-all-day-toggle">
            <input
              type="checkbox"
              {...spanRegistration}
              onChange={(event) => {
                void spanRegistration.onChange(event);
                if (!event.target.checked)
                  form.setValue("allDayEndDate", form.getValues("allDayDate"));
              }}
            />
            Spans multiple days
          </label>
          {spansMultipleDays && (
            <Field name="allDayEndDate" label="Last day" type="date" required />
          )}
          <small>All-day plans do not allocate hours.</small>
        </div>
      ) : (
        <div key="timed" className="form-grid">
          <Field
            name="startsAt"
            label="Start"
            type="datetime-local"
            onChange={(value) => setEnd(value, duration.current)}
          />
          <Field
            name="endsAt"
            label="End"
            type="datetime-local"
            onChange={(value) => {
              try {
                const next = elapsedMilliseconds(
                  form.getValues("startsAt"),
                  value,
                  timezone,
                );
                if (next > 0) duration.current = next;
              } catch {
                /* Preserve the last valid duration until both inputs are valid. */
              }
            }}
          />
        </div>
      )}
      {!allDay && !compact && (
        <div className="duration-choices" role="group" aria-label="Duration">
          <span>Duration</span>
          {[15, 30, 60, 120].map((minutes) => (
            <button
              key={minutes}
              type="button"
              className="button"
              aria-pressed={selectedDuration === minutes}
              onClick={() => {
                duration.current = minutes * 60000;
                setEnd(form.getValues("startsAt"), duration.current);
              }}
            >
              {minutes < 60 ? `${minutes} min` : `${minutes / 60} hr`}
            </button>
          ))}
        </div>
      )}
      {!allDay && !compact && (
        <small>
          Times are in {timezone}. Moving Start keeps the duration; change End
          or choose a duration to resize.{" "}
          {kind === "entry" ? "Enter the time you actually spent." : ""}
        </small>
      )}
      {kind === "block" && allowRepeat && (
        <div className="calendar-repeat-fields">
          <Field
            name="repeat"
            label="Repeat"
            onChange={(value) => {
              const startDate = form.getValues("startsAt").slice(0, 10);
              if (
                (value === "weekly" || value === "custom") &&
                dateSchema.safeParse(startDate).success
              )
                form.setValue("repeatWeekdays", [weekday(startDate)]);
            }}
          >
            <option value="never">Never</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="custom">Custom</option>
          </Field>
          {repeat !== "never" && (
            <>
              {repeat === "custom" && (
                <div className="form-grid">
                  <Field name="repeatFrequency" label="Repeat by">
                    <option value="daily">Days</option>
                    <option value="weekly">Weeks</option>
                  </Field>
                  <Field
                    name="repeatInterval"
                    label="Every"
                    type="number"
                    min={1}
                    max={52}
                  />
                </div>
              )}
              {weekly && (
                <div className="calendar-repeat-weekdays">
                  <span>Repeat on</span>
                  <div
                    className="weekday-choices"
                    role="group"
                    aria-label="Repeat on"
                  >
                    {Array.from(
                      { length: 7 },
                      (_, index) => (weekStartsOn + index) % 7,
                    ).map((day) => (
                      <button
                        type="button"
                        className="button"
                        key={day}
                        aria-pressed={repeatWeekdays.includes(day)}
                        onClick={() =>
                          form.setValue(
                            "repeatWeekdays",
                            repeatWeekdays.includes(day)
                              ? repeatWeekdays.filter(
                                  (selected) => selected !== day,
                                )
                              : [...repeatWeekdays, day],
                            { shouldDirty: true, shouldValidate: true },
                          )
                        }
                      >
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day]}
                      </button>
                    ))}
                  </div>
                  {form.formState.errors.repeatWeekdays && (
                    <small className="error" role="alert">
                      {form.formState.errors.repeatWeekdays.message}
                    </small>
                  )}
                </div>
              )}
              <Field
                name="repeatUntil"
                label="Repeat through"
                type="date"
                required
              />
              {seriesPreview && (
                <div className="calendar-repeat-preview">
                  <strong>
                    {seriesPreview.occurrences.length} plans will be added
                  </strong>
                  <p>
                    {repeatSummary}
                    {!allDay && `, ${start.slice(11, 16)}–${end.slice(11, 16)}`}
                    , through{" "}
                    {formatDate(repeatUntil, {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                    .
                  </p>
                  {seriesPreview.occurrences.length > 0 && (
                    <p>
                      First dates:{" "}
                      {seriesPreview.occurrences
                        .slice(0, 3)
                        .map((occurrence) => formatDate(occurrence.date))
                        .join(", ")}
                      {seriesPreview.occurrences.length > 3 ? "…" : ""}
                    </p>
                  )}
                  {seriesPreview.skippedDates.length > 0 && (
                    <p>
                      Missing clock times skipped:{" "}
                      {seriesPreview.skippedDates.join(", ")}.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
      {kind === "block" && (
        <details
          open={!compact && (!!item || !!duplicateOf || !!scheduledItem)}
        >
          <summary>More details</summary>
          <Field
            name="notes"
            label="Notes (optional)"
            type="textarea"
            optional
          />
        </details>
      )}
      {linkedBlock && (
        <p className="muted text-small">
          Linked to planned block: {linkedBlock.title}
        </p>
      )}
      <Submit>
        {allDay && !compact
          ? "Create all-day plan"
          : !allDay && allowRepeat && repeat !== "never"
            ? "Create repeating plan"
            : compact
              ? "Save"
              : item
                ? "Save changes"
                : kind === "block"
                  ? "Create block"
                  : "Record time"}
      </Submit>
    </Form>
  );
}
