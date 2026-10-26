export const toKilograms = (value: number, unit: "kg" | "lb") =>
  unit === "lb" ? value * 0.45359237 : value;
export const fromKilograms = (value: number, unit: "kg" | "lb") =>
  unit === "lb" ? value / 0.45359237 : value;
export type DistanceUnit = "m" | "km" | "yd" | "mi";
const metersPerUnit = { m: 1, km: 1000, yd: 0.9144, mi: 1609.344 };
export const toMeters = (value: number, unit: DistanceUnit) =>
  value * metersPerUnit[unit];
export const fromMeters = (value: number, unit: DistanceUnit) =>
  value / metersPerUnit[unit];
export type DurationUnit = "min_sec" | "s" | "min" | "h";
export const secondsPerUnit = { s: 1, min: 60, h: 3600 } as const;
export const toSeconds = (
  value: number,
  unit: Exclude<DurationUnit, "min_sec">,
) => Number((value * secondsPerUnit[unit]).toFixed(9));
export const fromSeconds = (
  value: number,
  unit: Exclude<DurationUnit, "min_sec">,
) => value / secondsPerUnit[unit];
export function paceSecondsPerKm(
  type: string,
  seconds: number,
  meters: number | null,
) {
  return meters !== null && meters > 0 && ["run", "walk", "swim"].includes(type)
    ? seconds / (meters / 1000)
    : null;
}
