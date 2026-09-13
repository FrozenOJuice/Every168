import type { CalendarItem, CalendarSearchQuery } from "@168hours/contracts";
import type { CalendarRecord } from "./calendar-layout";
export type CalendarFilter = Pick<
  CalendarSearchQuery,
  "q" | "kind" | "categoryId"
>;
export const emptyCalendarFilter: CalendarFilter = { q: "", kind: "all" };
export type CalendarDisplayRecord =
  CalendarRecord | { kind: "item"; item: CalendarItem };
export function matchesCalendar(
  record: CalendarDisplayRecord,
  filter: CalendarFilter = emptyCalendarFilter,
) {
  const kind = record.kind === "item" ? record.item.kind : record.kind;
  return (
    (filter.kind === "all" || filter.kind === kind) &&
    (!filter.categoryId ||
      (filter.categoryId === "none"
        ? record.item.categoryId === null
        : record.item.categoryId === filter.categoryId)) &&
    record.item.title
      .toLocaleLowerCase()
      .includes(filter.q.trim().toLocaleLowerCase())
  );
}
export function itemsOnDate(
  items: CalendarItem[],
  date: string,
  filter?: CalendarFilter,
) {
  return items.filter(
    (item) =>
      item.date !== null &&
      item.date <= date &&
      (item.endDate ?? item.date) >= date &&
      matchesCalendar({ kind: "item", item }, filter),
  );
}
