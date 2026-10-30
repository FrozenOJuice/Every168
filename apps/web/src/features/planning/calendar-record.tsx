import { useCalendarInteractions } from "./calendar-interactions";
import type { Week } from "@168hours/contracts";
import { Check, Link2, TriangleAlert, Repeat } from "lucide-react";
import { formatDate, formatTime } from "@/lib/format";
import { localDate } from "@168hours/domain-utils";
import type { CalendarRecord as Record } from "./calendar-layout";

export function CalendarRecord({
  record,
  week,
  onOpen,
  compact = false,
  short = false,
  detailsOnInteraction = false,
  month = false,
  date,
  next = false,
  workoutCompleted = false,
}: {
  record: Record;
  week: Week;
  onOpen: () => void;
  compact?: boolean;
  short?: boolean;
  detailsOnInteraction?: boolean;
  month?: boolean;
  date?: string;
  next?: boolean;
  workoutCompleted?: boolean;
}) {
  const interaction = useCalendarInteractions();
  const { item, kind } = record;
  const resizing =
    kind === "block" && interaction?.preview?.resize?.id === item.id;
  const selected =
    kind === "block" && interaction?.isSelected("block", item.id);
  const startDate = localDate(item.startsAt, week.timezone);
  const endDate = localDate(item.endsAt, week.timezone);
  const continuing = compact && !month && date && startDate < date;
  const overlap =
    kind === "block" &&
    week.overlapPairs.some((pair) => pair.includes(item.id));
  const linked =
    kind === "block"
      ? week.entries.filter((e) => e.timeBlockId === item.id).length
      : record.item.timeBlockId !== null;
  return (
    <button
      disabled={interaction?.busy}
      data-calendar-record={item.id}
      className={
        "calendar-record " +
        (compact ? "compact " : "") +
        (short ? "short " : "") +
        (next ? "day-at-a-glance-next " : "") +
        (kind === "entry" ? "recorded" : "planned") +
        (selected
          ? interaction?.selectedPlanCount === 1
            ? " drag-selected"
            : " plan-selected"
          : "") +
        (kind === "block" && interaction?.isDragging("block", item.id)
          ? " drag-source"
          : "")
      }
      onKeyDown={(event) => {
        if (kind === "block" && interaction && event.key === " ") {
          event.preventDefault();
          if (!event.repeat && interaction.quickActionsAvailable)
            interaction.select(item.id, event);
        }
      }}
      onClick={(event) => {
        if (interaction?.busy) return;
        event.currentTarget.focus({ preventScroll: true });
        if (kind === "block" && interaction && event.detail > 0)
          interaction.select(item.id, event);
        else onOpen();
      }}
      onDoubleClick={() => {
        if (kind === "block" && !interaction?.busy && !interaction?.multiSelect)
          onOpen();
      }}
      aria-pressed={kind === "block" ? !!selected : undefined}
      onPointerDown={(event) => {
        if (compact && date && record.kind === "block")
          interaction?.start(event, "move", record.item, date);
      }}
      title={
        detailsOnInteraction
          ? undefined
          : `${item.title} · ${formatTime(item.startsAt, week.timezone, true)} – ${formatTime(item.endsAt, week.timezone, true)}`
      }
      aria-label={`${next ? "Next: " : ""}${item.title}, ${startDate !== endDate ? formatDate(startDate) + " " : ""}${formatTime(item.startsAt, week.timezone, true)} to ${startDate !== endDate ? formatDate(endDate) + " " : ""}${formatTime(item.endsAt, week.timezone, true)}, ${kind === "block" ? "planned" : "recorded"}${overlap ? ", overlapping" : ""}${linked ? ", linked record" : ""}${workoutCompleted ? ", workout completed" : ""}`}
    >
      {next ? (
        <>
          <strong>Next · {formatTime(item.startsAt, week.timezone)}</strong>
          <span>
            {kind === "block" ? "Planned: " : "Recorded: "}
            {item.title}
          </span>
        </>
      ) : (
        <>
          <span className="record-time">
            {!compact && startDate !== endDate && formatDate(startDate) + ", "}
            {continuing
              ? endDate > date
                ? "Continues"
                : "Until " + formatTime(item.endsAt, week.timezone)
              : formatTime(item.startsAt, week.timezone, !compact)}
            {(!compact || resizing) && (
              <>
                {" "}
                {resizing ? "-" : "–"}{" "}
                {!resizing &&
                  startDate !== endDate &&
                  formatDate(endDate) + ", "}
                {formatTime(item.endsAt, week.timezone, true)}
              </>
            )}
          </span>
          <strong>{item.title}</strong>
          {resizing && (
            <span className="record-meta">{formatDate(date ?? startDate)}</span>
          )}
          <span className="record-indicators">
            {kind === "block" && record.item.seriesId && (
              <span>
                <Repeat size={12} aria-hidden="true" />
                {record.item.isException ? "Exception" : "Repeats"}
              </span>
            )}
            {kind === "entry" && (
              <span>
                <Check size={12} aria-hidden="true" />
                Recorded
              </span>
            )}
            {(!!linked || workoutCompleted) && (
              <span>
                {workoutCompleted ? (
                  <Check size={12} aria-hidden="true" />
                ) : (
                  <Link2 size={12} aria-hidden="true" />
                )}
                {kind === "block"
                  ? workoutCompleted
                    ? "Workout completed"
                    : `${linked} linked`
                  : "Linked plan"}
              </span>
            )}
            {overlap && (
              <span className="overlap-label">
                <TriangleAlert size={12} aria-hidden="true" />
                Overlap
              </span>
            )}
          </span>
          {resizing && (
            <small className="calendar-drag-hint">Escape to cancel</small>
          )}
        </>
      )}
    </button>
  );
}
