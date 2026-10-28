"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { NotesEditor } from "./notes-editor";
import { StrengthExercises } from "./strength-exercises";
import { useFitnessExercisePanel } from "./fitness-exercise-workspace";

type SetupProps = {
  name: string;
  notes: string | null;
  onNameChange: (name: string) => void;
  onNotesChange: (notes: string | null) => void;
  notesOpen: boolean;
  onNotesOpenChange: (open: boolean) => void;
  disabled: boolean;
  errors?: Record<string, string>;
  timing?: ReactNode;
};

export function WorkoutEditorSetup({
  name,
  notes,
  onNameChange,
  onNotesChange,
  notesOpen,
  onNotesOpenChange,
  disabled,
  errors = {},
  timing,
}: SetupProps) {
  const titleId = useId();
  return (
    <section className="fitness-builder-setup" aria-label="Workout settings">
      <fieldset className="form-stack" disabled={disabled}>
        <div className="field">
          <label htmlFor={titleId}>Workout name</label>
          <input
            id={titleId}
            maxLength={160}
            value={name}
            disabled={disabled}
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? `${titleId}-error` : undefined}
            onChange={(event) => onNameChange(event.target.value)}
          />
          {errors.title && (
            <p id={`${titleId}-error`} className="error" role="alert">
              {errors.title}
            </p>
          )}
        </div>
        <NotesEditor
          label="Workout notes"
          value={notes}
          open={notesOpen}
          onOpenChange={onNotesOpenChange}
          disabled={disabled}
          error={errors.notes}
          onChange={onNotesChange}
        />
        {timing}
      </fieldset>
    </section>
  );
}

export function WorkoutEditor({
  mode,
  heading,
  backLabel,
  onBack,
  backDisabled,
  headerActions,
  notices,
  context,
  footer,
  exercises,
  ...setup
}: SetupProps & {
  mode: "create" | "saved" | "session";
  heading: string;
  backLabel: string;
  onBack: () => void;
  backDisabled?: boolean;
  headerActions?: ReactNode;
  notices?: ReactNode;
  context?: ReactNode;
  footer: ReactNode;
  exercises: Omit<ComponentProps<typeof StrengthExercises>, "building">;
}) {
  const panel = useFitnessExercisePanel();
  return (
    <>
      <div className="fitness-builder-scroll">
        <header className="fitness-builder-heading">
          <div className="fitness-builder-heading-navigation">
            <button
              type="button"
              className="fitness-text-action"
              disabled={backDisabled ?? setup.disabled}
              onClick={onBack}
            >
              <ArrowLeft size={16} aria-hidden="true" />
              {backLabel}
            </button>
            {headerActions}
          </div>
          <h1 className="sr-only">{heading}</h1>
        </header>
        {notices}
        <WorkoutEditorSetup {...setup} />
        {context}
        <div
          className="fitness-builder-exercises"
          role="region"
          aria-label={
            mode === "session" ? "Edit current workout" : "Workout exercises"
          }
          tabIndex={0}
        >
          <header className="fitness-session-plan-heading">
            <h2>Exercises</h2>
            <button
              type="button"
              className="button"
              data-validation-error={!!setup.errors?.exercises}
              data-add-exercise
              disabled={setup.disabled || exercises.value.length >= 50}
              onClick={() => panel.pick()}
            >
              <Plus size={16} aria-hidden="true" />
              Add exercise
            </button>
          </header>
          <StrengthExercises {...exercises} building />
        </div>
      </div>
      <footer className="fitness-builder-footer">{footer}</footer>
    </>
  );
}
