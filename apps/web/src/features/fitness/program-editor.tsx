"use client";
import { z } from "zod";
import { ArrowUp, ArrowDown, Trash2, RotateCcw } from "lucide-react";
import { Toast, useToast } from "@/components/ui/toast";
import { TooltipButton } from "@/components/ui/tooltip-button";
import { FitnessConfirm } from "./fitness-confirm";
import { NotesEditor } from "./notes-editor";
import { useProgramRecovery } from "./program-recovery";
import { focusSessionError } from "./session-validation";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { localDate } from "@168hours/domain-utils";
import {
  trainingProgramInput,
  type TrainingProgram,
  type TrainingProgramInput,
} from "@168hours/contracts";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { useCommand, CommandError } from "@/lib/use-command";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";
import { ErrorState, Loading, PageHeading } from "@/components/ui/feedback";
import { FitnessSelect } from "./fitness-select";
import { invalidateFitness } from "./fitness-cache";
export const trainingDayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const subscribeHydration = () => () => {};
export function ProgramEditorPage({ id }: { id?: string }) {
  // Tab-local recovery must be read after hydration, before mounting the editor.
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    () => true,
    () => false,
  );
  const q = useQuery({
    queryKey: ["fitness", "program", id],
    queryFn: () => api.getTrainingProgram(id!),
    enabled: !!id,
    refetchOnWindowFocus: false,
  });
  if (!hydrated || (id && q.isPending)) return <Loading />;
  if (q.error)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  return <ProgramEditor key={id ?? "new"} program={q.data} />;
}
function ProgramEditor({
  program: initialProgram,
}: {
  program?: TrainingProgram;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [submitted, setSubmitted] = useState(false);
  const [program] = useState(initialProgram);
  const { user, preferences } = useMe(),
    router = useRouter(),
    cache = useQueryClient();
  const [initial] = useState<TrainingProgramInput>(() => ({
    title: program?.title ?? "",
    notes: program?.notes ?? null,
    startDate:
      program?.startDate ?? localDate(new Date(), preferences.timezone),
    trainingDays: program?.trainingDays ?? [],
    paused: program?.paused ?? false,
    steps: program?.steps.map(({ id, workoutId }) => ({ id, workoutId })) ?? [],
  }));
  const recovery = useProgramRecovery(
    `168hours:program-draft:${user.id}:${program?.id ?? "new"}`,
    initial,
    program?.version ?? null,
  );
  const { draft, dirty } = recovery;
  const [error, setError] = useState("");
  const [notesOpen, setNotesOpen] = useState(!!initial.notes);
  const [cancelling, setCancelling] = useState(false);
  const { notice, show, dismiss } = useToast();
  const discard = recovery.discard;
  useEffect(() => {
    if (recovery.recovered && !recovery.conflict)
      show({
        message: "Draft restored",
        action: {
          label: "Discard",
          onClick: () => {
            discard();
          },
        },
      });
  }, [recovery.recovered, recovery.conflict, show, discard]);
  const [selected, setSelected] = useState("");

  const workouts = useInfiniteQuery({
    queryKey: ["fitness", "program-workout-options"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.getStrengthPlans({ kind: "workout", limit: 100, cursor: pageParam }),
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const choices =
    workouts.data?.pages.flatMap((p) => p.items).filter((w) => !w.isDraft) ??
    [];
  const change = (v: Partial<TrainingProgramInput>) => {
    recovery.change({ ...draft, ...v });
    setError("");
  };
  const save = useCommand({
    persistence: {
      key: `168hours:program-save:${user.id}:${program?.id ?? "new"}`,
      parse: (value) =>
        z
          .object({
            input: trainingProgramInput,
            version: z.number().int().positive().nullable(),
          })
          .parse(value),
    },
    mutationFn: (
      {
        input,
        version,
      }: { input: TrainingProgramInput; version: number | null },
      key: string,
    ) =>
      program
        ? api.updateTrainingProgram(program.id, input, version!, key)
        : api.createTrainingProgram(input, key),
    onSuccess: (p) => {
      recovery.clear();
      invalidateFitness(cache);
      router.push(`/fitness/programs/${p.id}`);
    },
  });
  useUnsavedChanges(
    (dirty && recovery.storageError) || save.isPending,
    "Leave this program without saving your changes?",
    save.isPending,
  );
  const validation = trainingProgramInput.safeParse(draft);
  const fields: Record<string, string> =
    submitted && !validation.success
      ? Object.fromEntries(
          validation.error.issues.map((issue) => [
            issue.path.join("."),
            issue.message,
          ]),
        )
      : {};
  const back = program
    ? `/fitness/programs/${program.id}`
    : "/fitness/programs";
  const move = (index: number, delta: number) => {
    const steps = [...draft.steps];
    [steps[index], steps[index + delta]] = [
      steps[index + delta]!,
      steps[index]!,
    ];
    change({ steps });
  };
  return (
    <div className="form-stack fitness-program-page fitness-program-editor">
      <div className="fitness-program-editor-heading">
        <PageHeading
          title={program ? "Edit training program" : "Create training program"}
        />
        {recovery.recovered && (
          <TooltipButton
            type="button"
            className="icon-button"
            tooltip="Discard recovered changes"
            aria-label="Discard recovered changes"
            disabled={save.isPending}
            onClick={() => recovery.discard()}
          >
            <RotateCcw size={18} aria-hidden="true" />
          </TooltipButton>
        )}
      </div>
      <form
        ref={formRef}
        noValidate
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (save.isPending || recovery.conflict) return;
          const parsed = trainingProgramInput.safeParse(draft);
          if (!parsed.success) {
            setSubmitted(true);
            setError("Check the highlighted program fields.");
            requestAnimationFrame(() => focusSessionError(formRef.current));
            return;
          }
          save.mutate({
            input: parsed.data,
            version: program?.version ?? null,
          });
        }}
      >
        {recovery.storageError && (
          <p className="error" role="alert">
            Local draft storage is unavailable. Save before leaving.
          </p>
        )}
        {recovery.conflict && (
          <p className="error" role="alert">
            This program changed elsewhere. Your recovered edits are kept.
            Discard them to load the saved program.
          </p>
        )}
        <fieldset
          className="form-stack"
          disabled={save.isPending || recovery.conflict}
        >
          <label className="field">
            Program name
            <input
              required
              maxLength={160}
              aria-invalid={!!fields.title}
              aria-describedby={
                fields.title ? "program-title-error" : undefined
              }
              value={draft.title}
              onChange={(e) => change({ title: e.target.value })}
            />
          </label>
          {fields.title && (
            <p className="error" role="alert" id="program-title-error">
              {fields.title}
            </p>
          )}
          <label className="field">
            Start date
            <input
              required
              type="date"
              aria-invalid={!!fields.startDate}
              aria-describedby={
                fields.startDate ? "program-startDate-error" : undefined
              }
              value={draft.startDate}
              onChange={(e) => change({ startDate: e.target.value })}
            />
          </label>
          {fields.startDate && (
            <p className="error" role="alert" id="program-startDate-error">
              {fields.startDate}
            </p>
          )}
          <fieldset className="form-stack">
            <legend>Preferred training days</legend>
            <p className="muted text-small">
              Optional. Leave blank to train whenever you’re ready. Choosing
              days does not schedule workouts.
            </p>
            <div className="fitness-program-days">
              {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                <label key={day}>
                  <input
                    type="checkbox"
                    checked={draft.trainingDays.includes(day)}
                    onChange={(e) =>
                      change({
                        trainingDays: e.target.checked
                          ? [...draft.trainingDays, day].sort()
                          : draft.trainingDays.filter((d) => d !== day),
                      })
                    }
                  />
                  {trainingDayNames[day]}
                </label>
              ))}
            </div>
          </fieldset>
          <section
            className="form-stack"
            aria-labelledby="program-workouts-heading"
          >
            <h2 id="program-workouts-heading">Workout sequence</h2>
            <p className="muted text-small">
              Add workouts in order. The sequence repeats after the last one.
            </p>
            <ol className="fitness-program-steps">
              {draft.steps.map((step, index) => {
                const saved = program?.steps.find((s) => s.id === step.id),
                  choice = choices.find((w) => w.id === step.workoutId);
                return (
                  <li key={step.id ?? index}>
                    <div>
                      <strong>
                        {choice?.title ?? saved?.title ?? "Workout"}
                      </strong>
                      {saved && !saved.available && !choice && (
                        <p className="error">
                          Unavailable. Remove this step and add a ready workout.
                        </p>
                      )}
                    </div>
                    <div className="fitness-program-step-actions">
                      <TooltipButton
                        type="button"
                        className="icon-button"
                        tooltip="Move earlier"
                        aria-label={`Move step ${index + 1} up`}
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                      >
                        <ArrowUp size={16} aria-hidden="true" />
                      </TooltipButton>
                      <TooltipButton
                        type="button"
                        className="icon-button"
                        tooltip="Move later"
                        aria-label={`Move step ${index + 1} down`}
                        disabled={index === draft.steps.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        <ArrowDown size={16} aria-hidden="true" />
                      </TooltipButton>
                      <TooltipButton
                        type="button"
                        className="icon-button"
                        tooltip="Remove workout"
                        aria-label={`Remove step ${index + 1}`}
                        onClick={() =>
                          change({
                            steps: draft.steps.filter((_, i) => i !== index),
                          })
                        }
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </TooltipButton>
                    </div>
                  </li>
                );
              })}
            </ol>
            {!draft.steps.length && <p>No workouts added yet.</p>}
            {workouts.isPending ? (
              <Loading />
            ) : workouts.error ? (
              <ErrorState
                error={workouts.error}
                retry={() => void workouts.refetch()}
              />
            ) : (
              <>
                <FitnessSelect
                  label="Saved workout"
                  error={
                    fields.steps
                      ? "Add at least one workout to the sequence."
                      : undefined
                  }
                  value={selected}
                  onChange={setSelected}
                  options={[
                    { value: "", label: "Choose a ready workout" },
                    ...choices.map((w) => ({ value: w.id, label: w.title })),
                  ]}
                  disabled={save.isPending}
                />
                <button
                  type="button"
                  className="button"
                  disabled={!selected || draft.steps.length >= 20}
                  onClick={() => {
                    change({
                      steps: [...draft.steps, { workoutId: selected }],
                    });
                  }}
                >
                  Add workout to sequence
                </button>
                {workouts.hasNextPage && (
                  <button
                    type="button"
                    className="button"
                    disabled={workouts.isFetchingNextPage}
                    onClick={() => void workouts.fetchNextPage()}
                  >
                    Load more saved workouts
                  </button>
                )}
                {!choices.length && (
                  <p>
                    Save a ready workout before adding it to a program.{" "}
                    <Link href="/fitness/workout/new">Create a workout</Link>
                  </p>
                )}
              </>
            )}
          </section>
          <NotesEditor
            label="Program notes"
            open={notesOpen || !!fields.notes}
            onOpenChange={setNotesOpen}
            value={draft.notes}
            error={fields.notes}
            onChange={(notes) => change({ notes })}
          />
          {program?.next.occurrence && (
            <p className="muted">
              Changes apply to future workouts. Your current workout keeps its
              saved exercises and targets.
            </p>
          )}
        </fieldset>
        <div className="fitness-program-save-bar">
          <button
            type="button"
            className="button"
            disabled={save.isPending}
            onClick={() => {
              if (dirty) setCancelling(true);
              else router.push(back);
            }}
          >
            Cancel
          </button>
          <button
            className="button primary"
            disabled={save.isPending || recovery.conflict}
          >
            {save.retrying ? "Saving…" : "Save program"}
          </button>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <CommandError command={save} />
      </form>
      {cancelling && (
        <FitnessConfirm
          title="Discard program changes?"
          action="Discard changes"
          danger
          busy={save.isPending}
          onCancel={() => setCancelling(false)}
          onConfirm={() => {
            if (recovery.discard()) router.push(back);
            else setCancelling(false);
          }}
        />
      )}
      {notice && (
        <Toast key={notice.id} {...notice} onDismiss={() => dismiss()} />
      )}
    </div>
  );
}
