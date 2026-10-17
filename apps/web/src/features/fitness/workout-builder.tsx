"use client";
import { useMe } from "@/features/identity/me";
import { useWorkoutBuilderRecovery } from "./workout-builder-recovery";
import { NotesField } from "./notes-field";
import { useState, useRef, useId } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Dialog } from "@/components/ui/dialog";
import { strengthPlanInput, type StrengthPlan } from "@168hours/contracts";
import { api } from "@/lib/api";
import { useCommand, CommandError } from "@/lib/use-command";
import { Loading, ErrorState } from "@/components/ui/feedback";
import { StrengthExercises } from "./strength-exercises";
import { emptySet, planExercises, planInput } from "./strength-draft";
import { invalidateFitness } from "./fitness-cache";
export function WorkoutBuilderPage({
  id,
  exerciseId,
}: {
  id: string;
  exerciseId?: string;
}) {
  const { user } = useMe();
  const seed = useQuery({
    queryKey: ["fitness", "exercise", exerciseId],
    queryFn: () => api.getExercise(exerciseId!),
    enabled: id === "new" && !!exerciseId,
  });
  const query = useQuery({
    queryKey: ["fitness", "workout", id],
    queryFn: () => api.getStrengthPlan(id),
    enabled: id !== "new",
  });
  if (id === "new" && exerciseId && seed.isPending) return <Loading />;
  if (id === "new" && exerciseId && seed.error)
    return <ErrorState error={seed.error} retry={() => void seed.refetch()} />;
  if (id !== "new" && query.isPending) return <Loading />;
  if (id !== "new" && query.error)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  return (
    <WorkoutBuilder
      key={`${user.id}:${id}:${query.data?.version ?? "new"}`}
      plan={query.data}
      initialExercise={id === "new" ? seed.data : undefined}
    />
  );
}
function WorkoutBuilder({
  plan,
  initialExercise,
}: {
  plan?: StrengthPlan;
  initialExercise?: import("@168hours/contracts").Exercise;
}) {
  const { user } = useMe();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const titleId = useId();
  const cache = useQueryClient();
  const [initialExercises] = useState(() =>
    initialExercise
      ? [
          {
            clientKey: crypto.randomUUID(),
            exerciseId: initialExercise.id,
            name: initialExercise.name,
            loggingType: initialExercise.loggingType,
            notes: null,
            sets: [emptySet()],
          },
        ]
      : planExercises(plan),
  );
  const [notesOpen, setNotesOpen] = useState(!!plan?.notes);
  const [cancelling, setCancelling] = useState(false);
  const [baseline] = useState(() =>
    JSON.stringify(
      planInput(plan?.title ?? "", plan?.notes ?? null, planExercises(plan)),
    ),
  );
  const recovery = useWorkoutBuilderRecovery(
    `168hours:workout-builder:${user.id}:${plan?.id ?? "new"}`,
    {
      title: plan?.title ?? "",
      notes: plan?.notes ?? "",
      exercises: initialExercises,
    },
    baseline,
    plan?.version ?? null,
  );
  const { title, notes, exercises } = recovery.draft;
  const [wasRecovered, setWasRecovered] = useState(false);
  if (wasRecovered !== recovery.recovered) {
    setWasRecovered(recovery.recovered);
    if (recovery.recovered) setNotesOpen(!!notes);
  }
  const input = planInput(title, notes || null, exercises);
  const dirty = JSON.stringify(input) !== baseline;
  const [validationMode, setValidationMode] = useState<boolean | null>(null);
  const errors =
    validationMode === null ? {} : workoutFieldErrors(input, validationMode);
  const error = Object.values(errors).find(Boolean);
  // Once all reported problems are resolved, wait for Save before validating new edits.
  if (validationMode !== null && !error) setValidationMode(null);
  const leave = () => router.push("/fitness");
  const saved = () => {
    recovery.clear();
    invalidateFitness(cache);
    leave();
  };
  const save = useCommand({
    mutationFn: (
      v: { input: ReturnType<typeof planInput>; asCopy: boolean },
      key: string,
    ) =>
      plan && !v.asCopy
        ? api.updateStrengthPlan(plan.id, v.input, plan.version, key)
        : api.createStrengthPlan(v.input, key),
    onSuccess: saved,
  });
  const remove = useCommand({
    mutationFn: (_: void, key: string) =>
      api.deleteStrengthPlan(plan!.id, plan!.version, key),
    onSuccess: saved,
  });
  const busy = save.isPending || remove.isPending;
  const saveAs = (isDraft: boolean, asCopy = false) => {
    if (busy || (recovery.conflict && !asCopy)) return;
    const parsed = strengthPlanInput.safeParse({ ...input, isDraft });
    if (parsed.success) {
      setValidationMode(null);
      save.mutate({ input: parsed.data, asCopy });
    } else {
      const next = workoutFieldErrors(input, isDraft);
      setValidationMode(isDraft);
      if (next.notes) setNotesOpen(true);
      setCancelling(false);
      requestAnimationFrame(() =>
        formRef.current
          ?.querySelector<HTMLElement>(
            '[aria-invalid="true"], [data-validation-error="true"]',
          )
          ?.focus(),
      );
    }
  };
  return (
    <div className="fitness-workout-builder">
      <header className="fitness-builder-heading">
        <h1 className="fitness-builder-title">
          {plan
            ? plan.isDraft
              ? "Edit draft"
              : "Edit workout"
            : "Create workout"}
        </h1>
        <button
          type="button"
          className="fitness-text-action"
          disabled={busy}
          onClick={() => (dirty ? setCancelling(true) : leave())}
        >
          Cancel
        </button>
      </header>
      {recovery.storageError && (
        <p role="alert" className="error">
          Recovery storage is unavailable. Save draft before leaving.
        </p>
      )}
      {recovery.recovered && (
        <div className="fitness-builder-recovery" role="status">
          <p>
            {recovery.conflict
              ? "This workout changed since these edits. Save a new draft or discard the recovered changes."
              : "Unsaved changes restored."}
          </p>
          {recovery.conflict && (
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={() => saveAs(true, true)}
            >
              Save as new draft
            </button>
          )}
          <button
            type="button"
            className="fitness-text-action"
            disabled={busy}
            onClick={recovery.discard}
          >
            Discard recovered changes
          </button>
        </div>
      )}
      <form
        ref={formRef}
        className="fitness-builder-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          saveAs(false);
        }}
      >
        <div className="fitness-builder-setup form-stack">
          <div className="field">
            <label htmlFor={titleId}>Workout title</label>
            <input
              id={titleId}
              aria-invalid={!!errors.title}
              aria-describedby={errors.title ? `${titleId}-error` : undefined}
              maxLength={160}
              value={title}
              disabled={busy}
              onChange={(event) =>
                recovery.change({ title: event.target.value })
              }
            />
            {errors.title && (
              <p id={`${titleId}-error`} className="error" role="alert">
                {errors.title}
              </p>
            )}
          </div>
          <details
            className="fitness-builder-notes"
            open={notesOpen}
            onToggle={(event) => setNotesOpen(event.currentTarget.open)}
          >
            <summary>{notesOpen ? "Workout notes" : "Add notes"}</summary>
            <NotesField
              label="Workout notes"
              hideLabel
              value={notes}
              disabled={busy}
              error={errors.notes}
              onChange={(value) => recovery.change({ notes: value ?? "" })}
            />
          </details>
        </div>
        <div
          className="fitness-builder-exercises"
          role="region"
          aria-label="Workout exercises"
          tabIndex={0}
        >
          <StrengthExercises
            value={exercises}
            onChange={(exercises) => recovery.change({ exercises })}
            errors={errors}
            disabled={busy}
            building
          />
          {plan && (
            <>
              <button
                type="button"
                className="fitness-text-action danger"
                disabled={busy}
                onClick={() => {
                  if (
                    confirm(
                      "Delete this reusable workout? Scheduled workouts and recorded workouts will remain.",
                    )
                  )
                    remove.mutate();
                }}
              >
                Delete {plan.isDraft ? "draft" : "workout"}
              </button>
              <CommandError command={remove} />
            </>
          )}
        </div>
        <footer className="fitness-builder-footer">
          {!cancelling && <CommandError command={save} />}
          <div className="fitness-builder-save-actions">
            <button
              type="button"
              className="button"
              disabled={busy || recovery.conflict}
              onClick={() => saveAs(true)}
            >
              Save draft
            </button>
            <button
              type="submit"
              className="button primary"
              disabled={busy || recovery.conflict}
            >
              Save workout
            </button>
          </div>
        </footer>
      </form>
      {cancelling && (
        <Dialog
          title="Save your changes?"
          onClose={() => {
            if (!busy) setCancelling(false);
          }}
        >
          <p>
            Save this as a draft to finish later, or discard your unsaved
            changes.
          </p>
          <div className="form-stack">
            <button
              className="button primary"
              disabled={busy || recovery.conflict}
              onClick={() => saveAs(true)}
            >
              Save draft
            </button>
            <button
              className="button danger"
              disabled={busy}
              onClick={() => {
                recovery.clear();
                leave();
              }}
            >
              Discard
            </button>
            <button
              className="button"
              disabled={busy}
              onClick={() => setCancelling(false)}
            >
              Keep editing
            </button>
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <CommandError command={save} />
        </Dialog>
      )}
    </div>
  );
}

/** Map canonical validation to the current draft positions, including after reordering. */
function workoutFieldErrors(
  input: ReturnType<typeof planInput>,
  isDraft: boolean,
): Record<string, string> {
  const parsed = strengthPlanInput.safeParse({ ...input, isDraft });
  if (parsed.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues)
    errors[issue.path.join(".")] ??= issue.message;
  if (
    !isDraft &&
    input.exercises.length &&
    input.exercises.some((exercise) => !exercise.sets.length)
  ) {
    delete errors.exercises;
    input.exercises.forEach((exercise, index) => {
      if (!exercise.sets.length)
        errors[`exercises.${index}.sets`] = "Add at least one set.";
    });
  }
  return errors;
}
