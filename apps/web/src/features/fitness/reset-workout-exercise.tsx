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
  return createPortal(
    <Dialog title={`Reset ${exercise.name} to basic?`} onClose={onCancel}>
      <div className="fitness-reset-confirmation">
        <p>Keep shared values and clear custom set settings.</p>
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
            onClick={() => onConfirm(basicResetProposal(exercise))}
          >
            Reset to basic
          </button>
        </div>
      </div>
    </Dialog>,
    document.body,
  );
}
