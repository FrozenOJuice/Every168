export type BlockSourceLink = {
  kind: "cardio" | "strength";
  id: string;
  version: number;
};
import type { CalendarSeries } from "@168hours/contracts";

export type SeriesUndoState = Omit<
  CalendarSeries,
  "version" | "createdAt" | "updatedAt" | "excludedDates"
>;
