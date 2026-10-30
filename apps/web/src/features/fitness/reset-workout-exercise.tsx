"use client";
import { createPortal } from "react-dom";
import { Dialog } from "@/components/ui/dialog";
import { basicResetProposal } from "./workout-basic-settings";
import type { ExerciseDraft } from "./strength-draft";

export function ResetWorkoutExercise({
  exercise,
  disabled,
  onCancel,
  onConfirm,
}: {
  exercise: ExerciseDraft;
  disabled: boolean;
  onCancel: () => void;
  onConfirm: (exercise: ExerciseDraft) => void;
}) {
  const proposal = basicResetProposal(exercise);
  const targetLabels = {
    targetReps: "reps",
    targetWeightKg: "weight",
    targetDurationSeconds: "duration",
    targetDistanceMeters: "distance",
    targetLaps: "laps",
  } as const;
  const cleared: string[] = Object.entries(targetLabels)
    .filter(([key]) =>
      exercise.sets.some((set, index) => {
        const field = key as keyof typeof targetLabels;
        return set[field] !== null && proposal.sets[index]?.[field] === null;
      }),
    )
    .map(([, label]) => label);
  const clearsRest = exercise.sets.some(
    (set, index) =>
      set.restSeconds !== null && proposal.sets[index]?.restSeconds === null,
  );
  const clearedSummary = [
    cleared.length ? `${cleared.join(", ")} targets` : null,
    clearsRest ? "rest times" : null,
  ]
    .filter(Boolean)
    .join("; ");
  const resetsMeasurements = exercise.sets.some(
    (set) => !!set.measurementOverride,
  );
  return createPortal(
    <Dialog title="Reset to basic?" onClose={onCancel}>
      <div className="fitness-reset-confirmation">
        {clearedSummary && (
          <p>
            Will clear: <strong>{clearedSummary}</strong>.
          </p>
        )}
        {resetsMeasurements && (
          <p>Custom measurements will return to exercise defaults.</p>
        )}
        <p>
          Matching targets for selected measurements and matching rest times
          stay.
        </p>
        <div className="fitness-reset-actions">
          <button
            type="button"
            className="button"
            disabled={disabled}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="button primary"
            disabled={disabled}
            onClick={() => onConfirm(proposal)}
          >
            Reset to basic
          </button>
        </div>
      </div>
    </Dialog>,
    document.body,
  );
}
