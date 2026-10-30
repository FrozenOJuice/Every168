"use client";
import { fromKilograms, fromMeters } from "@168hours/domain-utils";
import {
  exerciseLoggingTypeSchema,
  measurementsFor,
  type ExerciseLoggingType,
  type StrengthMetrics,
} from "@168hours/contracts";
import { number } from "@/lib/format";

export const trackingLabels = Object.fromEntries(
  exerciseLoggingTypeSchema.options.map((type) => [
    type,
    measurementsFor(type)
      .map((field) =>
        field === "load" ? "Weight" : field[0]!.toUpperCase() + field.slice(1),
      )
      .join(" + "),
  ]),
) as Record<ExerciseLoggingType, string>;
export function distance(value: number | null, unit: "m" | "km" | "yd" | "mi") {
  return value === null
    ? "Not recorded"
    : `${number(fromMeters(value, unit))} ${unit}`;
}
export function load(value: number | null, unit: "kg" | "lb", volume = false) {
  return value === null
    ? "Not recorded"
    : `${number(fromKilograms(value, unit))} ${unit}${volume ? "·reps" : ""}`;
}
export function volumeText(
  metrics: Pick<StrengthMetrics, "volumeKg" | "missingVolumeSets">,
  unit: "kg" | "lb",
) {
  return `${load(metrics.volumeKg, unit, true)}${metrics.missingVolumeSets ? ` · ${metrics.missingVolumeSets} incomplete ${metrics.missingVolumeSets === 1 ? "set" : "sets"}` : ""}`;
}
export function sessionDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    dateStyle: "medium",
  }).format(new Date(value));
}
export function MetricCards({
  items,
}: {
  items: { label: string; value: string; note?: string }[];
}) {
  return (
    <dl className="fitness-progress-metrics">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
          {item.note && <small>{item.note}</small>}
        </div>
      ))}
    </dl>
  );
}
