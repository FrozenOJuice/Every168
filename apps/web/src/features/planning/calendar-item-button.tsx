import type { CalendarItem } from "@168hours/contracts";
export function CalendarItemButton({
  item,
  onOpen,
  compact = false,
}: {
  item: CalendarItem;
  onOpen: () => void;
  compact?: boolean;
}) {
  return (
    <button
      className={
        "calendar-record date-record" + (compact ? " compact short" : "")
      }
      onClick={onOpen}
      aria-label={`${item.title}, ${item.kind === "all_day" ? "all day" : "unscheduled"}${item.date ? ", " + item.date : ""}`}
    >
      <span className="record-time">
        {item.kind === "all_day" ? "All day" : "Any time"}
      </span>
      <strong>{item.title}</strong>
    </button>
  );
}
