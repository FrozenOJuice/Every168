import {
  CalendarScheduling,
  calendarSchedulingSources,
} from "./calendar-scheduling";
import { useMe } from "@/features/identity/me";
import { features } from "@/lib/release";
import type { Block, CalendarItem, SearchRecord } from "@168hours/contracts";
import { CalendarQuickActions, type CalendarAction } from "./calendar-actions";
import { CalendarItemEditor } from "./calendar-item-editor";
import { CalendarSeriesEditor } from "./calendar-series-editor";
import { CalendarTemplates } from "./calendar-templates";
import { CalendarSearch } from "./calendar-search";
import type { CalendarFilter } from "./calendar-filters";
import type { RefObject } from "react";
export type CalendarOverlay = {
  mode: "search" | "schedule-source" | Exclude<CalendarAction, "all_day">;
  date?: string;
  minute?: number;
  item?: CalendarItem;
  seriesId?: string;
  seriesSource?: Block | CalendarItem;
  occurrenceDate?: string;
  sourceId?: string;
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
}) {
  const { preferences } = useMe();
  const close = () => setOverlay(null);
  if (overlay.mode === "schedule-source") {
    const source = calendarSchedulingSources.find(
      (source) => source.id === overlay.sourceId,
    );
    if (!source) return null;
    return (
      <CalendarScheduling
        source={source}
        context={{
          date,
          minute: overlay.minute,
          timezone: preferences.timezone,
        }}
        onClose={close}
        onScheduled={(result) => onSaved("", result.date)}
      />
    );
  }
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
        source={overlay.seriesSource}
        occurrenceDate={overlay.occurrenceDate}
        date={date}
        onClose={close}
        onSaved={onSaved}
      />
    );
  if (overlay.mode === "templates")
    return features.calendarTemplates ? (
      <CalendarTemplates date={date} onClose={close} onSaved={onSaved} />
    ) : null;
  if (overlay.mode === "quick")
    return features.food ? (
      <CalendarQuickActions
        date={date}
        minute={overlay.minute}
        onClose={close}
        onSaved={onSaved}
      />
    ) : null;
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
