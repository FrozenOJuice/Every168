import { addDays, daysBetween, plannedInstant, weekday } from "./time";

export type PlannedSeriesRule = {
  startDate: string;
  untilDate: string;
  startMinute: number;
  durationMinutes: number;
  frequency: "daily" | "weekly";
  interval: number;
  weekdays: number[];
  timezone: string;
  kind?: "timed" | "all_day";
  dateSpan?: number;
};

export function expandPlannedSeries(
  rule: PlannedSeriesRule,
  excluded: string[] = [],
) {
  const occurrences: { date: string; startsAt: string; endsAt: string }[] = [];
  const skippedDates: string[] = [];
  const mondayOffset = (weekday(rule.startDate) + 6) % 7;
  for (
    let date = rule.startDate;
    date <= rule.untilDate;
    date = addDays(date, 1)
  ) {
    const days = daysBetween(rule.startDate, date);
    const matches =
      rule.frequency === "daily"
        ? days % rule.interval === 0
        : Math.floor((days + mondayOffset) / 7) % rule.interval === 0 &&
          rule.weekdays.includes(weekday(date));
    if (!matches || excluded.includes(date)) continue;
    const startsAt =
      rule.kind === "all_day"
        ? `${date}T00:00:00.000Z`
        : plannedInstant(date, rule.startMinute, rule.timezone);
    if (!startsAt) {
      skippedDates.push(date);
      continue;
    }
    occurrences.push({
      date,
      startsAt,
      endsAt: new Date(
        Date.parse(startsAt) + rule.durationMinutes * 60000,
      ).toISOString(),
    });
  }
  return { occurrences, skippedDates };
}
