import { dateSchema } from "@168hours/contracts";

/** Only a dated Calendar view is a valid return destination, never an action. */
export function parseCalendarReturn(value: unknown): string | undefined {
  if (
    typeof value !== "string" ||
    value.length > 200 ||
    !value.startsWith("/?")
  )
    return;
  const url = new URL(value, "https://calendar.invalid");
  const date = url.searchParams.get("date");
  const view = url.searchParams.get("view");
  if (
    url.origin !== "https://calendar.invalid" ||
    url.pathname !== "/" ||
    url.hash ||
    !dateSchema.safeParse(date).success ||
    !["day", "week", "month"].includes(view ?? "") ||
    [...url.searchParams.keys()].some(
      (key) => key !== "date" && key !== "view",
    ) ||
    url.searchParams.getAll("date").length !== 1 ||
    url.searchParams.getAll("view").length !== 1
  )
    return;
  return `/?date=${date}&view=${view}`;
}

export function calendarWorkoutHref(href: string, calendar?: string) {
  const target = parseCalendarReturn(calendar);
  if (!target || !/^\/fitness\/session\/[0-9a-f-]{36}(?:\?|$)/i.test(href))
    return href;
  const url = new URL(href, "https://calendar.invalid");
  url.searchParams.set("returnCalendar", target);
  return url.pathname + url.search;
}
