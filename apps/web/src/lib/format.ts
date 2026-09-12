import { localInputToInstant } from "@168hours/domain-utils";
import { z } from "zod";
export const number = (value: number, digits = 1) =>
  new Intl.NumberFormat("en", { maximumFractionDigits: digits }).format(value);
export function hours(seconds: number) {
  const minutes = Math.round(seconds / 60);
  return (
    Math.floor(minutes / 60) +
    "h " +
    String(minutes % 60).padStart(2, "0") +
    "m"
  );
}
export function formatTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
export function formatDate(
  value: string,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" },
) {
  return new Intl.DateTimeFormat("en", { ...options, timeZone: "UTC" }).format(
    new Date(value + "T12:00:00Z"),
  );
}
export function localTimeField(timezone: string) {
  return z
    .string()
    .min(1, "Choose a date and time.")
    .refine((v) => {
      try {
        localInputToInstant(v, timezone);
        return true;
      } catch {
        return false;
      }
    }, "Choose an unambiguous time that exists in your timezone.");
}
