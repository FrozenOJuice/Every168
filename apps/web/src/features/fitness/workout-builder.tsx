"use client";
import { NotesField } from "./notes-field";
import { useState } from "react";
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
      key={query.data ? `${id}:${query.data.version}` : id}
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
  const router = useRouter();
  const cache = useQueryClient();
  const [title, setTitle] = useState(plan?.title ?? "");
  const [notes, setNotes] = useState(plan?.notes ?? "");
  const [exercises, setExercises] = useState(() =>
    initialExercise
      ? [
          {
            clientKey: crypto.randomUUID(),
            exerciseId: initialExercise.id,
            name: initialExercise.name,
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
  const input = planInput(title, notes || null, exercises);
  const dirty = JSON.stringify(input) !== baseline;
  const [error, setError] = useState("");
  const leave = () => router.push("/fitness");
  const saved = () => {
    invalidateFitness(cache);
    leave();
  };
  const save = useCommand({
    mutationFn: (v: ReturnType<typeof planInput>, key: string) =>
      plan
        ? api.updateStrengthPlan(plan.id, v, plan.version, key)
        : api.createStrengthPlan(v, key),
    onSuccess: saved,
  });
  const remove = useCommand({
    mutationFn: (_: void, key: string) =>
      api.deleteStrengthPlan(plan!.id, plan!.version, key),
    onSuccess: saved,
  });
  const busy = save.isPending || remove.isPending;
  const saveAs = (isDraft: boolean) => {
    const parsed = strengthPlanInput.safeParse({ ...input, isDraft });
    if (parsed.success) {
      setError("");
      save.mutate(parsed.data);
    } else setError(parsed.error.issues[0]!.message);
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
      <form
        className="fitness-builder-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          saveAs(false);
        }}
      >
        <div className="fitness-builder-setup form-stack">
          <label className="field">
            Workout title
            <input
              maxLength={160}
              value={title}
              disabled={busy}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>
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
              onChange={(value) => setNotes(value ?? "")}
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
            onChange={setExercises}
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
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {!cancelling && <CommandError command={save} />}
          <div className="fitness-builder-save-actions">
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={() => saveAs(true)}
            >
              Save draft
            </button>
            <button type="submit" className="button primary" disabled={busy}>
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
              disabled={busy}
              onClick={() => saveAs(true)}
            >
              Save draft
            </button>
            <button className="button danger" disabled={busy} onClick={leave}>
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
