import type { CalendarItem, SearchRecord } from "@168hours/contracts";
import {
  CalendarActions,
  CalendarQuickActions,
  type CalendarAction,
} from "./calendar-actions";
import { CalendarItemEditor, CalendarBacklog } from "./calendar-item-editor";
import { CalendarSeriesEditor } from "./calendar-series-editor";
import { CalendarTemplates } from "./calendar-templates";
import { CalendarSearch } from "./calendar-search";
import type { CalendarFilter } from "./calendar-filters";
export type CalendarOverlay = {
  mode: "tools" | "search" | CalendarAction;
  item?: CalendarItem;
  seriesId?: string;
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
}: {
  overlay: CalendarOverlay;
  setOverlay: (overlay: CalendarOverlay | null) => void;
  date: string;
  onSaved: (message: string, date?: string) => void;
  onSchedule: (item: CalendarItem) => void;
  onOpen: (record: SearchRecord) => void;
  filter: CalendarFilter;
  onFilter: (filter: CalendarFilter) => void;
}) {
  const close = () => setOverlay(null);
  if (overlay.mode === "tools")
    return (
      <CalendarActions
        onClose={close}
        onAction={(mode) => setOverlay({ mode })}
      />
    );
  if (overlay.mode === "search")
    return (
      <CalendarSearch
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
  if (overlay.mode === "templates")
    return <CalendarTemplates date={date} onClose={close} onSaved={onSaved} />;
  if (overlay.mode === "quick")
    return (
      <CalendarQuickActions date={date} onClose={close} onSaved={onSaved} />
    );
  if (overlay.mode === "backlog")
    return (
      <CalendarBacklog
        onClose={close}
        onOpen={(item) => setOverlay({ mode: item.kind, item })}
        onAdd={() => setOverlay({ mode: "unscheduled" })}
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
      onSaved={onSaved}
    />
  );
}
