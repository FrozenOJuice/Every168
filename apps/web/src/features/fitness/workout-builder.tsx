"use client";
import { NotesField } from "./notes-field";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { strengthPlanInput, type StrengthPlan } from "@168hours/contracts";
import { api } from "@/lib/api";
import { useCommand, CommandError } from "@/lib/use-command";
import { Loading, ErrorState, PageHeading } from "@/components/ui/feedback";
import { StrengthExercises } from "./strength-exercises";
import { planExercises, planInput } from "./strength-draft";
import { invalidateFitness } from "./fitness-cache";
export function WorkoutBuilderPage({ id }: { id: string }) {
  const query = useQuery({
    queryKey: ["fitness", "workout", id],
    queryFn: () => api.getStrengthPlan(id),
    enabled: id !== "new",
  });
  if (id !== "new" && query.isPending) return <Loading />;
  if (id !== "new" && query.error)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  return (
    <WorkoutBuilder
      key={query.data ? `${id}:${query.data.version}` : id}
      plan={query.data}
    />
  );
}
function WorkoutBuilder({ plan }: { plan?: StrengthPlan }) {
  const router = useRouter();
  const cache = useQueryClient();
  const [title, setTitle] = useState(plan?.title ?? "");
  const [notes, setNotes] = useState(plan?.notes ?? "");
  const [exercises, setExercises] = useState(() => planExercises(plan));
  const [error, setError] = useState("");
  const saved = () => {
    invalidateFitness(cache);
    router.push("/fitness");
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
  return (
    <div className="fitness-workspace">
      <Link href="/fitness">← Fitness</Link>
      <PageHeading
        title={plan ? "Edit workout" : "Create workout"}
        description="Set up exercises and targets. Actual performance is recorded when you train."
      />
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          const parsed = strengthPlanInput.safeParse(
            planInput(title, notes || null, exercises),
          );
          if (parsed.success) {
            setError("");
            save.mutate(parsed.data);
          } else setError(parsed.error.issues[0]!.message);
        }}
      >
        <fieldset className="form-stack" disabled={busy}>
          <label>
            Workout title
            <input
              required
              maxLength={160}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <NotesField
            label="Workout notes"
            value={notes}
            onChange={(notes) => setNotes(notes ?? "")}
          />
          <StrengthExercises
            value={exercises}
            onChange={setExercises}
            disabled={busy}
          />
          <button className="button primary">Save workout</button>
        </fieldset>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </form>
      <CommandError command={save} />
      {plan && (
        <button
          className="button danger"
          disabled={busy}
          onClick={() => {
            if (
              confirm(
                "Delete this reusable workout? Scheduled workouts and sessions will remain.",
              )
            )
              remove.mutate();
          }}
        >
          Delete workout
        </button>
      )}
      <CommandError command={remove} />
    </div>
  );
}
