"use client";
import type { ExerciseLoggingType, ProgressSession } from "@168hours/contracts";
import { useMe } from "@/features/identity/me";
import { exerciseTrackingFields } from "./exercise-tracking";
import { distance, load } from "./progress-shared";

export function RecordedSets({
  sets,
  mode,
}: {
  sets: ProgressSession["sets"];
  mode: ExerciseLoggingType;
}) {
  const { weightUnit, distanceUnit } = useMe().preferences;
  const fields = exerciseTrackingFields[mode];
  const labels = {
    reps: "Reps",
    load: `Load (${weightUnit})`,
    duration: "Duration",
    distance: `Distance (${distanceUnit})`,
    laps: "Laps",
  };
  return (
    <div className="fitness-recorded-sets">
      <table>
        <caption className="sr-only">Completed sets, in recorded order</caption>
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
              {fields.map((field) => (
                <td key={field}>
                  {field === "load"
                    ? load(set.weightKg, weightUnit)
                    : field === "distance"
                      ? distance(set.distanceMeters, distanceUnit)
                      : field === "duration"
                        ? set.durationSeconds === null
                          ? "Not recorded"
                          : `${set.durationSeconds} sec`
                        : set[field] === null
                          ? "Not recorded"
                          : set[field]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
