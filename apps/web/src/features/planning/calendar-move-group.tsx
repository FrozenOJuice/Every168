"use client";
import { z } from "zod";
import { useCallback, useRef, useState } from "react";
import { useWatch, useFormContext } from "react-hook-form";
import { CalendarDays, Clock } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { dateSchema, type Block, type CalendarItem } from "@168hours/contracts";
import {
  daysBetween,
  instantToLocalInput,
  localDate,
  weekRange,
} from "@168hours/domain-utils";
import { CalendarDatePicker } from "./calendar-date-picker";
import { SessionTimePicker } from "@/features/fitness/session-time-picker";
import { useMe } from "@/features/identity/me";
import { formatDate, formatTime } from "@/lib/format";
import { api } from "@/lib/api";
import { Form, Submit, useZodForm } from "@/components/ui/form";
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
      <div className="calendar-move-anchor">
        <span className="muted text-small">
          Move {plans.length} plans together
        </span>
        <strong>{anchor.title}</strong>
        <span className="text-small">
          {formatDate(start.slice(0, 10), {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
          {"startsAt" in anchor
            ? ` · ${formatTime(anchor.startsAt, captured.timezone)}`
            : " · All day"}
        </span>
      </div>
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
        <MoveDestination
          timed={selectedBlocks.length > 0}
          timezone={captured.timezone}
        />
        <p className="text-small muted">
          Choose where {anchor.title} moves. Other selected plans keep their
          spacing and duration.
          {[...selectedBlocks, ...selectedItems].some(
            (plan) => plan.seriesId,
          ) && " Only selected repeating occurrences change."}
        </p>
        <Submit>Move plans</Submit>
      </Form>
    </CalendarPlanPopover>
  );
}

function MoveDestination({
  timed,
  timezone,
}: {
  timed: boolean;
  timezone: string;
}) {
  const { preferences } = useMe();
  const form = useFormContext<{ date: string; time: string }>();
  const [date, time] = useWatch({
    control: form.control,
    name: ["date", "time"],
  });
  const anchor = useRef<HTMLButtonElement>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [timeAnchor, setTimeAnchor] = useState<HTMLButtonElement | null>(null);
  const closeDate = useCallback(() => setDateOpen(false), []);
  const closeTime = useCallback(() => setTimeAnchor(null), []);
  return (
    <div className="calendar-move-destination">
      <div className="field">
        <label htmlFor="move-destination-date">Destination date</label>
        <button
          id="move-destination-date"
          ref={anchor}
          type="button"
          className="button"
          aria-haspopup="dialog"
          aria-expanded={dateOpen}
          onClick={(event) => {
            setContainer(event.currentTarget.closest(".calendar-plan-popover"));
            closeTime();
            setDateOpen(!dateOpen);
          }}
        >
          <CalendarDays size={18} aria-hidden="true" />
          {formatDate(date, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </button>
      </div>
      {timed && (
        <div className="field">
          <label htmlFor="move-destination-time">Start time</label>
          <button
            id="move-destination-time"
            type="button"
            className="button"
            aria-haspopup="dialog"
            aria-expanded={!!timeAnchor}
            onClick={(event) => {
              closeDate();
              setTimeAnchor(timeAnchor ? null : event.currentTarget);
            }}
          >
            <Clock size={18} aria-hidden="true" />
            {`${Number(time.slice(0, 2)) % 12 || 12}:${time.slice(3)} ${Number(time.slice(0, 2)) >= 12 ? "PM" : "AM"}`}
          </button>
        </div>
      )}
      {dateOpen && (
        <CalendarDatePicker
          date={date}
          today={localDate(new Date(), timezone)}
          weekStart={
            weekRange(date, timezone, preferences.weekStartsOn).weekStart
          }
          view="day"
          anchor={anchor}
          portalContainer={container}
          onClose={closeDate}
          onSelect={(next) => {
            form.setValue("date", next, { shouldDirty: true });
            closeDate();
          }}
        />
      )}
      {timeAnchor && (
        <SessionTimePicker
          value={time}
          anchor={timeAnchor}
          onClose={closeTime}
          onSelect={(next) =>
            form.setValue("time", next, { shouldDirty: true })
          }
        />
      )}
    </div>
  );
}
