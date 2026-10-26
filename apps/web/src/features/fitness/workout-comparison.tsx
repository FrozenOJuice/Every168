"use client";
import { formatFitnessDuration } from "./rest-duration";
import { measurementsFor } from "@168hours/contracts";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { ErrorState, Loading } from "@/components/ui/feedback";
import { hours } from "@/lib/format";
import {
  load,
  distance,
  sessionDate,
  trackingLabels,
  volumeText,
} from "./progress-shared";
import type { StrengthMetrics, ExerciseLoggingType } from "@168hours/contracts";

export function WorkoutComparison({
  id,
  version,
}: {
  id: string;
  version: number;
}) {
  const [open, setOpen] = useState(false);
  const {
    preferences: { timezone, weightUnit: unit, distanceUnit, durationUnit },
  } = useMe();
  const q = useQuery({
    queryKey: ["fitness", "comparison", id, version],
    queryFn: () => api.getWorkoutComparison(id),
    enabled: open,
  });
  return (
    <details
      className="fitness-secondary fitness-workout-comparison"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary>Compare previous workout</summary>
      {open &&
        (q.isPending ? (
          <Loading />
        ) : q.error ? (
          <ErrorState error={q.error} retry={() => void q.refetch()} />
        ) : !q.data.previous ? (
          <p>
            No earlier finished workout with the same exercises and measurement
            selections yet. Repeat this workout to build a comparison.
          </p>
        ) : (
          <div className="form-stack">
            <p className="muted text-small">
              Saved results compared with the most recent earlier finished
              workout with the same exercises and measurement selections.
              Repeated exercises match by occurrence. Targets and unfinished
              sets are excluded.
            </p>
            <Link href={`/fitness/session/${q.data.previous.id}`}>
              Previous: {sessionDate(q.data.previous.startedAt, timezone)} ·{" "}
              {q.data.previous.title}
            </Link>
            <p>
              Session duration:{" "}
              {q.data.current.durationSeconds === null
                ? "In progress"
                : hours(q.data.current.durationSeconds)}{" "}
              · Previous: {hours(q.data.previous.durationSeconds!)}
            </p>
            {q.data.current.exercises.map((exercise, index) => (
              <section
                className="fitness-comparison-exercise"
                key={`${exercise.exerciseId}:${index}`}
              >
                <h2>
                  <Link href={`/fitness/exercises/${exercise.exerciseId}`}>
                    {exercise.name}
                  </Link>
                </h2>
                <p className="muted text-small">
                  {trackingLabels[exercise.loggingType]}
                </p>
                <div className="fitness-comparison-columns">
                  <ComparisonValues
                    label="This workout"
                    metrics={exercise}
                    mode={exercise.loggingType}
                    modes={exercise.measurementTypes}
                    unit={unit}
                    distanceUnit={distanceUnit}
                    durationUnit={durationUnit}
                  />
                  <ComparisonValues
                    label="Previous workout"
                    metrics={q.data.previous!.exercises[index]!}
                    mode={exercise.loggingType}
                    modes={exercise.measurementTypes}
                    unit={unit}
                    distanceUnit={distanceUnit}
                    durationUnit={durationUnit}
                  />
                </div>
              </section>
            ))}
          </div>
        ))}
    </details>
  );
}
function ComparisonValues({
  label,
  metrics: m,
  mode,
  modes,
  unit,
  distanceUnit,
  durationUnit,
}: {
  label: string;
  metrics: StrengthMetrics;
  mode: ExerciseLoggingType;
  modes?: ExerciseLoggingType[];
  unit: "kg" | "lb";
  distanceUnit: "m" | "km" | "yd" | "mi";
  durationUnit: import("@168hours/domain-utils").DurationUnit;
}) {
  const fields = [...new Set((modes ?? [mode]).flatMap(measurementsFor))];
  return (
    <div>
      <h3>{label}</h3>
      <dl>
        <dt>Completed sets</dt>
        <dd>{m.completedSets}</dd>
        {fields.includes("load") && (
          <>
            <dt>Highest load</dt>
            <dd>{load(m.maxWeightKg, unit)}</dd>
          </>
        )}
        {fields.includes("reps") && (
          <>
            <dt>Most reps in a set</dt>
            <dd>{m.maxReps ?? "Not recorded"}</dd>
          </>
        )}
        {fields.includes("duration") && (
          <>
            <dt>Longest set</dt>
            <dd>
              {m.maxDurationSeconds === null
                ? "Not recorded"
                : formatFitnessDuration(m.maxDurationSeconds, durationUnit)}
            </dd>
          </>
        )}
        {fields.includes("distance") && (
          <>
            <dt>Longest distance</dt>
            <dd>{distance(m.maxDistanceMeters, distanceUnit)}</dd>
          </>
        )}
        {fields.includes("laps") && (
          <>
            <dt>Most laps</dt>
            <dd>{m.maxLaps ?? "Not recorded"}</dd>
          </>
        )}
        {fields.includes("reps") && fields.includes("load") && (
          <>
            <dt>Recorded volume</dt>
            <dd>{volumeText(m, unit)}</dd>
          </>
        )}
      </dl>
    </div>
  );
}
