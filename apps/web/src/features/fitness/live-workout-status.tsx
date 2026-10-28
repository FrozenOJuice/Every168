"use client";
import { useEffect, useState, type ReactNode } from "react";
import type { ExerciseDraft } from "./strength-draft";

export function LiveWorkoutStatus({
  startedAt,
  exercises,
  children,
}: {
  startedAt: string;
  exercises: ExerciseDraft[];
  children: ReactNode;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000));
  const hours = Math.floor(seconds / 3600);
  const elapsed = `${hours ? `${hours}:` : ""}${String(Math.floor(seconds / 60) % 60).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const sets = exercises.flatMap((exercise) => exercise.sets);
  const completed = sets.filter((set) => set.completed).length;
  const skipped = sets.filter((set) => set.skipped).length;
  const remaining = sets.length - completed - skipped;
  return (
    <div className="fitness-live-status">
      <div className="fitness-live-status-summary">
        <span role="timer" aria-label="Workout elapsed time">
          {elapsed} <span className="muted">elapsed</span>
        </span>
        <span>
          {completed}/{sets.length} sets completed
          {skipped ? ` · ${skipped} skipped` : ""} · {remaining} left
        </span>
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
