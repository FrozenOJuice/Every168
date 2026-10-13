export type BlockSourceLink = {
  kind: "cardio" | "strength";
  id: string;
  version: number;
};
import type { CalendarSeries, Block, CalendarItem } from "@168hours/contracts";

export type SeriesUndoState = Omit<
  CalendarSeries,
  "version" | "createdAt" | "updatedAt" | "excludedDates"
>;

export type SeriesSnapshot = {
  id: string;
  series: CalendarSeries | null;
  blocks: Block[];
  items: CalendarItem[];
};
