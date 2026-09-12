"use client";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  blockInput,
  timeEntryInput,
  type Block,
  type TimeEntry,
} from "@168hours/contracts";
import {
  instantToLocalInput,
  localInputToInstant,
} from "@168hours/domain-utils";
import { useMe } from "@/features/identity/me";
import { api } from "@/lib/api";
import { Field, Form, Submit, useZodForm } from "@/components/ui/form";
import { localTimeField } from "@/lib/format";
export function TimeForm({
  kind,
  item,
  date,
  linkedBlock,
  onSaved,
}: {
  kind: "block" | "entry";
  item?: Block | TimeEntry;
  date: string;
  linkedBlock?: Block;
  onSaved: () => void;
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
  const form = useZodForm(schema, {
    title: item?.title ?? linkedBlock?.title ?? "",
    categoryId: item?.categoryId ?? linkedBlock?.categoryId ?? null,
    goalId: item && "goalId" in item ? item.goalId : null,
    notes: item && "notes" in item ? item.notes : null,
    timeBlockId:
      item && "timeBlockId" in item
        ? item.timeBlockId
        : (linkedBlock?.id ?? null),
    startsAt: item
      ? instantToLocalInput(item.startsAt, timezone)
      : date + "T09:00",
    endsAt: item ? instantToLocalInput(item.endsAt, timezone) : date + "T10:00",
  });
  return (
    <Form
      form={form}
      onSubmit={async (v) => {
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
          if (item) await api.updateTimeBlock(item.id, input);
          else await api.createTimeBlock(input);
        } else {
          const input = timeEntryInput.parse({
            ...times,
            timeBlockId: v.timeBlockId,
          });
          if (item) await api.updateTimeEntry(item.id, input);
          else await api.createTimeEntry(input);
        }
        await cache.invalidateQueries({ queryKey: ["week"] });
        await cache.invalidateQueries({ queryKey: ["dashboard"] });
        onSaved();
      }}
    >
      <Field name="title" label="Title" />
      <div className="form-grid">
        <Field name="startsAt" label="Start" type="datetime-local" />
        <Field name="endsAt" label="End" type="datetime-local" />
      </div>
      <small>
        Times are in {timezone}.{" "}
        {kind === "entry" ? "Enter the time you actually spent." : ""}
      </small>
      <Field name="categoryId" label="Category" optional>
        <option value="">Uncategorized</option>
        {cats.data
          ?.filter((c) => !c.archivedAt || c.id === item?.categoryId)
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
      </Field>
      {kind === "block" && (
        <Field name="goalId" label="Goal (optional)" optional>
          <option value="">No linked goal</option>
          {item &&
            "goalId" in item &&
            item.goalId &&
            !goals.data?.items.some((g) => g.id === item.goalId) && (
              <option value={item.goalId}>Previously linked goal</option>
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
