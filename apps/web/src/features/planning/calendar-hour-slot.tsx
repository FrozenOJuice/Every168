import { useCalendarInteractions } from "./calendar-interactions";
import { useId, useRef, type PointerEvent } from "react";
import { Plus } from "lucide-react";
import { slotMinute, type TimeTickMinutes } from "./calendar-layout";

export function CalendarHourSlot({
  date,
  hour,
  currentHour,
  hourHeight,
  tickMinutes,
  onAdd,
  onQuickAction,
}: {
  date: string;
  hour: number;
  currentHour: number;
  hourHeight: number;
  tickMinutes: TimeTickMinutes;
  onAdd: (date: string, minute: number) => void;
  onQuickAction: (date: string, minute: number) => void;
}) {
  const hintId = useId();
  const interaction = useCalendarInteractions();
  const preview = useRef<HTMLSpanElement>(null);
  const previewTime = useRef<HTMLSpanElement>(null);
  const quickAdd = useRef<HTMLButtonElement>(null);
  const previewMinute = useRef(0);
  const quickPress = useRef<{
    pointer: number;
    x: number;
    y: number;
    dragged: boolean;
  } | null>(null);
  const updatePreview = (event: PointerEvent<HTMLDivElement>) => {
    if (
      event.type === "pointermove" &&
      (event.target as Element).closest(".slot-quick-add")
    )
      return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const minute = slotMinute(0, event.clientY - bounds.top, bounds.height);
    previewMinute.current = minute;
    if (preview.current) preview.current.style.top = (minute / 60) * 100 + "%";
    if (quickAdd.current)
      quickAdd.current.style.top = ((minute + 2.5) / 60) * 100 + "%";
    quickAdd.current?.setAttribute(
      "aria-label",
      `Quick actions on ${date} at ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    );
    if (previewTime.current)
      previewTime.current.textContent = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  };
  const selected = interaction?.timeSelection;
  const selectedMinute = selected?.minute ?? hour * 60;
  const active =
    selected?.date === date &&
    selected?.minute !== undefined &&
    Math.floor(selectedMinute / 60) === hour;
  return (
    <div
      className={
        "hour-slot-wrap" +
        (interaction?.quickActionsAvailable === false
          ? " is-quick-disabled"
          : "")
      }
      style={{ top: hour * hourHeight, height: hourHeight }}
      onPointerEnter={updatePreview}
      onPointerMove={updatePreview}
    >
      <button
        tabIndex={active || (!selected && hour === currentHour) ? 0 : -1}
        className={
          "hour-slot" +
          (tickMinutes > 60 && (hour * 60) % tickMinutes
            ? " is-between-ticks"
            : "") +
          (tickMinutes === 30 ? " has-half-hour-tick" : "") +
          (tickMinutes === 15 ? " has-quarter-hour-ticks" : "")
        }
        data-context-date={date}
        data-context-hour={hour}
        aria-pressed={active}
        aria-describedby={hintId}
        aria-label={`Select time on ${date} at ${String(hour).padStart(2, "0")}:00`}
        onPointerDown={(event) =>
          interaction?.start(event, "create", undefined, date)
        }
        onClick={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          interaction?.selectTime({
            date,
            minute:
              event.detail === 0
                ? active
                  ? selectedMinute
                  : hour * 60
                : slotMinute(hour, event.clientY - bounds.top, bounds.height),
          });
        }}
        onDoubleClick={(event) => {
          if (interaction?.busy) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          onAdd(
            date,
            slotMinute(hour, event.clientY - bounds.top, bounds.height),
          );
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || interaction?.busy) return;
          event.preventDefault();
          onAdd(date, active ? selectedMinute : hour * 60);
        }}
      >
        <span id={hintId} className="sr-only">
          Click to select a five-minute time. Double-click or press Enter to
          create a plan.
        </span>
        {active && (
          <span
            className="slot-selection"
            data-selected-time={`${date}T${String(hour).padStart(2, "0")}:${String(selectedMinute % 60).padStart(2, "0")}`}
            aria-hidden="true"
            style={{ top: ((selectedMinute % 60) / 60) * 100 + "%" }}
          />
        )}
      </button>
      <span
        ref={preview}
        className="slot-preview"
        aria-hidden="true"
        style={{ top: 0 }}
      >
        <span ref={previewTime} className="slot-preview-time">
          {String(hour).padStart(2, "0")}:00
        </span>
      </span>
      <button
        ref={quickAdd}
        className="slot-quick-add"
        type="button"
        style={{ top: `${(2.5 / 60) * 100}%` }}
        aria-label={`Quick actions on ${date} at ${String(hour).padStart(2, "0")}:00`}
        onPointerDown={(event) => {
          event.stopPropagation();
          quickPress.current = {
            pointer: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            dragged: false,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const press = quickPress.current;
          if (press?.pointer === event.pointerId)
            press.dragged ||=
              Math.hypot(event.clientX - press.x, event.clientY - press.y) > 5;
        }}
        onPointerCancel={() => {
          quickPress.current = null;
        }}
        onClick={(event) => {
          event.stopPropagation();
          const dragged = quickPress.current?.dragged;
          quickPress.current = null;
          if (!dragged && interaction?.quickActionsAvailable)
            onQuickAction(date, hour * 60 + previewMinute.current);
        }}
      >
        <Plus size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
