export const toKilograms = (value: number, unit: "kg" | "lb") =>
  unit === "lb" ? value * 0.45359237 : value;
export const fromKilograms = (value: number, unit: "kg" | "lb") =>
  unit === "lb" ? value / 0.45359237 : value;
export const toMeters = (value: number, unit: "km" | "mi") =>
  value * (unit === "mi" ? 1609.344 : 1000);
export const fromMeters = (value: number, unit: "km" | "mi") =>
  value / (unit === "mi" ? 1609.344 : 1000);
export function paceSecondsPerKm(
  type: string,
  seconds: number,
  meters: number | null,
) {
  return meters !== null && meters > 0 && ["run", "walk", "swim"].includes(type)
    ? seconds / (meters / 1000)
    : null;
}
