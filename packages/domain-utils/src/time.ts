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
/** Shift local calendar dates/clock times while retaining each plan's elapsed duration. */
export function shiftPlannedTime(
  startsAt: string,
  endsAt: string,
  dayDelta: number,
  minuteDelta: number,
  timezone: string,
) {
  if (dayDelta === 0 && minuteDelta === 0) return { startsAt, endsAt };
  const minute = localMinute(startsAt, timezone) + minuteDelta;
  const date = addDays(
    localDate(startsAt, timezone),
    dayDelta + Math.floor(minute / 1440),
  );
  const next = plannedInstant(date, ((minute % 1440) + 1440) % 1440, timezone);
  return next
    ? {
        startsAt: next,
        endsAt: new Date(
          Date.parse(next) + Date.parse(endsAt) - Date.parse(startsAt),
        ).toISOString(),
      }
    : null;
}

/** Return the portions of an interval that were actually active. */
export function activeIntervals(
  interval: Interval,
  excluded: Interval[] = [],
): Interval[] {
  const start = new Date(interval.startsAt).getTime();
  const end = new Date(interval.endsAt).getTime();
  let cursor = start;
  const result: Interval[] = [];
  for (const gap of [...excluded].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  )) {
    const a = Math.max(start, new Date(gap.startsAt).getTime());
    const b = Math.min(end, new Date(gap.endsAt).getTime());
    if (b <= cursor || b <= a) continue;
    if (a > cursor)
      result.push({
        startsAt: new Date(cursor).toISOString(),
        endsAt: new Date(a).toISOString(),
      });
    cursor = Math.max(cursor, b);
  }
  if (cursor < end)
    result.push({
      startsAt: new Date(cursor).toISOString(),
      endsAt: new Date(end).toISOString(),
    });
  return result;
}
export type WorkoutTiming = {
  startedAt: string;
  endedAt: string | null;
  pauses?: { startsAt: string; endsAt: string | null }[];
};
export function workoutSeconds(workout: WorkoutTiming, now = Date.now()) {
  const lastPause = workout.pauses?.at(-1);
  // A paused workout freezes at the recorded transition, not the last timer tick.
  const endsAt =
    workout.endedAt ??
    (lastPause?.endsAt === null
      ? lastPause.startsAt
      : new Date(
          Math.max(now, lastPause?.endsAt ? Date.parse(lastPause.endsAt) : now),
        ).toISOString());
  return activeIntervals(
    { startsAt: workout.startedAt, endsAt },
    (workout.pauses ?? []).map((pause) => ({
      ...pause,
      endsAt: pause.endsAt ?? endsAt,
    })),
  ).reduce((sum, span) => sum + durationSeconds(span.startsAt, span.endsAt), 0);
}
/** Timing corrections retain only the parts of pauses inside the corrected span. */
export function clipWorkoutPauses(workout: WorkoutTiming) {
  const start = Date.parse(workout.startedAt);
  const end = workout.endedAt ? Date.parse(workout.endedAt) : Infinity;
  // Retain pause data while an incomplete/invalid timing correction is shown.
  if (end <= start) return workout.pauses ?? [];
  return (workout.pauses ?? []).flatMap((pause) => {
    const a = Math.max(start, Date.parse(pause.startsAt));
    const b = pause.endsAt ? Math.min(end, Date.parse(pause.endsAt)) : end;
    return b <= a
      ? []
      : [
          {
            startsAt: new Date(a).toISOString(),
            endsAt: Number.isFinite(b) ? new Date(b).toISOString() : null,
          },
        ];
  });
}
