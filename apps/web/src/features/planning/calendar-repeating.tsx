"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import type {
  Block,
  BlockInput,
  CalendarItem,
  CalendarItemInput,
  SeriesInput,
  PlanConversionInput,
} from "@168hours/contracts";
import { uncertainWrite } from "@168hours/api-client";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { useCommand, CommandError } from "@/lib/use-command";
import { CalendarPlanPopover } from "./calendar-plan-popover";
import { useCalendarInteractions } from "./calendar-interactions";
import { invalidateCalendar } from "./invalidate-calendar";

export function repeatSummary(rule: SeriesInput) {
  const weekdays = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const cadence =
    rule.frequency === "daily"
      ? rule.interval === 1
        ? "Every day"
        : `Every ${rule.interval} days`
      : `${rule.interval === 1 ? "Every week" : `Every ${rule.interval} weeks`} on ${rule.weekdays.map((d) => weekdays[d]).join(", ")}`;
  return `${cadence} until ${formatDate(rule.untilDate, { month: "long", day: "numeric", year: "numeric" })}`;
}
export function CalendarRepeatSummary({
  id,
  onEdit,
  disabled,
}: {
  id: string;
  onEdit: () => void;
  disabled?: boolean;
}) {
  const q = useQuery({
    queryKey: ["calendar-series", id],
    queryFn: () => api.getCalendarSeries(id),
  });
  return (
    <div className="stack">
      <small>
        {q.data ? repeatSummary(q.data) : "Repeating plan"}
        {q.isError ? " · Rule unavailable" : ""}
      </small>
      <button className="text-button" disabled={disabled} onClick={onEdit}>
        Edit repeating rule
      </button>
    </div>
  );
}
export type OccurrenceScope = "this" | "following" | "all";
export function CalendarOccurrenceOptions({
  scope,
  onScope,
  preserve,
  onPreserve,
  disabled,
}: {
  scope: OccurrenceScope;
  onScope: (scope: OccurrenceScope) => void;
  preserve: boolean;
  onPreserve: (value: boolean) => void;
  disabled?: boolean;
}) {
  const scopeId = useId();
  return (
    <div className="form-stack">
      <label htmlFor={scopeId}>Apply changes to</label>
      <select
        id={scopeId}
        value={scope}
        disabled={disabled}
        onChange={(e) => onScope(e.target.value as OccurrenceScope)}
      >
        <option value="this">This occurrence</option>
        <option value="following">This and following occurrences</option>
        <option value="all">Entire series</option>
      </select>
      {scope !== "this" && (
        <label className="calendar-all-day-toggle">
          <input
            type="checkbox"
            checked={!preserve}
            disabled={disabled}
            onChange={(e) => onPreserve(!e.target.checked)}
          />
          Replace individual edits
        </label>
      )}
      {scope !== "this" && (
        <small>
          {preserve
            ? "Individual edits within the new date range stay as they are."
            : "Individual edits will be replaced by the repeating rule."}{" "}
          Deleted occurrences stay excluded.
        </small>
      )}
    </div>
  );
}
const preparedChanges = new Map<string, { id: string; version: number }>();
export async function convertPlan(
  plan: Block | CalendarItem,
  target: PlanConversionInput["target"],
  scope: OccurrenceScope,
  timezone: string,
  preserveExceptions: boolean,
  key: string,
) {
  let series = preparedChanges.get(key);
  if (scope !== "this" && plan.seriesId && !series) {
    const parent = await api.getCalendarSeries(plan.seriesId);
    series = { id: parent.id, version: parent.version };
    preparedChanges.set(key, series);
    if (preparedChanges.size > 100)
      preparedChanges.delete(preparedChanges.keys().next().value!);
  }
  try {
    const result = await api.convertCalendarPlan(
      {
        source: {
          kind: "startsAt" in plan ? "block" : "item",
          id: plan.id,
          version: plan.version,
        },
        target,
        scope,
        timezone,
        preserveExceptions,
        seriesVersion: series?.version,
      },
      key,
    );
    preparedChanges.delete(key);
    return result;
  } catch (error) {
    if (!uncertainWrite(error)) preparedChanges.delete(key);
    throw error;
  }
}
export async function changeOccurrence(
  plan: Block | CalendarItem,
  kind: "block" | "item",
  operation: "edit" | "delete",
  scope: "all" | "following",
  key: string,
  block?: BlockInput,
  item?: CalendarItemInput,
  preserveExceptions = true,
) {
  let series = preparedChanges.get(key);
  if (!series) {
    const parent = await api.getCalendarSeries(plan.seriesId!);
    series = { id: parent.id, version: parent.version };
    preparedChanges.set(key, {
      id: series.id,
      version: series.version,
    });
    if (preparedChanges.size > 100)
      preparedChanges.delete(preparedChanges.keys().next().value!);
  }
  try {
    const result = await api.changeCalendarSeries(
      series.id,
      {
        scope,
        fromDate: plan.occurrenceDate!,
        operation,
        preserveExceptions,
        occurrence: { kind, id: plan.id, version: plan.version, block, item },
      },
      series.version,
      key,
    );
    preparedChanges.delete(key);
    return result;
  } catch (error) {
    if (!uncertainWrite(error)) preparedChanges.delete(key);
    throw error;
  }
}
export type OccurrenceRequest = {
  plan: Block | CalendarItem;
  kind: "block" | "item";
  operation: "edit" | "delete";
  input?: BlockInput;
  itemInput?: CalendarItemInput;
  onThis: () => void;
};
export function CalendarOccurrenceScope({
  request,
  onClose,
  container,
}: {
  request: OccurrenceRequest;
  onClose: () => void;
  container?: Element | null;
}) {
  const interaction = useCalendarInteractions()!;
  const cache = useQueryClient();
  const [preserve, setPreserve] = useState(true);
  const command = useCommand({
    mutationFn: async (scope: "all" | "following", key: string) => {
      const result = await changeOccurrence(
        request.plan,
        request.kind,
        request.operation,
        scope,
        key,
        request.input,
        request.itemInput,
        preserve,
      );
      interaction.history.record({
        key,
        kind: "series",
        undoId: result.undoId,
        blocks: result.blocks,
        items: result.items,
      });
      return { result, key };
    },
    onSuccess: async ({ key }) => {
      await invalidateCalendar(cache);
      interaction.showNotice(
        request.operation === "delete"
          ? "Repeating plans deleted"
          : "Repeating plans updated",
        { undoKey: key, kind: "change" },
      );
      onClose();
    },
  });
  return (
    <CalendarPlanPopover
      container={container}
      recordId={request.plan.id}
      date={request.plan.occurrenceDate!}
      title={
        request.operation === "delete"
          ? "Delete repeating plan"
          : "Change repeating plan"
      }
      busy={command.isPending}
      onClose={onClose}
    >
      <p>{request.plan.title}</p>
      <p className="text-small">
        Apply this {request.operation === "delete" ? "deletion" : "adjustment"}{" "}
        to:
      </p>
      <div className="form-stack">
        <button
          className="button"
          autoFocus
          disabled={command.isPending}
          onClick={() => {
            onClose();
            request.onThis();
          }}
        >
          This occurrence
        </button>
        <button
          className="button"
          disabled={command.isPending}
          onClick={() => command.mutate("following")}
        >
          This and following occurrences
        </button>
        <button
          className="button"
          disabled={command.isPending}
          onClick={() => command.mutate("all")}
        >
          Entire series
        </button>
      </div>
      {request.operation === "edit" && (
        <label className="calendar-all-day-toggle">
          <input
            type="checkbox"
            checked={!preserve}
            disabled={command.isPending}
            onChange={(e) => setPreserve(!e.target.checked)}
          />
          Replace individual edits
        </label>
      )}
      <CommandError command={command} />
    </CalendarPlanPopover>
  );
}
