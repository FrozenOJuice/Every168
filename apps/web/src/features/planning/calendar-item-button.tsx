import type { CalendarItem } from "@168hours/contracts";
import { useCalendarInteractions } from "./calendar-interactions";
export function CalendarItemButton({
  item,
  onOpen,
  compact = false,
  titleOnly = false,
  date,
}: {
  item: CalendarItem;
  onOpen: () => void;
  compact?: boolean;
  titleOnly?: boolean;
  date?: string;
}) {
  const interaction = useCalendarInteractions();
  const selected = interaction?.isSelected("item", item.id);
  const canDrag = !!date && item.kind === "all_day";
  const resizing = interaction?.preview?.dateResize?.id === item.id;
  return (
    <div
      className={
        "calendar-date-plan" +
        (canDrag ? " is-draggable" : "") +
        (resizing ? " is-resizing" : "")
      }
    >
      <button
        data-calendar-record={item.id}
        className={
          "calendar-record date-record" +
          (compact ? " compact short" : "") +
          (selected ? " date-selected" : "") +
          (interaction?.isDragging("item", item.id) ? " drag-source" : "")
        }
        onPointerDown={
          canDrag
            ? (event) => interaction?.startItem(event, "move", item, date!)
            : undefined
        }
        onKeyDown={(event) => {
          if (item.kind === "all_day" && interaction && event.key === " ") {
            event.preventDefault();
            if (!event.repeat && interaction.quickActionsAvailable)
              interaction.selectItem(item.id, event);
          }
        }}
        onClick={(event) => {
          if (interaction?.busy) return;
          event.currentTarget.focus({ preventScroll: true });
          if (interaction?.quickActionsAvailable && event.detail > 0)
            interaction.selectItem(item.id, event);
          else onOpen();
        }}
        onDoubleClick={() => {
          if (interaction?.quickActionsAvailable && !interaction.multiSelect)
            onOpen();
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
        {resizing && (
          <span className="sr-only">
            {item.date} - {item.endDate}
          </span>
        )}
      </button>
      {canDrag && (!date || date === item.date) && (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          className="calendar-date-resize date-resize-start"
          aria-label={"Resize start of " + item.title}
          onPointerDown={(event) =>
            interaction?.startItem(event, "start", item, date!)
          }
          onClick={() => interaction?.selectItem(item.id)}
        />
      )}
      {canDrag && (!date || date === item.endDate) && (
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          className="calendar-date-resize date-resize-end"
          aria-label={"Resize end of " + item.title}
          onPointerDown={(event) =>
            interaction?.startItem(event, "end", item, date!)
          }
          onClick={() => interaction?.selectItem(item.id)}
        />
      )}
    </div>
  );
}
