import type { CalendarItem } from "@168hours/contracts";
import { useCalendarInteractions } from "./calendar-interactions";
export function CalendarItemButton({
  item,
  onOpen,
  compact = false,
  titleOnly = false,
}: {
  item: CalendarItem;
  onOpen: () => void;
  compact?: boolean;
  titleOnly?: boolean;
}) {
  const interaction = useCalendarInteractions();
  const selected = interaction?.isSelected("item", item.id);
  return (
    <button
      data-calendar-record={item.id}
      className={
        "calendar-record date-record" +
        (compact ? " compact short" : "") +
        (selected ? " date-selected" : "")
      }
      onClick={(event) => {
        if (interaction?.busy) return;
        event.currentTarget.focus({ preventScroll: true });
        if (interaction?.quickActionsAvailable && event.detail > 0)
          interaction.selectItem(item.id, event);
        else onOpen();
      }}
      onDoubleClick={() => {
        if (interaction?.quickActionsAvailable) onOpen();
      }}
      aria-pressed={interaction ? !!selected : undefined}
      aria-label={`${item.title}, ${item.kind === "all_day" ? "all day" : "unscheduled"}${item.date ? ", " + item.date : ""}`}
    >
      {!titleOnly && (
        <span className="record-time">
          {item.kind === "all_day" ? "All day" : "Any time"}
        </span>
      )}
      <strong>{item.title}</strong>
    </button>
  );
}
