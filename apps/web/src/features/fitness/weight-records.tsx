"use client";
import { useInfiniteQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { ErrorState, Loading } from "@/components/ui/feedback";
import { number } from "@/lib/format";
import type { ExerciseWorkoutOrigin } from "./exercise-workout-return";
import { WorkoutReference } from "./workout-reference";
import { load } from "./progress-shared";

export function WeightRecords({
  id,
  heading = "h4",
  origin,
}: {
  id: string;
  heading?: "h3" | "h4" | "h5";
  origin?: ExerciseWorkoutOrigin;
}) {
  const Heading = heading;
  const { weightUnit } = useMe().preferences;
  const q = useInfiniteQuery({
    queryKey: ["fitness", "weight-records", id],
    initialPageParam: undefined as number | undefined,
    queryFn: ({ pageParam }) =>
      api.getExerciseWeightRecords(id, { beforeWeight: pageParam }),
    getNextPageParam: (page) => page.nextWeight ?? undefined,
  });
  return (
    <section
      className="fitness-weight-record-section form-stack"
      aria-label="Reps by weight"
    >
      <Heading>Reps by weight</Heading>
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => void q.refetch()} />
      ) : (
        <>
          {!q.data.pages[0]?.items.length ? (
            <p>No sets with both reps and weight recorded yet.</p>
          ) : (
            <div className="fitness-weight-record-list">
              <div
                className="fitness-weight-record-columns muted text-small"
                aria-hidden="true"
              >
                <span>Weight</span>
                <span>Best reps in one set</span>
                <span>Total reps all time</span>
                <span>Best reps achieved</span>
              </div>
              <ul className="fitness-weight-records">
                {q.data.pages
                  .flatMap((page) => page.items)
                  .map((record) => (
                    <li key={record.weightKg}>
                      <div className="fitness-weight-record-row">
                        <strong>
                          <span className="sr-only">Weight: </span>
                          {load(record.weightKg, weightUnit)}
                        </strong>
                        <span className="fitness-weight-record-number">
                          <span className="sr-only">
                            Best reps in one set:{" "}
                          </span>
                          <span
                            className="fitness-weight-record-label"
                            aria-hidden="true"
                          >
                            Best in one set
                          </span>
                          <span>
                            {number(record.reps)}{" "}
                            {record.reps === 1 ? "rep" : "reps"}
                          </span>
                        </span>
                        <span className="fitness-weight-record-number fitness-weight-record-total">
                          <span className="sr-only">Total reps all time: </span>
                          <span
                            className="fitness-weight-record-label"
                            aria-hidden="true"
                          >
                            All-time total
                          </span>
                          <span>
                            {number(record.totalReps)}{" "}
                            {record.totalReps === 1 ? "rep" : "reps"}
                          </span>
                        </span>
                        <WorkoutReference
                          label="Best reps achieved"
                          origin={origin}
                          id={record.workoutId}
                          title={record.workoutTitle}
                          startedAt={record.startedAt}
                        />
                      </div>
                    </li>
                  ))}
              </ul>
            </div>
          )}
          {q.hasNextPage && (
            <button
              type="button"
              className="button"
              disabled={q.isFetchingNextPage}
              onClick={() => void q.fetchNextPage()}
            >
              {q.isFetchingNextPage ? "Loading…" : "Show more weights"}
            </button>
          )}
        </>
      )}
    </section>
  );
}
