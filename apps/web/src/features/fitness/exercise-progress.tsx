"use client";
import { formatFitnessDuration } from "./rest-duration";
import { measurementsFor, measurementSetKey } from "@168hours/contracts";
import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { ExerciseLoggingType, ExerciseReport } from "@168hours/contracts";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { ErrorState, Loading, PageHeading } from "@/components/ui/feedback";
import { number } from "@/lib/format";
import { progressSessionSummary } from "./workout-review-summary";
import { useRestoreExerciseWorkoutPosition } from "./exercise-workout-position";
import { WorkoutReference } from "./workout-reference";
import { WeightRecords } from "./weight-records";
import { RecordedSets } from "./recorded-sets";
import { MeasurementFields } from "./measurement-fields";
import { load, distance } from "./progress-shared";

export function ExerciseProgressPage({
  id,
  initialMode,
  embedded = false,
  recordsOnly = false,
  nested = false,
  onReady,
}: {
  id: string;
  initialMode?: ExerciseLoggingType;
  embedded?: boolean;
  recordsOnly?: boolean;
  nested?: boolean;
  onReady?: () => void;
}) {
  const {
    preferences: { weightUnit: unit, distanceUnit, durationUnit },
  } = useMe();
  const root = useRef<HTMLDivElement>(null);
  const SectionHeading = nested ? "h4" : embedded ? "h3" : "h2";
  const [mode, setMode] = useState<ExerciseLoggingType | undefined>(
    initialMode,
  );
  const q = useInfiniteQuery({
    queryKey: ["fitness", "exercise-report", id, "all"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.getExerciseReport(id, {
        allMeasurements: "true",
        cursor: pageParam,
        limit: 6,
      }),
    getNextPageParam: (p) => p.sessions.nextCursor ?? undefined,
  });
  useLayoutEffect(() => {
    if (!q.isPending) onReady?.();
  }, [q.isPending, onReady]);
  useRestoreExerciseWorkoutPosition(
    id,
    !recordsOnly && !q.isPending && !!q.data,
    root,
  );
  if (q.isPending) return <Loading />;
  if (!q.data)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  const data = q.data.pages[0]!;
  const sessions = q.data.pages.flatMap((p) => p.sessions.items);
  const displayMode =
    mode ??
    measurementSetKey(
      data.availableMeasurementTypes.length
        ? [...new Set(data.availableMeasurementTypes.flatMap(measurementsFor))]
        : measurementsFor(data.loggingType),
    );
  const fields = measurementsFor(displayMode);
  const origin = { exerciseId: id, mode: displayMode };
  const records = data.records
    .filter(
      (record) =>
        record.metric !== "setVolume" &&
        record.metric !== "laps" &&
        fields.includes(record.metric),
    )
    .sort(
      (a, b) =>
        ["load", "reps", "distance", "duration"].indexOf(a.metric) -
        ["load", "reps", "distance", "duration"].indexOf(b.metric),
    );
  const titles = {
    load: "Heaviest weight",
    reps: "Most reps in a set",
    duration: "Longest recorded duration",
    setVolume: "Highest set volume",
    distance: "Longest recorded distance",
    laps: "Most laps",
  };
  const recordValue = (record: ExerciseReport["records"][number]) =>
    record.metric === "load"
      ? load(record.value, unit)
      : record.metric === "distance"
        ? distance(record.value, distanceUnit)
        : record.metric === "duration"
          ? formatFitnessDuration(record.value, durationUnit)
          : `${number(record.value)} ${record.value === 1 ? "rep" : "reps"}`;
  const recordContext = (record: ExerciseReport["records"][number]) => {
    if (record.metric === "load" && record.reps !== null)
      return `${record.reps} ${record.reps === 1 ? "rep" : "reps"}`;
    if (record.metric === "reps" && record.weightKg !== null)
      return `at ${load(record.weightKg, unit)}`;
    if (record.metric === "distance" && record.durationSeconds !== null)
      return `in ${formatFitnessDuration(record.durationSeconds, durationUnit)}`;
    if (record.metric === "duration" && record.distanceMeters !== null)
      return `over ${distance(record.distanceMeters, distanceUnit)}`;
    return null;
  };
  return (
    <div ref={root} className="fitness-progress-page form-stack">
      {!embedded && !recordsOnly && (
        <Link className="fitness-back" href="/fitness/history">
          <ArrowLeft size={16} aria-hidden="true" />
          Back to History
        </Link>
      )}
      {!embedded && !recordsOnly && (
        <PageHeading
          title={`${data.exercise.name} history`}
          description="Completed sets from finished workouts. Open a result to review its session."
        />
      )}
      {data.exercise.archivedAt && (
        <p className="muted">
          This exercise is archived. Its progress remains available.
        </p>
      )}
      {!sessions.length ? (
        <ExerciseHistoryEmpty embedded={embedded} nested={nested} />
      ) : (
        <>
          {!recordsOnly && (
            <MeasurementFields
              label="Show measurements"
              value={displayMode}
              onChange={setMode}
            />
          )}
          {!recordsOnly && (
            <section
              className="fitness-recall-section form-stack"
              aria-labelledby="last-session-heading"
            >
              <div className="fitness-history-section-heading">
                <SectionHeading id="last-session-heading">
                  Latest session
                </SectionHeading>
                {sessions[0] && (
                  <WorkoutReference
                    origin={origin}
                    id={sessions[0].id}
                    title={sessions[0].title}
                    startedAt={sessions[0].startedAt}
                  />
                )}
              </div>
              {sessions[0] ? (
                <>
                  <RecordedSets
                    sets={sessions[0].sets}
                    visibleMeasurements={fields}
                  />
                  {sessions[0].exerciseNotes?.map((note, index) => (
                    <p className="fitness-review-note" key={index}>
                      {note}
                    </p>
                  ))}
                  {sessions[0].notes && (
                    <p className="muted fitness-review-note">
                      Workout notes: {sessions[0].notes}
                    </p>
                  )}
                </>
              ) : (
                <p>No finished sessions for this exercise yet.</p>
              )}
            </section>
          )}
          <section
            className="form-stack fitness-exercise-records"
            aria-labelledby="records-heading"
          >
            <SectionHeading id="records-heading">
              Personal records
            </SectionHeading>
            {!records.length ? (
              <p>No records yet for the selected measurements.</p>
            ) : (
              <ul className="fitness-progress-records">
                {records.map((r) => (
                  <li key={r.metric}>
                    <span>{titles[r.metric]}</span>
                    <div className="fitness-exercise-record-result">
                      <strong>{recordValue(r)}</strong>
                      {recordContext(r) && (
                        <span className="muted">· {recordContext(r)}</span>
                      )}
                    </div>
                    <WorkoutReference
                      origin={origin}
                      id={r.workoutId}
                      title={r.workoutTitle}
                      startedAt={r.startedAt}
                    />
                  </li>
                ))}
              </ul>
            )}
            {fields.includes("reps") && fields.includes("load") && (
              <WeightRecords
                id={id}
                origin={origin}
                heading={nested ? "h5" : embedded ? "h4" : "h3"}
              />
            )}
          </section>
          {!recordsOnly && sessions.length > 0 && (
            <section
              className="form-stack"
              aria-labelledby="previous-sessions-heading"
            >
              <SectionHeading id="previous-sessions-heading">
                All sessions
              </SectionHeading>
              <ul className="fitness-exercise-session-list">
                {sessions.map((session) => (
                  <li className="fitness-session-history" key={session.id}>
                    <WorkoutReference
                      origin={origin}
                      id={session.id}
                      title={session.title}
                      startedAt={session.startedAt}
                      showTime
                      summary={progressSessionSummary(data.exercise, session, {
                        weightUnit: unit,
                        distanceUnit,
                        durationUnit,
                      })}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {q.error && q.data && (
            <div role="alert">
              <p className="error">
                {q.isFetchNextPageError
                  ? "Could not load older sessions. Your loaded history is still available."
                  : "Could not refresh history. Showing the last loaded results."}
              </p>
              {!q.isFetchNextPageError && (
                <button className="button" onClick={() => void q.refetch()}>
                  Retry refresh
                </button>
              )}
            </div>
          )}
          {!recordsOnly && q.hasNextPage && (
            <button
              className="button"
              disabled={q.isFetchingNextPage}
              onClick={() => void q.fetchNextPage()}
            >
              {q.isFetchingNextPage
                ? "Loading…"
                : q.isFetchNextPageError
                  ? "Retry older sessions"
                  : "Load older sessions"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

export function ExerciseHistoryEmpty({
  embedded = false,
  nested = false,
}: {
  embedded?: boolean;
  nested?: boolean;
}) {
  const Heading = nested ? "h4" : embedded ? "h3" : "h2";
  return (
    <div className="fitness-history-empty">
      <Heading>No workout history yet</Heading>
      <p className="muted">
        Finish a workout with this exercise to see your sets and records here.
      </p>
    </div>
  );
}
