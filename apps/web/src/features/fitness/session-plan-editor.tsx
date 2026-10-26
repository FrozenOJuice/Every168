"use client";

import { Plus } from "lucide-react";
import { useFitnessExercisePanel } from "./fitness-exercise-workspace";
import { StrengthExercises } from "./strength-exercises";
import type { ExerciseDraft } from "./strength-draft";

export function SessionPlanEditor({
  value,
  onChange,
  sessionId,
  disabled,
  errors,
}: {
  value: ExerciseDraft[];
  onChange: (value: ExerciseDraft[]) => void;
  sessionId: string;
  disabled: boolean;
  errors?: Record<string, string>;
}) {
  const panel = useFitnessExercisePanel();
  return (
    <section
      className="fitness-session-plan-editor"
      aria-label="Edit current workout"
    >
      <header className="fitness-session-plan-heading">
        <div>
          <h2>Exercises and targets</h2>
          <p>This session only · changes save automatically.</p>
        </div>
        <button
          type="button"
          className="button"
          data-add-exercise
          disabled={disabled || value.length >= 50}
          onClick={() => panel.pick()}
        >
          <Plus size={16} aria-hidden="true" />
          Add exercise
        </button>
      </header>
      <StrengthExercises
        errors={errors}
        building
        initiallyCollapsed
        sessionId={sessionId}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    </section>
  );
}
