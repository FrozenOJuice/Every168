"use client";
import { formatFitnessDuration } from "./rest-duration";
import type {
  ExerciseLoggingType,
  ExerciseMeasurement,
  ProgressSession,
} from "@168hours/contracts";
import { useMe } from "@/features/identity/me";
import { exerciseTrackingFields } from "./exercise-tracking";
import { distance, load } from "./progress-shared";

export function RecordedSets({
  sets,
  mode,
  visibleMeasurements,
}: {
  sets: ProgressSession["sets"];
  mode?: ExerciseLoggingType;
  visibleMeasurements?: ExerciseMeasurement[];
}) {
  const { weightUnit, distanceUnit, durationUnit } = useMe().preferences;
  const fields = visibleMeasurements ?? [
    ...new Set(
      sets.flatMap(
        (set) => exerciseTrackingFields[set.loggingType ?? mode ?? "reps_load"],
      ),
    ),
  ];
  const labels = {
    reps: "Reps",
    load: `Weight (${weightUnit})`,
    duration: "Duration",
    distance: `Distance (${distanceUnit})`,
    laps: "Laps",
  };
  return (
    <div className="fitness-recorded-sets">
      <table>
        <caption className="sr-only">Sets, in recorded order</caption>
        <thead>
          <tr>
            <th scope="col">Set</th>
            {fields.map((field) => (
              <th scope="col" key={field}>
                {labels[field]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sets.map((set, index) => (
            <tr key={set.id}>
              <th scope="row">{(set.position ?? index) + 1}</th>
              {set.skipped || set.completed === false ? (
                <td colSpan={fields.length}>
                  {set.skipped ? "Skipped" : "Unfinished"}
                </td>
              ) : (
                fields.map((field) => (
                  <td key={field}>
                    {!exerciseTrackingFields[
                      set.loggingType ?? mode ?? "reps_load"
                    ].includes(field)
                      ? visibleMeasurements
                        ? "Not recorded"
                        : "—"
                      : field === "load"
                        ? load(set.weightKg, weightUnit)
                        : field === "distance"
                          ? distance(set.distanceMeters, distanceUnit)
                          : field === "duration"
                            ? set.durationSeconds === null
                              ? "Not recorded"
                              : formatFitnessDuration(
                                  set.durationSeconds,
                                  durationUnit,
                                )
                            : set[field] === null
                              ? "Not recorded"
                              : set[field]}
                  </td>
                ))
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
