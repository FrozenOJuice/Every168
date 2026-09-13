import { useCalendarInteractions } from "./calendar-interactions";
import { useState } from "react";
import { HOUR_HEIGHT, slotMinute } from "./calendar-layout";

export function CalendarHourSlot({
  date,
  hour,
  onAdd,
}: {
  date: string;
  hour: number;
  onAdd: (date: string, minute: number) => void;
}) {
  const interaction = useCalendarInteractions();
  const [quarter, setQuarter] = useState(0);
  return (
    <button
      tabIndex={-1}
      className="hour-slot"
      style={{ top: hour * HOUR_HEIGHT, height: HOUR_HEIGHT }}
      aria-label={`Add block on ${date} at ${String(hour).padStart(2, "0")}:00`}
      onPointerDown={(event) =>
        interaction?.start(event, "create", undefined, date)
      }
      onPointerMove={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        setQuarter(
          slotMinute(0, event.clientY - bounds.top, bounds.height) / 15,
        );
      }}
      onClick={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        onAdd(
          date,
          event.detail === 0
            ? hour * 60
            : slotMinute(hour, event.clientY - bounds.top, bounds.height),
        );
      }}
    >
      <span
        className="slot-preview"
        aria-hidden="true"
        style={{ top: quarter * 25 + "%" }}
      >
        {String(hour).padStart(2, "0")}:{String(quarter * 15).padStart(2, "0")}
      </span>
    </button>
  );
}
