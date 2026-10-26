"use client";
import { formatFitnessDuration } from "./rest-duration";
import { useQuery } from "@tanstack/react-query";
import type { ExerciseLoggingType } from "@168hours/contracts";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { distance, load, sessionDate } from "./progress-shared";
import { exerciseTrackingFields } from "./exercise-tracking";

export function ExerciseRecall({
  id,
  mode,
  excludeWorkoutId,
  onHistory,
  quietEmpty = false,
}: {
  id: string;
  mode: ExerciseLoggingType;
  excludeWorkoutId?: string;
  onHistory: () => void;
  quietEmpty?: boolean;
}) {
  const { timezone, weightUnit, distanceUnit, durationUnit } =
    useMe().preferences;
  const query = useQuery({
    queryKey: ["fitness", "previous-session", id, excludeWorkoutId, mode],
    queryFn: () =>
      api.getExerciseReport(id, {
        loggingType: mode,
        limit: 1,
        excludeWorkoutId,
      }),
  });
  const last = query.data?.sessions.items[0];
  if (query.isPending)
    return <p className="muted text-small">Loading last session…</p>;
  if (query.error)
    return (
      <p className="error">
        Last session couldn’t load.{" "}
        <button
          type="button"
          className="fitness-text-action"
          onClick={() => void query.refetch()}
        >
          Retry history
        </button>
      </p>
    );
  if (!last && quietEmpty) return null;
  if (!last)
    return (
      <p className="muted text-small">
        No finished session recorded yet for this tracking type.
      </p>
    );
  const fields = exerciseTrackingFields[mode];
  return (
    <div className="fitness-previous-set fitness-inline-recall">
      <button type="button" className="fitness-text-action" onClick={onHistory}>
        Last time · {sessionDate(last.startedAt, timezone)}{" "}
        <span aria-hidden="true">→</span>
      </button>
      <p>
        {last.sets.slice(0, 3).map((set, index) => (
          <span key={set.id}>
            {index > 0 && " · "}Set {(set.position ?? index) + 1}:{" "}
            {fields
              .map((field) =>
                field === "load"
                  ? load(set.weightKg, weightUnit)
                  : field === "distance"
                    ? distance(set.distanceMeters, distanceUnit)
                    : field === "duration"
                      ? set.durationSeconds === null
                        ? "time not recorded"
                        : formatFitnessDuration(
                            set.durationSeconds,
                            durationUnit,
                          )
                      : set[field] === null
                        ? `${field} not recorded`
                        : `${set[field]} ${field}`,
              )
              .join(" × ")}
          </span>
        ))}
        {last.sets.length > 3 && ` · +${last.sets.length - 3} more sets`}
      </p>
    </div>
  );
}
