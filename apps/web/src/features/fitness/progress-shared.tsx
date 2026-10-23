"use client";
import { useId } from "react";
import Link from "next/link";
import { fromKilograms, fromMeters } from "@168hours/domain-utils";
import type { StrengthMetrics } from "@168hours/contracts";
import { number } from "@/lib/format";

export const trackingLabels = {
  reps_load: "Reps + load",
  reps: "Reps",
  duration: "Duration",
  duration_load: "Duration + load",
  distance_duration: "Distance + duration",
  laps_duration: "Laps + duration",
};
export function distance(value: number | null, unit: "km" | "mi") {
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
export function ProgressChart({
  label,
  points,
  format,
}: {
  label: string;
  points: { label: string; value: number | null; href: string }[];
  format: (value: number) => string;
}) {
  const titleId = useId();
  const values = points.flatMap((p) => (p.value === null ? [] : [p.value]));
  if (!values.length)
    return <p className="muted">No recorded values for this measure yet.</p>;
  const maximum = Math.max(...values, 1);
  const x = (i: number) => 38 + (i * 504) / Math.max(points.length - 1, 1);
  const y = (value: number) => 158 - (value / maximum) * 124;
  // Null values break the line; missing measurements never become zero.
  const path = points
    .map((p, i) =>
      p.value === null
        ? ""
        : `${i === 0 || points[i - 1]!.value === null ? "M" : "L"}${x(i)},${y(p.value)}`,
    )
    .join(" ");
  return (
    <figure className="fitness-progress-chart">
      <svg viewBox="0 0 580 194" role="group" aria-labelledby={titleId}>
        <title id={titleId}>
          {label}. Exact values and workout links are available below.
        </title>
        <line
          x1="38"
          x2="542"
          y1="158"
          y2="158"
          className="fitness-chart-axis"
        />
        <text x="38" y="20">
          {format(maximum)}
        </text>
        <path d={path} className="fitness-chart-line" />
        {points.map((p, i) =>
          p.value === null ? null : (
            <a
              key={`${p.href}:${i}`}
              href={p.href}
              aria-label={`${p.label}: ${format(p.value)}`}
            >
              <circle cx={x(i)} cy={y(p.value)} r="6">
                <title>
                  {p.label}: {format(p.value)}
                </title>
              </circle>
            </a>
          ),
        )}
        <text x="38" y="185">
          {points[0]?.label}
        </text>
        <text x="542" y="185" textAnchor="end">
          {points.at(-1)?.label}
        </text>
      </svg>
      <figcaption className="muted text-small">
        {label}. Select a point to open its{" "}
        {points[0]?.href.includes("session") ? "workout" : "week"}.
      </figcaption>
      <details className="fitness-secondary">
        <summary>View chart data</summary>
        <ul className="record-list">
          {points.map((p, i) => (
            <li key={`${p.href}:${i}`}>
              <Link href={p.href}>{p.label}</Link>
              <span>{p.value === null ? "Not recorded" : format(p.value)}</span>
            </li>
          ))}
        </ul>
      </details>
    </figure>
  );
}
