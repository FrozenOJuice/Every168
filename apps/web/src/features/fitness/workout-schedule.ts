import {
  instantToLocalInput,
  localInputToInstant,
} from "@168hours/domain-utils";
import {
  strengthScheduleInput,
  type StrengthScheduleInput,
} from "@168hours/contracts";

export type ScheduleFields = { start: string; end: string };
export type ScheduleErrors = { start?: string; end?: string };

export function initialWorkoutSchedule(
  date: string,
  now: Date,
  timezone: string,
  placement?: { minute?: number; durationMinutes?: number },
): ScheduleFields {
  const localTime = instantToLocalInput(now, timezone).slice(11);
  // Round the selected day's wall clock, carrying midnight into the following day.
  const clock = new Date(`${date}T${localTime}:00Z`);
  const minutes =
    clock.getUTCMinutes() +
    (now.getUTCSeconds() || now.getUTCMilliseconds() ? 1 : 0);
  if (placement?.minute !== undefined)
    clock.setUTCHours(0, placement.minute, 0, 0);
  else clock.setUTCMinutes(Math.ceil(minutes / 15) * 15);
  const duration = (placement?.durationMinutes ?? 60) * 60000;
  const start = clock.toISOString().slice(0, 16);
  let end: string;
  try {
    end = instantToLocalInput(
      new Date(Date.parse(localInputToInstant(start, timezone)) + duration),
      timezone,
    );
  } catch {
    // Keep invalid clock-change times visible for explicit correction.
    end = new Date(Date.parse(`${start}:00Z`) + duration)
      .toISOString()
      .slice(0, 16);
  }
  return { start, end };
}

export function moveWorkoutScheduleStart(
  fields: ScheduleFields,
  start: string,
  timezone: string,
): ScheduleFields {
  try {
    const duration =
      Date.parse(localInputToInstant(fields.end, timezone)) -
      Date.parse(localInputToInstant(fields.start, timezone));
    if (duration > 0) {
      const end = instantToLocalInput(
        new Date(Date.parse(localInputToInstant(start, timezone)) + duration),
        timezone,
      );
      return { start, end };
    }
  } catch {
    /* Leave invalid fields available for correction. */
  }
  return { start, end: fields.end };
}

export function validateWorkoutSchedule(
  fields: ScheduleFields,
  timezone: string,
): { input?: StrengthScheduleInput; errors: ScheduleErrors } {
  const errors: ScheduleErrors = {};
  let startsAt = "",
    endsAt = "";
  try {
    startsAt = localInputToInstant(fields.start, timezone);
  } catch {
    errors.start =
      "Choose a valid start date and time. Avoid times skipped or repeated by a clock change.";
  }
  try {
    endsAt = localInputToInstant(fields.end, timezone);
  } catch {
    errors.end =
      "Choose a valid end date and time. Avoid times skipped or repeated by a clock change.";
  }
  if (errors.start || errors.end) return { errors };
  const parsed = strengthScheduleInput.safeParse({ startsAt, endsAt });
  if (!parsed.success) {
    errors.end =
      Date.parse(endsAt) <= Date.parse(startsAt)
        ? "End must be after start."
        : (parsed.error.issues[0]?.message ??
          "Choose a valid end date and time.");
    return { errors };
  }
  return { input: parsed.data, errors };
}

export function formatWorkoutScheduleDuration(
  fields: ScheduleFields,
  timezone: string,
): string | null {
  const { input } = validateWorkoutSchedule(fields, timezone);
  if (!input) return null;
  const minutes =
    (Date.parse(input.endsAt) - Date.parse(input.startsAt)) / 60000;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return [
    hours
      ? new Intl.NumberFormat("en", {
          style: "unit",
          unit: "hour",
          unitDisplay: "long",
        }).format(hours)
      : "",
    remainder
      ? new Intl.NumberFormat("en", {
          style: "unit",
          unit: "minute",
          unitDisplay: "long",
        }).format(remainder)
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}
