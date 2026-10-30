"use client";
import { formatFitnessDuration, formatRestDuration } from "./rest-duration";
import { measurementsFor } from "@168hours/contracts";
import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { ErrorState, Loading } from "@/components/ui/feedback";
import { WorkoutReference } from "./workout-reference";
import { load, distance } from "./progress-shared";
import type { StrengthMetrics, ExerciseMeasurement } from "@168hours/contracts";
import type { WorkoutDisplayUnits } from "./workout-display-units";

export function WorkoutComparison({
  id,
  version,
}: {
  id: string;
  version: number;
}) {
  const [open, setOpen] = useState(false);
  const contentId = useId();
  const { preferences } = useMe();
  const q = useQuery({
    queryKey: ["fitness", "comparison", id, version],
    queryFn: () => api.getWorkoutComparison(id),
    enabled: open,
  });
  return (
    <section
      className="fitness-workout-comparison"
      aria-label="Previous workout comparison"
    >
      <h2 className="fitness-comparison-heading">
        <button
          type="button"
          className="button fitness-comparison-toggle"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setOpen(!open)}
        >
          Compare with previous workout
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      </h2>
      <div id={contentId} hidden={!open}>
        {open &&
          (q.isPending ? (
            <Loading />
          ) : q.error ? (
            <ErrorState error={q.error} retry={() => void q.refetch()} />
          ) : !q.data.previous ? (
            <p className="fitness-comparison-empty muted">
              No earlier finished workout with the same exercises and
              measurements yet.
            </p>
          ) : (
            <div className="fitness-comparison-content form-stack">
              <WorkoutReference
                id={q.data.previous.id}
                title={q.data.previous.title}
                startedAt={q.data.previous.startedAt}
                showTime
              />
              <section
                className="fitness-comparison-time"
                aria-label="Workout time comparison"
              >
                <h3>Workout time</h3>
                <dl>
                  <div>
                    <dt>This workout</dt>
                    <dd>
                      {q.data.current.durationSeconds === null
                        ? "In progress"
                        : formatRestDuration(q.data.current.durationSeconds)}
                    </dd>
                  </div>
                  <div>
                    <dt>Previous workout</dt>
                    <dd>
                      {q.data.previous.durationSeconds === null
                        ? "Not recorded"
                        : formatRestDuration(q.data.previous.durationSeconds)}
                    </dd>
                  </div>
                </dl>
              </section>
              <p className="muted text-small fitness-comparison-scope">
                Completed sets only
              </p>
              {q.data.current.exercises.map((exercise, index) => {
                const fields = [
                  ...new Set(
                    (
                      exercise.measurementTypes ?? [exercise.loggingType]
                    ).flatMap(measurementsFor),
                  ),
                ];
                const current = comparisonValues(exercise, fields, preferences);
                const previous = comparisonValues(
                  q.data.previous!.exercises[index]!,
                  fields,
                  preferences,
                );
                return (
                  <section
                    className="fitness-comparison-exercise"
                    key={`${exercise.exerciseId}:${index}`}
                  >
                    <h3>{exercise.name}</h3>
                    <table className="fitness-comparison-table">
                      <caption className="sr-only">
                        {exercise.name} recorded results comparison
                      </caption>
                      <thead>
                        <tr>
                          <th scope="col">Measurement</th>
                          <th scope="col">This workout</th>
                          <th scope="col">Previous</th>
                        </tr>
                      </thead>
                      <tbody>
                        {current.map((item, row) => (
                          <tr key={item.label}>
                            <th scope="row">{item.label}</th>
                            <td>{item.value}</td>
                            <td>{previous[row]!.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                );
              })}
            </div>
          ))}
      </div>
    </section>
  );
}

function comparisonValues(
  m: StrengthMetrics,
  fields: ExerciseMeasurement[],
  units: WorkoutDisplayUnits,
) {
  const values: { label: string; value: string | number }[] = [
    { label: "Completed sets", value: m.completedSets },
  ];
  if (fields.includes("load"))
    values.push({
      label: "Highest weight",
      value: load(m.maxWeightKg, units.weightUnit),
    });
  if (fields.includes("reps"))
    values.push({
      label: "Most reps in a set",
      value: m.maxReps ?? "Not recorded",
    });
  if (fields.includes("duration"))
    values.push({
      label: "Longest set",
      value:
        m.maxDurationSeconds === null
          ? "Not recorded"
          : formatFitnessDuration(
              m.maxDurationSeconds,
              units.durationUnit ?? "min_sec",
            ),
    });
  if (fields.includes("distance"))
    values.push({
      label: "Longest distance",
      value: distance(m.maxDistanceMeters, units.distanceUnit),
    });
  if (fields.includes("laps"))
    values.push({ label: "Most laps", value: m.maxLaps ?? "Not recorded" });
  return values;
}
