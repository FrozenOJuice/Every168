"use client";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { routineInput, type Routine } from "@168hours/contracts";
import { api } from "@/lib/api";
import { useCommand, CommandError } from "@/lib/use-command";
import { Dialog } from "@/components/ui/dialog";
import {
  Empty,
  ErrorState,
  Loading,
  PageHeading,
} from "@/components/ui/feedback";

const queryKey = ["routines"];

export function RoutinesPage() {
  const cache = useQueryClient();
  const [editing, setEditing] = useState<Routine | "new" | null>(null);
  const query = useQuery({ queryKey, queryFn: api.getRoutines });
  return (
    <>
      <PageHeading
        title="Routines"
        description="Keep the steps you do together in one place."
      >
        <button className="button primary" onClick={() => setEditing("new")}>
          Add routine
        </button>
      </PageHeading>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : query.data.length ? (
        <div className="routine-grid">
          {query.data.map((routine) => (
            <RoutineCard
              key={`${routine.id}:${routine.version}`}
              routine={routine}
              onEdit={() => setEditing(routine)}
              onChange={(updated) =>
                cache.setQueryData<Routine[]>(queryKey, (current) =>
                  current?.map((item) =>
                    item.id === updated.id ? updated : item,
                  ),
                )
              }
            />
          ))}
        </div>
      ) : (
        <Empty>
          No routines yet. Add one to keep a checklist you use often.
        </Empty>
      )}
      {editing && (
        <Dialog
          title={editing === "new" ? "Add routine" : "Edit routine"}
          onClose={() => setEditing(null)}
        >
          <RoutineEditor
            routine={editing === "new" ? undefined : editing}
            onSaved={() => {
              void cache.invalidateQueries({ queryKey });
              setEditing(null);
            }}
          />
        </Dialog>
      )}
    </>
  );
}

function RoutineCard({
  routine,
  onEdit,
  onChange,
}: {
  routine: Routine;
  onEdit: () => void;
  onChange: (routine: Routine) => void;
}) {
  const [checked, setChecked] = useState(routine.checked);
  const progress = useCommand({
    mutationFn: (checked: number[], key: string) =>
      api.updateRoutineProgress(routine.id, { checked }, routine.version, key),
    onSuccess: onChange,
    onError: () => setChecked(routine.checked),
  });
  const complete = useCommand({
    mutationFn: (_: void, key: string) =>
      api.completeRoutine(routine.id, routine.version, key),
    onSuccess: onChange,
  });
  const busy = progress.isPending || complete.isPending;
  return (
    <section className="routine-card" aria-label={routine.name}>
      <div className="row between">
        <h2>{routine.name}</h2>
        <button className="button" onClick={onEdit}>
          Edit
        </button>
      </div>
      <p className="muted text-small">
        {checked.length} of {routine.steps.length} steps · Completed{" "}
        {routine.runCount} {routine.runCount === 1 ? "time" : "times"}
      </p>
      <ol className="routine-steps">
        {routine.steps.map((step, index) => (
          <li key={index}>
            <label>
              <input
                type="checkbox"
                checked={checked.includes(index)}
                disabled={busy}
                onChange={() => {
                  const next = checked.includes(index)
                    ? checked.filter((value) => value !== index)
                    : [...checked, index].sort((a, b) => a - b);
                  setChecked(next);
                  progress.mutate(next);
                }}
              />
              <span>{step}</span>
            </label>
          </li>
        ))}
      </ol>
      <button
        className="button primary"
        disabled={busy || checked.length !== routine.steps.length}
        onClick={() => complete.mutate()}
      >
        Finish routine
      </button>
      <CommandError command={progress} />
      <CommandError command={complete} />
    </section>
  );
}

function RoutineEditor({
  routine,
  onSaved,
}: {
  routine?: Routine;
  onSaved: () => void;
}) {
  const [name, setName] = useState(routine?.name ?? "");
  const [steps, setSteps] = useState<string[]>(routine?.steps ?? [""]);
  const [error, setError] = useState("");
  const save = useCommand({
    mutationFn: (input: { name: string; steps: string[] }, key: string) =>
      routine
        ? api.updateRoutine(routine.id, input, routine.version, key)
        : api.createRoutine(input, key),
    onSuccess: onSaved,
  });
  const remove = useCommand({
    mutationFn: (_: void, key: string) =>
      api.deleteRoutine(routine!.id, routine!.version, key),
    onSuccess: onSaved,
  });
  const busy = save.isPending || remove.isPending;
  function move(index: number, direction: -1 | 1) {
    const next = [...steps];
    [next[index], next[index + direction]] = [
      next[index + direction]!,
      next[index]!,
    ];
    setSteps(next);
  }
  return (
    <form
      className="form-stack routine-editor"
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = routineInput.safeParse({ name, steps });
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message ?? "Check the routine.");
          return;
        }
        setError("");
        save.mutate(parsed.data);
      }}
    >
      <label className="field">
        Routine name
        <input
          value={name}
          maxLength={160}
          disabled={busy}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </label>
      <fieldset disabled={busy}>
        <legend>Steps, in order</legend>
        {steps.map((step, index) => (
          <div className="routine-step-edit" key={index}>
            <label className="field">
              Step {index + 1}
              <input
                value={step}
                maxLength={160}
                onChange={(event) =>
                  setSteps(
                    steps.map((current, i) =>
                      i === index ? event.target.value : current,
                    ),
                  )
                }
                required
              />
            </label>
            <button
              type="button"
              className="button"
              disabled={index === 0}
              onClick={() => move(index, -1)}
              aria-label={`Move step ${index + 1} up`}
            >
              ↑
            </button>
            <button
              type="button"
              className="button"
              disabled={index === steps.length - 1}
              onClick={() => move(index, 1)}
              aria-label={`Move step ${index + 1} down`}
            >
              ↓
            </button>
            <button
              type="button"
              className="button"
              disabled={steps.length === 1}
              onClick={() => setSteps(steps.filter((_, i) => i !== index))}
              aria-label={`Remove step ${index + 1}`}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="button"
          disabled={steps.length >= 50}
          onClick={() => setSteps([...steps, ""])}
        >
          Add step
        </button>
      </fieldset>
      {routine && (
        <p className="muted text-small">
          Editing steps restarts the current checklist. Completed count stays.
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <button type="submit" className="button primary" disabled={busy}>
        Save routine
      </button>
      {routine && (
        <button
          type="button"
          className="button danger"
          disabled={busy}
          onClick={() => {
            if (confirm("Delete this routine?")) remove.mutate();
          }}
        >
          Delete routine
        </button>
      )}
      <CommandError command={save} />
      <CommandError command={remove} />
    </form>
  );
}
