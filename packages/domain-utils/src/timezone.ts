import moment from "moment-timezone";
import { Temporal } from "@js-temporal/polyfill";

/** Pinned IANA rules shared by API and browser; never use host timezone offsets. */
export const timezoneDataVersion = moment.tz.dataVersion;
export function isTimezone(value: string) {
  return moment.tz.zone(value) !== null;
}
function zoneFor(timezone: string) {
  const zone = moment.tz.zone(timezone);
  if (!zone) throw new RangeError("Unknown IANA timezone");
  return zone;
}

/** UTC carries the local fields here; this value is for calendar arithmetic only. */
export function wallTime(instant: Temporal.Instant, timezone: string) {
  const offset = zoneFor(timezone).utcOffset(instant.epochMilliseconds);
  return instant
    .subtract({ milliseconds: Math.round(offset * 60000) })
    .toZonedDateTimeISO("UTC")
    .toPlainDateTime();
}

/** Resolve all possible offsets rather than silently normalizing missing/repeated input. */
export function resolveWallTime(
  local: Temporal.PlainDateTime,
  timezone: string,
  disambiguation: "reject" | "earlier" | "compatible",
): Temporal.Instant | null {
  const zone = zoneFor(timezone);
  const utc = local.toZonedDateTime("UTC").toInstant();
  const candidates = [...new Set(zone.offsets)].map((offset) =>
    utc.add({ milliseconds: Math.round(offset * 60000) }),
  );
  const matches = candidates
    .filter((candidate) => {
      const offset = zone.utcOffset(candidate.epochMilliseconds);
      return candidate
        .subtract({ milliseconds: Math.round(offset * 60000) })
        .equals(utc);
    })
    .sort(Temporal.Instant.compare);
  if (matches.length === 1) return matches[0]!;
  if (disambiguation === "reject")
    throw new RangeError(
      "Choose an unambiguous time that exists in your timezone.",
    );
  if (matches.length) return matches[0]!;
  if (disambiguation === "earlier") return null;
  // Midnight can be skipped. A local day starts at its first existing clock time.
  return (
    candidates
      .filter(
        (candidate) =>
          Temporal.PlainDateTime.compare(wallTime(candidate, timezone), local) >
          0,
      )
      .sort(Temporal.Instant.compare)[0] ?? null
  );
}

/** Locale formatting uses UTC fields shifted by the same pinned rules as conversion. */
export function zonedDateTimeFormat(
  timezone: string,
  options: Omit<Intl.DateTimeFormatOptions, "timeZone" | "timeZoneName"> & {
    timeZoneName?: "short";
  },
) {
  const zone = zoneFor(timezone);
  const formatter = new Intl.DateTimeFormat("en", {
    ...options,
    timeZone: "UTC",
  });
  return {
    format(value: string | Date | number) {
      const at = new Date(value).getTime();
      const shifted = new Date(at - Math.round(zone.utcOffset(at) * 60000));
      return formatter
        .formatToParts(shifted)
        .map((part) =>
          part.type === "timeZoneName" ? zone.abbr(at) : part.value,
        )
        .join("");
    },
  };
}
