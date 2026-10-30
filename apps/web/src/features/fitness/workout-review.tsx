"use client";
import { workoutSeconds } from "@168hours/domain-utils";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ErrorState } from "@/components/ui/feedback";
import { workoutExerciseSummary } from "./workout-exercise-summary";
import type { WorkoutRecords } from "@168hours/contracts";
import { useId, useState } from "react";
import {
  Check,
  CircleCheck,
  ChevronDown,
  Info,
  SkipForward,
} from "lucide-react";
import { measurementsFor } from "@168hours/contracts";
import { useMe } from "@/features/identity/me";
import { TooltipButton } from "@/components/ui/tooltip-button";
import { useFitnessExercisePanel } from "./fitness-exercise-workspace";
import {
  actualExerciseSummary,
  summaryExerciseOutcome,
  summaryRecordHighlights,
} from "./workout-review-summary";
import { formatRestDuration, formatFitnessDuration } from "./rest-duration";
import { load, distance } from "./progress-shared";
import type { SessionDraft, ExerciseDraft, SetDraft } from "./strength-draft";

export function WorkoutReview({
  value,
  id,
  version,
}: {
  value: SessionDraft;
  id: string;
  version: number;
}) {
  const { preferences } = useMe();
  const records = useQuery({
    queryKey: ["fitness", "workout-records", id, version],
    queryFn: () => api.getWorkoutRecords(id),
  });
  const recordLabel = (record: WorkoutRecords["records"][number]) => {
    if (record.first)
      return record.metric === "repsAtWeight"
        ? `First result at ${load(record.weightKg, preferences.weightUnit)}`
        : "First recorded result";
    if (record.metric === "load") return "New record - heaviest weight";
    if (record.metric === "reps") return "New record - most reps";
    if (record.metric === "repsAtWeight")
      return `New record - most reps at ${load(record.weightKg, preferences.weightUnit)}`;
    return record.metric === "distance"
      ? "Longest recorded distance"
      : "Longest recorded duration";
  };
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const contentId = useId();
  const panel = useFitnessExercisePanel();
  const sets = value.exercises.flatMap((exercise) => exercise.sets);
  const completed = sets.filter((set) => set.completed && !set.skipped).length;
  const skipped = sets.filter((set) => set.skipped).length;
  const unfinished = sets.length - completed - skipped;
  const elapsed = Math.round(workoutSeconds(value));
  const pausedSeconds = value.endedAt
    ? Math.max(
        0,
        (Date.parse(value.endedAt) - Date.parse(value.startedAt)) / 1000 -
          workoutSeconds(value),
      )
    : 0;
  const performed = value.exercises.filter((exercise) =>
    exercise.sets.some((set) => set.completed && !set.skipped),
  ).length;
  const dateFormat = new Intl.DateTimeFormat("en", {
    timeZone: preferences.timezone,
    dateStyle: "long",
  });
  const timeFormat = new Intl.DateTimeFormat("en", {
    timeZone: preferences.timezone,
    timeStyle: "short",
  });
  const start = new Date(value.startedAt);
  const end = value.endedAt ? new Date(value.endedAt) : null;
  const allExpanded =
    value.exercises.length > 0 && expanded.size === value.exercises.length;
  const plannedSet = (exercise: ExerciseDraft, set: SetDraft) => {
    const keys = {
      reps: "targetReps",
      load: "targetWeightKg",
      duration: "targetDurationSeconds",
      distance: "targetDistanceMeters",
      laps: "targetLaps",
    } as const;
    return measurementsFor(
      set.measurementOverride ?? exercise.loggingType ?? "reps_load",
    ).every((field) => set[keys[field]] === null)
      ? "No targets set"
      : workoutExerciseSummary({ ...exercise, sets: [set] }, preferences);
  };
  const formatSet = (exercise: ExerciseDraft, set: SetDraft) =>
    measurementsFor(
      set.measurementOverride ?? exercise.loggingType ?? "reps_load",
    )
      .map((field) => {
        if (field === "load")
          return set.weightKg === null
            ? "Weight not recorded"
            : load(set.weightKg, preferences.weightUnit);
        if (field === "distance")
          return set.distanceMeters === null
            ? "Distance not recorded"
            : distance(set.distanceMeters, preferences.distanceUnit);
        if (field === "duration")
          return set.durationSeconds === null
            ? "Duration not recorded"
            : formatFitnessDuration(
                set.durationSeconds,
                preferences.durationUnit,
              );
        return set[field] === null
          ? `${field === "reps" ? "Reps" : "Laps"} not recorded`
          : `${set[field]} ${set[field] === 1 ? (field === "reps" ? "rep" : "lap") : field}`;
      })
      .join(" · ");
  return (
    <section className="fitness-review form-stack" aria-label="Workout results">
      <div className="fitness-summary-overview">
        <div className="fitness-summary-overview-heading">
          <div className="fitness-summary-title">
            <CircleCheck size={20} aria-hidden="true" />
            <h1>{value.title} - Summary</h1>
          </div>
          <div className="fitness-summary-date">
            <div>
              <p>
                <time dateTime={value.startedAt}>
                  {dateFormat.format(start)}
                </time>
              </p>
              <p className="muted">
                {timeFormat.format(start)}
                {end && (
                  <>
                    {" "}
                    –{" "}
                    {dateFormat.format(end) !== dateFormat.format(start) &&
                      `${dateFormat.format(end)}, `}
                    {timeFormat.format(end)}
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
        <dl className="fitness-summary-stats" aria-label="Workout overview">
          <div>
            <dt>Workout time</dt>
            <dd>
              {formatRestDuration(elapsed)}
              <span className="fitness-summary-stat-hint">
                {pausedSeconds > 0
                  ? "Includes rest, excludes pauses"
                  : "Includes rest"}
              </span>
            </dd>
          </div>
          <div>
            <dt>Exercises performed</dt>
            <dd>
              {performed}
              <small> / {value.exercises.length}</small>
            </dd>
          </div>
          <div>
            <dt>Sets completed</dt>
            <dd>
              {completed}
              <small> / {sets.length}</small>
            </dd>
          </div>
        </dl>
        {pausedSeconds > 0 && (
          <dl
            className="fitness-summary-timing"
            aria-label="Workout time breakdown"
          >
            <div>
              <dt>Total elapsed time</dt>
              <dd>{formatRestDuration(elapsed + pausedSeconds)}</dd>
            </div>
            <div>
              <dt>Time paused</dt>
              <dd>{formatRestDuration(pausedSeconds)}</dd>
            </div>
          </dl>
        )}
        {(skipped > 0 || unfinished > 0) && (
          <p className="fitness-summary-incomplete">
            {[
              skipped
                ? `${skipped} skipped ${skipped === 1 ? "set" : "sets"}`
                : "",
              unfinished
                ? `${unfinished} unfinished ${unfinished === 1 ? "set" : "sets"}`
                : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}
      </div>
      {records.error && (
        <ErrorState
          error={records.error}
          retry={() => void records.refetch()}
        />
      )}
      {records.isPending && (
        <p className="muted text-small" role="status">
          Checking personal records…
        </p>
      )}
      {value.notes && (
        <section
          className="fitness-live-workout-notes"
          aria-label="Workout notes"
        >
          <h2>Workout notes</h2>
          <p>{value.notes}</p>
        </section>
      )}
      <div className="fitness-summary-section-heading">
        <h2>Exercises</h2>
        {value.exercises.length > 0 && (
          <button
            className="button"
            type="button"
            onClick={() =>
              setExpanded(
                allExpanded
                  ? new Set()
                  : new Set(value.exercises.map((_, index) => index)),
              )
            }
          >
            {allExpanded ? "Hide all sets" : "Show all sets"}
          </button>
        )}
      </div>
      <div className="fitness-review-exercises">
        {value.exercises.map((exercise, index) => {
          const outcome = summaryExerciseOutcome(exercise);
          const highlights = summaryRecordHighlights(
            exercise,
            records.data?.records ?? [],
          );
          return (
            <section
              className="fitness-review-exercise"
              key={exercise.clientKey ?? exercise.id ?? index}
              aria-label={`${exercise.name} results ${index + 1}`}
            >
              <div className="fitness-summary-exercise-heading">
                <button
                  type="button"
                  className="fitness-summary-exercise-toggle"
                  aria-expanded={expanded.has(index)}
                  aria-controls={`${contentId}-${index}`}
                  onClick={() =>
                    setExpanded((previous) => {
                      const next = new Set(previous);
                      if (next.has(index)) next.delete(index);
                      else next.add(index);
                      return next;
                    })
                  }
                >
                  <span>
                    <span className="fitness-summary-exercise-name">
                      <strong>{exercise.name}</strong>
                      <ChevronDown size={16} aria-hidden="true" />
                    </span>
                    <span className="fitness-review-result">
                      {outcome ??
                        `Recorded: ${actualExerciseSummary(exercise, preferences)}`}
                    </span>
                    {highlights.length > 0 && (
                      <span className="fitness-summary-highlights">
                        {highlights.map((highlight) => (
                          <span
                            key={highlight.label}
                            className="fitness-summary-record"
                            data-first={highlight.first}
                            data-performance={highlight.performance}
                          >
                            {highlight.label}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                  <span className="fitness-summary-exercise-count">
                    {
                      exercise.sets.filter(
                        (set) => set.completed && !set.skipped,
                      ).length
                    }
                    /{exercise.sets.length} sets completed
                  </span>
                </button>
                <TooltipButton
                  className="icon-button fitness-summary-exercise-info"
                  tooltip="Exercise details"
                  aria-label={`Help with ${exercise.name}`}
                  onClick={() => panel.help(exercise.exerciseId)}
                >
                  <Info size={18} aria-hidden="true" />
                </TooltipButton>
              </div>
              <div
                id={`${contentId}-${index}`}
                className="fitness-review-set-list"
                hidden={!expanded.has(index)}
              >
                {exercise.notes && (
                  <p className="muted fitness-review-note">{exercise.notes}</p>
                )}
                <ol aria-label={`${exercise.name} recorded sets`}>
                  {exercise.sets.map((set, i) => (
                    <li
                      key={set.clientKey ?? set.id ?? i}
                      data-state={
                        set.skipped
                          ? "skipped"
                          : set.completed
                            ? "completed"
                            : "unfinished"
                      }
                    >
                      <span className="fitness-summary-set-number">
                        {set.skipped ? (
                          <SkipForward size={16} aria-hidden="true" />
                        ) : set.completed ? (
                          <Check size={16} aria-hidden="true" />
                        ) : null}
                        Set {i + 1}
                      </span>
                      <span className="fitness-summary-set-results">
                        <span className="fitness-summary-set-actual">
                          {set.skipped
                            ? "Skipped"
                            : set.completed
                              ? formatSet(exercise, set)
                              : "Unfinished"}
                        </span>
                        <span className="muted text-small">
                          Planned: {plannedSet(exercise, set)}
                        </span>
                        {records.data?.records
                          .filter((record) => record.setId === set.id)
                          .filter(
                            (record, index, all) =>
                              !record.first ||
                              all.findIndex((candidate) => candidate.first) ===
                                index,
                          )
                          .map((record) => (
                            <span
                              className="fitness-summary-record"
                              data-first={record.first}
                              data-performance={
                                record.metric !== "duration" &&
                                record.metric !== "distance"
                              }
                              key={record.metric}
                            >
                              {recordLabel(record)}
                            </span>
                          ))}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          );
        })}
      </div>
    </section>
  );
}
