"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Pause, Play } from "lucide-react";
import { workoutSeconds, type WorkoutTiming } from "@168hours/domain-utils";
import type { ExerciseDraft } from "./strength-draft";

export function LiveWorkoutStatus({
  timing,
  onTogglePause,
  pauseDisabled,
  exercises,
  children,
  onFinish,
  finishDisabled,
  finishLabel,
}: {
  timing: WorkoutTiming;
  onTogglePause: () => void;
  pauseDisabled: boolean;
  exercises: ExerciseDraft[];
  children: ReactNode;
  onFinish: () => void;
  finishDisabled: boolean;
  finishLabel: string;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const paused = timing.pauses?.at(-1)?.endsAt === null;
  const seconds = Math.floor(workoutSeconds(timing, now));
  const hours = Math.floor(seconds / 3600);
  const elapsed = `${hours ? `${hours}:` : ""}${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const sets = exercises.flatMap((exercise) => exercise.sets);
  const completed = sets.filter((set) => set.completed).length;
  const skipped = sets.filter((set) => set.skipped).length;
  const remaining = sets.length - completed - skipped;
  const readyToFinish = remaining === 0 && completed > 0;
  return (
    <div className="fitness-live-status">
      <div className="fitness-live-status-header">
        <div className="fitness-live-status-time">
          <div className="fitness-live-status-caption">
            <span className="fitness-live-status-label">Workout time</span>
            <span
              className="fitness-live-state"
              role="status"
              aria-label="Workout status"
              data-paused={paused}
            >
              {paused ? "Paused" : "In progress"}
            </span>
          </div>
          <strong role="timer" aria-label="Workout elapsed time">
            {elapsed}
          </strong>
        </div>
        <div
          className="fitness-live-status-actions"
          role="group"
          aria-label="Workout controls"
        >
          <button
            type="button"
            className={`button${paused && !readyToFinish ? " primary" : ""}`}
            disabled={pauseDisabled}
            onClick={onTogglePause}
            aria-label={paused ? "Resume workout" : "Pause workout"}
          >
            {paused ? (
              <Play size={16} aria-hidden="true" />
            ) : (
              <Pause size={16} aria-hidden="true" />
            )}
            {paused ? "Resume" : "Pause"}
          </button>
          <button
            type="button"
            className={`button${readyToFinish ? " primary" : ""}`}
            aria-label={
              finishLabel === "Finish" ? "Finish workout" : finishLabel
            }
            data-finish-workout
            disabled={finishDisabled}
            onClick={onFinish}
          >
            {finishLabel}
          </button>
        </div>
      </div>
      <div className="fitness-live-status-summary">
        <span className="fitness-live-status-counts">
          {completed}/{sets.length} sets completed
          {skipped ? ` · ${skipped} skipped` : ""}
        </span>
        <span>{remaining} left</span>
      </div>
      <progress
        aria-label="Workout sets handled"
        value={completed + skipped}
        max={Math.max(1, sets.length)}
      />
      {children}
    </div>
  );
}
