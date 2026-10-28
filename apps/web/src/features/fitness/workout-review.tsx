"use client";
import { useState } from "react";
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
import { actualExerciseSummary } from "./workout-review-summary";
import { formatRestDuration, formatFitnessDuration } from "./rest-duration";
import { load, distance } from "./progress-shared";
import type { SessionDraft, ExerciseDraft, SetDraft } from "./strength-draft";

export function WorkoutReview({ value }: { value: SessionDraft }) {
  const { preferences } = useMe();
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const panel = useFitnessExercisePanel();
  const sets = value.exercises.flatMap((exercise) => exercise.sets);
  const completed = sets.filter((set) => set.completed && !set.skipped).length;
  const skipped = sets.filter((set) => set.skipped).length;
  const unfinished = sets.length - completed - skipped;
  const elapsed = value.endedAt
    ? Math.max(
        0,
        Math.round(
          (Date.parse(value.endedAt) - Date.parse(value.startedAt)) / 1000,
        ),
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
  const formatSet = (exercise: ExerciseDraft, set: SetDraft) =>
    measurementsFor(
      set.measurementOverride ?? exercise.loggingType ?? "reps_load",
    )
      .map((field) => {
        if (field === "load")
          return set.weightKg === null
            ? "Load not recorded"
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
                )}{" "}
                · {preferences.timezone}
              </p>
            </div>
          </div>
        </div>
        <dl className="fitness-summary-stats" aria-label="Workout overview">
          <div>
            <dt>Duration</dt>
            <dd>
              {formatRestDuration(elapsed)}
              <span className="fitness-summary-stat-hint">Includes rest</span>
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
      {value.notes && (
        <section className="fitness-summary-notes">
          <h2>Workout notes</h2>
          <p className="fitness-review-note">{value.notes}</p>
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
        {value.exercises.map((exercise, index) => (
          <section
            className="fitness-review-exercise"
            key={exercise.clientKey ?? exercise.id ?? index}
            aria-label={`${exercise.name} results ${index + 1}`}
          >
            <details
              open={expanded.has(index)}
              onToggle={(event) => {
                const open = event.currentTarget.open;
                setExpanded((previous) => {
                  if (previous.has(index) === open) return previous;
                  const next = new Set(previous);
                  if (open) next.add(index);
                  else next.delete(index);
                  return next;
                });
              }}
            >
              <summary>
                <span>
                  <span className="fitness-summary-exercise-name">
                    <strong>{exercise.name}</strong>
                    <ChevronDown size={16} aria-hidden="true" />
                  </span>
                  <span className="fitness-review-result">
                    Recorded: {actualExerciseSummary(exercise, preferences)}
                  </span>
                </span>
                <span className="fitness-summary-exercise-count">
                  {
                    exercise.sets.filter((set) => set.completed && !set.skipped)
                      .length
                  }
                  /{exercise.sets.length} sets completed
                </span>
              </summary>
              <div className="fitness-review-set-list">
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
                      <span>
                        {set.skipped
                          ? "Skipped"
                          : set.completed
                            ? formatSet(exercise, set)
                            : "Unfinished"}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </details>
            <TooltipButton
              className="icon-button"
              tooltip="Exercise details"
              aria-label={`Help with ${exercise.name}`}
              onClick={() => panel.help(exercise.exerciseId)}
            >
              <Info size={18} aria-hidden="true" />
            </TooltipButton>
          </section>
        ))}
      </div>
    </section>
  );
}
