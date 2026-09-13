import {
  instantToLocalInput,
  localDate,
  localInputToInstant,
} from "@168hours/domain-utils";

/** Backdated logs start at noon; today's quick logs use the actual current instant. */
export function instantForLogDate(
  date: string,
  timezone: string,
  now = new Date(),
) {
  return localDate(now, timezone) === date
    ? now.toISOString()
    : localInputToInstant(date + "T12:00", timezone);
}
export function timeForLogDate(date: string, timezone: string) {
  return instantToLocalInput(instantForLogDate(date, timezone), timezone);
}
