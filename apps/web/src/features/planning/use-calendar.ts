import { useQueries, useQuery } from "@tanstack/react-query";
import { weekRange, addDays } from "@168hours/domain-utils";
import { useMe } from "@/features/identity/me";
import { api } from "@/lib/api";
import { monthWeekStarts } from "./calendar-dates";
import type { CalendarView } from "./calendar-layout";

export function useCalendar(date: string, view: CalendarView) {
  const { preferences } = useMe();
  const { timezone, weekStartsOn } = preferences;
  const selectedWeek = weekRange(date, timezone, weekStartsOn).weekStart;
  const starts =
    view === "month"
      ? monthWeekStarts(date, timezone, weekStartsOn)
      : [selectedWeek];
  // At most six existing, owner-scoped week reads. Keep the same cache prefix for all edits.
  const queries = useQueries({
    queries: starts.map((start) => ({
      queryKey: ["week", start, preferences],
      queryFn: () => api.getWeek(start),
    })),
  });
  const from = starts[0]!,
    to = addDays(starts.at(-1)!, 6);
  const items = useQuery({
    queryKey: ["calendar-items", from, to],
    queryFn: () => api.getCalendarItems(from, to),
  });
  const weeks = queries.flatMap((query) => (query.data ? [query.data] : []));
  return {
    weeks,
    items: items.data ?? [],
    week: weeks.find((week) => week.weekStart === selectedWeek),
    selectedWeek,
    complete: weeks.length === starts.length && !!items.data,
    isPending: items.isPending || queries.some((query) => query.isPending),
    error: items.error ?? queries.find((query) => query.error)?.error,
    retry: () => {
      void items.refetch();
      for (const query of queries) void query.refetch();
    },
  };
}
