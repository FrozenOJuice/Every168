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
  month = false,
  date,
}: {
  record: Record;
  week: Week;
  onOpen: () => void;
  compact?: boolean;
  short?: boolean;
  month?: boolean;
  date?: string;
}) {
  const interaction = useCalendarInteractions();
  const { item, kind } = record;
  const resizing =
    kind === "block" && interaction?.preview?.resize?.id === item.id;
  const selected = kind === "block" && interaction?.selectedId === item.id;
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
      data-calendar-record={item.id}
      className={
        "calendar-record " +
        (compact ? "compact " : "") +
        (short ? "short " : "") +
        (kind === "entry" ? "recorded" : "planned") +
        (selected ? " drag-selected" : "") +
        (interaction?.draggingId === item.id ? " drag-source" : "")
      }
      onClick={(event) => {
        if (interaction?.busy) return;
        event.currentTarget.focus({ preventScroll: true });
        if (kind === "block" && interaction && event.detail > 0)
          interaction.select(item.id);
        else onOpen();
      }}
      onDoubleClick={() => {
        if (kind === "block" && !interaction?.busy) onOpen();
      }}
      aria-pressed={kind === "block" ? !!selected : undefined}
      onPointerDown={(event) => {
        if (compact && date && record.kind === "block")
          interaction?.start(event, "move", record.item, date);
      }}
      title={`${item.title} · ${formatTime(item.startsAt, week.timezone, true)} – ${formatTime(item.endsAt, week.timezone, true)}`}
      aria-label={`${item.title}, ${startDate !== endDate ? formatDate(startDate) + " " : ""}${formatTime(item.startsAt, week.timezone, true)} to ${startDate !== endDate ? formatDate(endDate) + " " : ""}${formatTime(item.endsAt, week.timezone, true)}, ${kind === "block" ? "planned" : "recorded"}${overlap ? ", overlapping" : ""}${linked ? ", linked record" : ""}`}
    >
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
            {!resizing && startDate !== endDate && formatDate(endDate) + ", "}
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
        {!!linked && (
          <span>
            <Link2 size={12} aria-hidden="true" />
            {kind === "block" ? `${linked} linked` : "Linked plan"}
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
    </button>
  );
}
