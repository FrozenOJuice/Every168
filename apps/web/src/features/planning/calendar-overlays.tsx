import type { CalendarItem, SearchRecord } from "@168hours/contracts";
import {
  CalendarActions,
  CalendarQuickActions,
  type CalendarAction,
} from "./calendar-actions";
import { CalendarItemEditor } from "./calendar-item-editor";
import { CalendarSeriesEditor } from "./calendar-series-editor";
import { CalendarTemplates } from "./calendar-templates";
import { CalendarSearch } from "./calendar-search";
import type { CalendarFilter } from "./calendar-filters";
import type { RefObject } from "react";
import { useCalendarInteractions } from "./calendar-interactions";
export type CalendarOverlay = {
  mode: "tools" | "search" | CalendarAction;
  date?: string;
  minute?: number;
  item?: CalendarItem;
  seriesId?: string;
  sourceId?: string;
  sourceKind?: "block" | "item";
};
export function CalendarOverlays({
  overlay,
  setOverlay,
  date,
  onSaved,
  onSchedule,
  onOpen,
  filter,
  onFilter,
  searchAnchor,
  onAddRepeating,
  onAddAllDay,
  onAddTime,
  onCopyItem,
}: {
  overlay: CalendarOverlay;
  setOverlay: (overlay: CalendarOverlay | null) => void;
  date: string;
  onSaved: (message: string, date?: string) => void;
  onSchedule: (item: CalendarItem) => void;
  onOpen: (record: SearchRecord) => void;
  filter: CalendarFilter;
  onFilter: (filter: CalendarFilter) => void;
  searchAnchor: RefObject<HTMLButtonElement | null>;
  onAddRepeating: () => void;
  onAddAllDay: () => void;
  onAddTime: (item: CalendarItem, date: string) => void;
  onCopyItem: (item: CalendarItem) => void;
}) {
  const close = () => setOverlay(null);
  const interaction = useCalendarInteractions();
  if (overlay.mode === "tools")
    return (
      <CalendarActions
        onClose={close}
        onAction={(mode) => {
          if (mode === "series") {
            close();
            onAddRepeating();
          } else if (mode === "all_day") {
            close();
            onAddAllDay();
          } else setOverlay({ mode });
        }}
      />
    );
  if (overlay.mode === "search")
    return (
      <CalendarSearch
        anchor={searchAnchor}
        filter={filter}
        onFilter={onFilter}
        onClose={close}
        onOpen={onOpen}
      />
    );
  if (overlay.mode === "series")
    return (
      <CalendarSeriesEditor
        id={overlay.seriesId}
        date={date}
        onClose={close}
        onSaved={onSaved}
      />
    );
  if (overlay.mode === "copy" || overlay.mode === "templates")
    return (
      <CalendarTemplates
        mode={overlay.mode}
        sourceId={
          overlay.sourceId ??
          interaction?.selectedId ??
          interaction?.selectedItemId ??
          undefined
        }
        sourceKind={
          overlay.sourceKind ??
          (!overlay.sourceId && interaction?.selectedItemId ? "item" : "block")
        }
        date={date}
        onClose={close}
        onSaved={onSaved}
      />
    );
  if (overlay.mode === "quick")
    return (
      <CalendarQuickActions
        date={date}
        minute={overlay.minute}
        onClose={close}
        onSaved={onSaved}
      />
    );
  return (
    <CalendarItemEditor
      key={overlay.item?.id ?? overlay.mode}
      kind={overlay.mode}
      item={overlay.item}
      date={date}
      onClose={close}
      onSchedule={onSchedule}
      onAddTime={(item) => onAddTime(item, date)}
      onCopy={onCopyItem}
      onSaved={onSaved}
    />
  );
}
