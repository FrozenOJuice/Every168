import {
  addDays,
  instantToLocalInput,
  localInputToInstant,
} from "@168hours/domain-utils";
import type { TimeEditor } from "./calendar-layout";

export function currentHourMinute(now: string, timezone: string) {
  return Number(instantToLocalInput(now, timezone).slice(11, 13)) * 60;
}

export function inputAtMinute(date: string, minute: number) {
  const day = addDays(date, Math.floor(minute / 1440));
  const time = ((minute % 1440) + 1440) % 1440;
  return `${day}T${String(Math.floor(time / 60)).padStart(2, "0")}:${String(time % 60).padStart(2, "0")}`;
}

export function elapsedMilliseconds(
  start: string,
  end: string,
  timezone: string,
) {
  return (
    Date.parse(localInputToInstant(end, timezone)) -
    Date.parse(localInputToInstant(start, timezone))
  );
}

/** Moving a start preserves elapsed duration, including across a clock change. */
export function endAfter(start: string, duration: number, timezone: string) {
  const instant = new Date(
    Date.parse(localInputToInstant(start, timezone)) + duration,
  );
  return instantToLocalInput(instant.toISOString(), timezone);
}

export function editorTimes(editor: TimeEditor, timezone: string) {
  const source = editor.item ?? editor.linkedBlock ?? editor.duplicateOf;
  const duration = source
    ? Date.parse(source.endsAt) - Date.parse(source.startsAt)
    : (editor.durationMinutes ?? 60) * 60000;
  if (source && !editor.duplicateOf) {
    return {
      startsAt: instantToLocalInput(source.startsAt, timezone),
      endsAt: instantToLocalInput(source.endsAt, timezone),
      duration,
    };
  }
  const originalStart =
    source && instantToLocalInput(source.startsAt, timezone);
  const startsAt = originalStart
    ? addDays(originalStart.slice(0, 10), 1) + originalStart.slice(10)
    : inputAtMinute(
        editor.date,
        editor.minute ?? currentHourMinute(new Date().toISOString(), timezone),
      );
  let endsAt: string;
  try {
    endsAt = endAfter(startsAt, duration, timezone);
  } catch {
    // Keep an invalid DST choice editable. Validation requires the user to resolve it.
    const minute =
      Number(startsAt.slice(11, 13)) * 60 + Number(startsAt.slice(14, 16));
    endsAt = inputAtMinute(
      startsAt.slice(0, 10),
      minute + Math.round(duration / 60000),
    );
  }
  return { startsAt, endsAt, duration };
}
