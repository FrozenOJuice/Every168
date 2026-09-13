"use client";
import { invalidateCalendar } from "./invalidate-calendar";
import { z } from "zod";
import { useRef } from "react";
import { useWatch } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { blockInput, timeEntryInput } from "@168hours/contracts";
import { localInputToInstant } from "@168hours/domain-utils";
import { useMe } from "@/features/identity/me";
import { api } from "@/lib/api";
import { Field, Form, Submit, useZodForm } from "@/components/ui/form";
import { localTimeField } from "@/lib/format";
import { editorTimes, elapsedMilliseconds, endAfter } from "./calendar-times";
import type { TimeEditor } from "./calendar-layout";
export function TimeForm({
  kind,
  item,
  date,
  minute,
  durationMinutes,
  scheduledItem,
  linkedBlock,
  duplicateOf,
  onSaved,
}: TimeEditor & {
  onSaved: (startsAt: string) => void;
}) {
  const {
    preferences: { timezone },
  } = useMe();
  const cats = useQuery({
    queryKey: ["categories"],
    queryFn: api.getCategories,
  });
  const cache = useQueryClient();
  const goals = useQuery({
    queryKey: ["goals", "selector"],
    queryFn: () => api.getGoals({ limit: 100, status: "active" }),
  });
  const schema = z.object({
    ...blockInput.shape,
    timeBlockId: timeEntryInput.shape.timeBlockId,
    startsAt: localTimeField(timezone),
    endsAt: localTimeField(timezone),
  });
  const initial = editorTimes(
    { kind, item, date, minute, linkedBlock, duplicateOf, durationMinutes },
    timezone,
  );
  const source = item ?? duplicateOf ?? scheduledItem;
  const duration = useRef(initial.duration);
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
  });
  const [start, end] = useWatch({
    control: form.control,
    name: ["startsAt", "endsAt"],
  });
  let selectedDuration: number | null = null;
  try {
    selectedDuration = elapsedMilliseconds(start, end, timezone) / 60000;
  } catch {
    /* Incomplete or invalid local input remains editable. */
  }
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
  return (
    <Form
      form={form}
      onSubmit={async (v, key) => {
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
        if (kind === "block") {
          const input = blockInput.parse({
            ...times,
            goalId: v.goalId,
            notes: v.notes,
          });
          if (item)
            await api.updateTimeBlock(item.id, input, item.version, key);
          else if (scheduledItem)
            await api.scheduleCalendarItem(
              scheduledItem.id,
              input,
              scheduledItem.version,
              key,
            );
          else await api.createTimeBlock(input, key);
        } else {
          const input = timeEntryInput.parse({
            ...times,
            timeBlockId: v.timeBlockId,
          });
          if (item)
            await api.updateTimeEntry(item.id, input, item.version, key);
          else await api.createTimeEntry(input, key);
        }
        await invalidateCalendar(cache);
        onSaved(times.startsAt);
      }}
    >
      {duplicateOf && (
        <p className="notice">
          New plan copied from {duplicateOf.title}. Review the date and details
          before creating it. Recorded time stays with the original.
        </p>
      )}
      <Field name="title" label="Title" />
      <div className="form-grid">
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
      <small>
        Times are in {timezone}. Moving Start keeps the duration; change End or
        choose a duration to resize.{" "}
        {kind === "entry" ? "Enter the time you actually spent." : ""}
      </small>
      <Field name="categoryId" label="Category" optional>
        <option value="">Uncategorized</option>
        {cats.data
          ?.filter((c) => !c.archivedAt || c.id === source?.categoryId)
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
      </Field>
      {kind === "block" && (
        <Field name="goalId" label="Goal (optional)" optional>
          <option value="">No linked goal</option>
          {source &&
            "goalId" in source &&
            source.goalId &&
            !goals.data?.items.some((g) => g.id === source.goalId) && (
              <option value={source.goalId}>Previously linked goal</option>
            )}
          {goals.data?.items.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title}
            </option>
          ))}
        </Field>
      )}
      {kind === "block" && (
        <Field name="notes" label="Notes (optional)" type="textarea" optional />
      )}
      {linkedBlock && (
        <p className="muted text-small">
          Linked to planned block: {linkedBlock.title}
        </p>
      )}
      <Submit>
        {item
          ? "Save changes"
          : kind === "block"
            ? "Create block"
            : "Record time"}
      </Submit>
    </Form>
  );
}
