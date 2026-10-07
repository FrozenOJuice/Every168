import type { CalendarActivity } from "@168hours/contracts";
import { dayRange } from "@168hours/domain-utils";
import type { CalendarFilter } from "./calendar-filters";
export function activityOnDate(
  entries: CalendarActivity[],
  date: string,
  timezone: string,
  filter?: CalendarFilter,
) {
  const range = dayRange(date, timezone);
  return entries.filter(
    (entry) =>
      Date.parse(entry.occurredAt) < Date.parse(range.endsAt) &&
      (entry.endsAt
        ? Date.parse(entry.endsAt) > Date.parse(range.startsAt)
        : Date.parse(entry.occurredAt) >= Date.parse(range.startsAt)) &&
      (!filter ||
        ((filter.kind === "all" || filter.kind === "entry") &&
          (!filter.categoryId || filter.categoryId === "none") &&
          (entry.title + " " + entry.summary + " " + entry.domain)
            .toLocaleLowerCase()
            .includes(filter.q.trim().toLocaleLowerCase()))),
  );
}
