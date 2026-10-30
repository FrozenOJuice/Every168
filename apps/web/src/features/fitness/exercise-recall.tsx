"use client";
import { useQuery } from "@tanstack/react-query";
import type { ExerciseLoggingType } from "@168hours/contracts";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { sessionDate } from "./progress-shared";
import { progressSessionSummary } from "./workout-review-summary";

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
  const { preferences } = useMe();
  const { timezone } = preferences;
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
          className="button"
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
  const summary = progressSessionSummary(
    query.data.exercise,
    last,
    preferences,
  );
  return (
    <section
      className="fitness-previous-set fitness-inline-recall"
      aria-label="Previous session"
    >
      <div className="fitness-inline-recall-copy">
        <div className="fitness-inline-recall-caption">
          <span>Previous session</span>
          <time dateTime={last.startedAt}>
            {sessionDate(last.startedAt, timezone)}
          </time>
        </div>
        <strong>{summary}</strong>
      </div>
      <button type="button" className="button" onClick={onHistory}>
        View history
      </button>
    </section>
  );
}
