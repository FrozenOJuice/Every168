"use client";
import { z } from "zod";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { dateSchema, type Block, type CalendarItem } from "@168hours/contracts";
import { daysBetween, instantToLocalInput } from "@168hours/domain-utils";
import { api } from "@/lib/api";
import { Field, Form, Submit, useZodForm } from "@/components/ui/form";
import { CalendarPlanPopover } from "./calendar-plan-popover";
import {
  useCalendarInteractions,
  type PlanSelection,
} from "./calendar-interactions";
import { invalidateCalendar } from "./invalidate-calendar";

export function CalendarMoveGroup({
  plans,
  blocks,
  items,
  timezone,
  onClose,
  container,
}: {
  plans: PlanSelection[];
  blocks: Block[];
  items: CalendarItem[];
  timezone: string;
  onClose: () => void;
  container?: Element | null;
}) {
  const interaction = useCalendarInteractions()!;
  const cache = useQueryClient();
  const [captured] = useState(() => ({ blocks, items, timezone }));
  const selectedBlocks = captured.blocks
    .filter((b) => plans.some((p) => p.kind === "block" && p.id === b.id))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const selectedItems = captured.items
    .filter((b) => plans.some((p) => p.kind === "item" && p.id === b.id))
    .sort((a, b) => a.date!.localeCompare(b.date!));
  const anchor = selectedBlocks[0] ?? selectedItems[0]!;
  const start =
    "startsAt" in anchor
      ? instantToLocalInput(anchor.startsAt, captured.timezone)
      : `${anchor.date}T00:00`;
  const form = useZodForm(
    z.object({
      date: dateSchema,
      time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    }),
    { date: start.slice(0, 10), time: start.slice(11) },
  );
  return (
    <CalendarPlanPopover
      container={container}
      title="Move selected plans"
      date={start.slice(0, 10)}
      recordId={anchor.id}
      onClose={onClose}
    >
      <p className="text-small">
        Move {plans.length} plans together. Destination is for {anchor.title};
        spacing and durations stay the same. Only selected repeating occurrences
        change.
      </p>
      <Form
        form={form}
        onSubmit={async (v, key) => {
          if (selectedBlocks.length + selectedItems.length !== plans.length)
            throw new Error("Selection changed. Select the plans again.");
          const minutes = (time: string) =>
            Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
          const result = await api.moveCalendarSelection(
            {
              timezone: captured.timezone,
              dayDelta: daysBetween(start.slice(0, 10), v.date),
              minuteDelta: selectedBlocks.length
                ? minutes(v.time) - minutes(start.slice(11))
                : 0,
              plans: [
                ...selectedBlocks.map(({ id, version }) => ({
                  kind: "block" as const,
                  id,
                  version,
                })),
                ...selectedItems.map(({ id, version }) => ({
                  kind: "item" as const,
                  id,
                  version,
                })),
              ],
            },
            key,
          );
          interaction.history.record({ key, kind: "group-edit", ...result });
          await invalidateCalendar(cache);
          onClose();
        }}
      >
        <Field name="date" label="Destination date" type="date" />
        {selectedBlocks.length > 0 && (
          <Field name="time" label="Start time" type="time" step={300} />
        )}
        <Submit>Move plans</Submit>
      </Form>
    </CalendarPlanPopover>
  );
}
