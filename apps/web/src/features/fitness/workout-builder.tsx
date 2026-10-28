"use client";
import { FitnessConfirm } from "./fitness-confirm";
import { TooltipButton } from "@/components/ui/tooltip-button";
import { useMe } from "@/features/identity/me";
import { useWorkoutBuilderRecovery } from "./workout-builder-recovery";
import { WorkoutEditor } from "./workout-editor";
import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { Toast, useToast, type ToastNotice } from "@/components/ui/toast";
import { ContextMenu } from "@/components/ui/context-menu";
import { z } from "zod";
import { strengthPlanInput, type StrengthPlan } from "@168hours/contracts";
import { api } from "@/lib/api";
import { useCommand, CommandError } from "@/lib/use-command";
import { Loading, ErrorState } from "@/components/ui/feedback";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";
import { emptySet, planExercises, planInput } from "./strength-draft";
import { invalidateFitness } from "./fitness-cache";
export function WorkoutBuilderPage({
  id,
  exerciseId,
  returnTo,
  addedOccurrence,
}: {
  id: string;
  exerciseId?: string;
  returnTo?: string;
  addedOccurrence?: string;
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
      returnTo={returnTo}
      addedOccurrence={addedOccurrence}
      plan={query.data}
      initialExercise={id === "new" ? seed.data : undefined}
    />
  );
}
function WorkoutBuilder({
  plan,
  initialExercise,
  returnTo,
  addedOccurrence,
}: {
  returnTo?: string;
  addedOccurrence?: string;
  plan?: StrengthPlan;
  initialExercise?: import("@168hours/contracts").Exercise;
}) {
  const { user } = useMe();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const cache = useQueryClient();
  const [initialExercises] = useState(() =>
    initialExercise
      ? [
          {
            clientKey: crypto.randomUUID(),
            exerciseId: initialExercise.id,
            name: initialExercise.name,
            loggingType: initialExercise.loggingType,
            intentTags: initialExercise.intentTags,
            notes: null,
            sets: [emptySet()],
          },
        ]
      : planExercises(plan),
  );
  const [deleting, setDeleting] = useState(false);
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
  const addedParts = addedOccurrence?.split(":").map(Number);
  const addedIndex =
    plan &&
    !recovery.recovered &&
    addedParts?.length === 2 &&
    addedParts[0] === plan.version &&
    Number.isInteger(addedParts[1]) &&
    addedParts[1]! >= 0 &&
    addedParts[1]! < exercises.length
      ? addedParts[1]
      : undefined;
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
  const leave = () => router.push(returnTo ?? "/fitness");
  const saved = () => {
    recovery.clear();
    invalidateFitness(cache);
    leave();
  };
  const save = useCommand({
    persistence: {
      key: `168hours:workout-save:${user.id}:${plan?.id ?? "new"}`,
      parse: (value) =>
        z
          .object({
            input: strengthPlanInput,
            asCopy: z.boolean(),
            version: z.number().int().positive().nullable(),
          })
          .parse(value),
    },
    mutationFn: (
      v: {
        input: ReturnType<typeof planInput>;
        asCopy: boolean;
        version: number | null;
      },
      key: string,
    ) =>
      plan && !v.asCopy
        ? api.updateStrengthPlan(plan.id, v.input, v.version!, key)
        : api.createStrengthPlan(v.input, key),
    onSuccess: saved,
  });
  const remove = useCommand({
    mutationFn: (_: void, key: string) =>
      api.deleteStrengthPlan(plan!.id, plan!.version, key),
    onSuccess: saved,
  });
  const busy = save.isPending || remove.isPending;
  // Ordinary edits already recover synchronously. Do not leave if they cannot
  // be recovered, or while a write is still deciding which record to return to.
  useUnsavedChanges(busy || (dirty && recovery.storageError), undefined, true);
  const { notice, show, dismiss } = useToast<
    ToastNotice & { durationMs?: number }
  >();
  const [actionsMenu, setActionsMenu] = useState<{
    anchor: HTMLElement;
    x: number;
    y: number;
  } | null>(null);
  const closeActions = useCallback(() => setActionsMenu(null), []);
  const resetRecovered = recovery.discard;
  const discardRecovered = useCallback(() => {
    resetRecovered();
    setNotesOpen(!!plan?.notes);
    setValidationMode(null);
    requestAnimationFrame(() =>
      formRef.current?.querySelector<HTMLInputElement>("input")?.focus(),
    );
  }, [resetRecovered, plan?.notes, setNotesOpen, setValidationMode]);
  useEffect(() => {
    if (!recovery.recovered || recovery.conflict) return;
    const id = show({
      message: "Draft restored",
      kind: "info",
      action: { label: "Discard", onClick: discardRecovered },
    });
    return () => dismiss(id);
  }, [recovery.recovered, recovery.conflict, discardRecovered, show, dismiss]);
  const saveAs = (isDraft: boolean, asCopy = false) => {
    if (busy || (recovery.conflict && !asCopy)) return;
    const parsed = strengthPlanInput.safeParse({ ...input, isDraft });
    if (parsed.success) {
      setValidationMode(null);
      save.mutate({
        input: parsed.data,
        asCopy,
        version: plan?.version ?? null,
      });
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
      <form
        ref={formRef}
        className="fitness-builder-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          saveAs(false);
        }}
      >
        <WorkoutEditor
          mode={plan ? "saved" : "create"}
          heading={
            plan
              ? plan.isDraft
                ? "Edit draft"
                : "Edit workout"
              : "Create workout"
          }
          backLabel={returnTo ? "Back to exercise" : "Back to Training"}
          onBack={() => (dirty ? setCancelling(true) : leave())}
          disabled={busy}
          headerActions={
            (plan || (recovery.recovered && !recovery.conflict)) && (
              <TooltipButton
                type="button"
                className="icon-button"
                tooltip="Workout actions"
                aria-label="Workout actions"
                aria-haspopup="menu"
                aria-expanded={!!actionsMenu}
                disabled={busy}
                onClick={(event) => {
                  const anchor = event.currentTarget;
                  const rect = anchor.getBoundingClientRect();
                  setActionsMenu({
                    anchor,
                    x: rect.right,
                    y: rect.bottom + 4,
                  });
                }}
              >
                <MoreHorizontal size={18} aria-hidden="true" />
              </TooltipButton>
            )
          }
          notices={
            <>
              {recovery.storageError && (
                <p role="alert" className="error">
                  Recovery storage is unavailable. Keep this page open and
                  enable storage before saving.
                </p>
              )}
              {recovery.recovered && recovery.conflict && (
                <div className="fitness-builder-recovery" role="status">
                  <p>
                    This workout changed since these edits. Save a new draft or
                    discard the recovered changes.
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
                    onClick={discardRecovered}
                  >
                    Discard recovered changes
                  </button>
                </div>
              )}
            </>
          }
          name={title}
          notes={notes}
          notesOpen={notesOpen}
          onNotesOpenChange={setNotesOpen}
          onNameChange={(title) => recovery.change({ title })}
          onNotesChange={(notes) => recovery.change({ notes: notes ?? "" })}
          errors={errors}
          context={
            <>
              {returnTo && (
                <p className="fitness-builder-context" role="status">
                  {!plan
                    ? "New workout — not saved yet."
                    : addedIndex !== undefined
                      ? `${plan.exercises[addedIndex]!.name} was added and saved. Set its targets below.`
                      : "Editing workout."}
                </p>
              )}
            </>
          }
          exercises={{
            value: exercises,
            initiallyCollapsed: !!plan,
            focusKey:
              addedIndex === undefined
                ? undefined
                : initialExercises[addedIndex]?.clientKey,
            onChange: (exercises) => recovery.change({ exercises }),
            onNotice: (message, action) =>
              show({
                message,
                kind: action ? "info" : "success",
                action,
                durationMs: action ? 8000 : undefined,
              }),
            errors,
            disabled: busy,
          }}
          footer={
            <>
              {!cancelling && <CommandError command={save} />}
              {!deleting && <CommandError command={remove} />}
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
            </>
          }
        />
      </form>
      {notice && (
        <Toast
          key={notice.id}
          {...notice}
          action={
            notice.action ? { ...notice.action, disabled: busy } : undefined
          }
          onDismiss={() => dismiss(notice.id)}
        />
      )}
      {actionsMenu && (
        <ContextMenu
          {...actionsMenu}
          label="Workout actions"
          actions={[
            ...(recovery.recovered && !recovery.conflict
              ? [
                  {
                    label: "Discard recovered changes",
                    disabled: busy,
                    destructive: true,
                    run: discardRecovered,
                  },
                ]
              : []),
            ...(plan
              ? [
                  ...(recovery.recovered && !recovery.conflict
                    ? [{ separator: true as const }]
                    : []),
                  {
                    label: plan.isDraft ? "Delete draft" : "Delete workout",
                    disabled: busy,
                    destructive: true,
                    run: () => setDeleting(true),
                  },
                ]
              : []),
          ]}
          onClose={closeActions}
        />
      )}
      {deleting && (
        <FitnessConfirm
          title={plan?.isDraft ? "Delete draft?" : "Delete reusable workout?"}
          description="Scheduled workouts and recorded results will stay."
          action={plan?.isDraft ? "Delete draft" : "Delete workout"}
          cancel="Cancel"
          danger
          busy={busy}
          onCancel={() => setDeleting(false)}
          onConfirm={() => remove.mutate()}
        >
          <CommandError command={remove} />
        </FitnessConfirm>
      )}
      {cancelling && (
        <FitnessConfirm
          title="Save your changes?"
          action="Discard"
          cancel="Keep editing"
          danger
          busy={busy}
          onCancel={() => setCancelling(false)}
          onConfirm={() => {
            recovery.clear();
            leave();
          }}
          extraAction={{
            label: "Save draft",
            disabled: recovery.conflict,
            onClick: () => saveAs(true),
          }}
        >
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <CommandError command={save} />
        </FitnessConfirm>
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
