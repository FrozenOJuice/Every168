import { Temporal } from "@js-temporal/polyfill";

/** Wall-clock plans skip missing times and use the first occurrence of a repeated time. */
export function plannedInstant(
  date: string,
  minute: number,
  timezone: string,
): string | null {
  const local = Temporal.PlainDate.from(date)
    .toPlainDateTime()
    .add({ milliseconds: Math.round(minute * 60000) });
  const zoned = local.toZonedDateTime(timezone, { disambiguation: "earlier" });
  return zoned.toPlainDateTime().equals(local)
    ? zoned.toInstant().toString()
    : null;
}

export function localMinute(value: string | Date, timezone: string) {
  const time = Temporal.Instant.from(
    value instanceof Date ? value.toISOString() : value,
  ).toZonedDateTimeISO(timezone);
  return (
    time.hour * 60 + time.minute + time.second / 60 + time.millisecond / 60000
  );
}

export function daysBetween(from: string, to: string) {
  return Temporal.PlainDate.from(from).until(Temporal.PlainDate.from(to)).days;
}

export function weekday(date: string) {
  return Temporal.PlainDate.from(date).dayOfWeek % 7;
}
export type Interval = { startsAt: string | Date; endsAt: string | Date };
export const durationSeconds = (a: string | Date, b: string | Date) =>
  (new Date(b).getTime() - new Date(a).getTime()) / 1000;
export function localDate(instant: string | Date, timeZone: string) {
  return Temporal.Instant.from(new Date(instant).toISOString())
    .toZonedDateTimeISO(timeZone)
    .toPlainDate()
    .toString();
}
export function addDays(date: string, days: number) {
  return Temporal.PlainDate.from(date).add({ days }).toString();
}
export function dayRange(date: string, timeZone: string) {
  const start = Temporal.PlainDate.from(date).toZonedDateTime(timeZone);
  return {
    startsAt: start.toInstant().toString(),
    endsAt: start.add({ days: 1 }).toInstant().toString(),
  };
}
export function weekRange(
  date: string,
  timeZone: string,
  weekStartsOn: number,
) {
  const day = Temporal.PlainDate.from(date);
  const offset = ((day.dayOfWeek % 7) - weekStartsOn + 7) % 7;
  const weekStart = day.subtract({ days: offset }).toString();
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    return { date, ...dayRange(date, timeZone) };
  });
  return {
    weekStart,
    weekEnd: addDays(weekStart, 7),
    startsAt: days[0]!.startsAt,
    endsAt: days[6]!.endsAt,
    days,
  };
}
export function localInputToInstant(value: string, timeZone: string) {
  return Temporal.PlainDateTime.from(value)
    .toZonedDateTime(timeZone, { disambiguation: "reject" })
    .toInstant()
    .toString();
}
export function instantToLocalInput(instant: string | Date, timeZone: string) {
  return Temporal.Instant.from(new Date(instant).toISOString())
    .toZonedDateTimeISO(timeZone)
    .toPlainDateTime()
    .toString({ smallestUnit: "minute" });
}
export function clippedSeconds(interval: Interval, range: Interval) {
  return Math.max(
    0,
    (Math.min(
      new Date(interval.endsAt).getTime(),
      new Date(range.endsAt).getTime(),
    ) -
      Math.max(
        new Date(interval.startsAt).getTime(),
        new Date(range.startsAt).getTime(),
      )) /
      1000,
  );
}
export function overlaps(a: Interval, b: Interval) {
  return (
    new Date(a.startsAt) < new Date(b.endsAt) &&
    new Date(b.startsAt) < new Date(a.endsAt)
  );
}
export function intervalCoverage(intervals: Interval[], range: Interval) {
  const start = new Date(range.startsAt).getTime(),
    end = new Date(range.endsAt).getTime();
  const clipped = intervals
    .map(
      (i) =>
        [
          Math.max(start, new Date(i.startsAt).getTime()),
          Math.min(end, new Date(i.endsAt).getTime()),
        ] as const,
    )
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);
  let covered = 0,
    until = start;
  for (const [s, e] of clipped) {
    covered += Math.max(0, e - Math.max(s, until));
    until = Math.max(until, e);
  }
  return covered / 1000;
}
