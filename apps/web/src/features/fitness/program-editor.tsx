"use client";
import { z } from "zod";
import { ArrowUp, ArrowDown, Trash2, RotateCcw, Plus } from "lucide-react";
import { Toast, useToast } from "@/components/ui/toast";
import { TooltipButton } from "@/components/ui/tooltip-button";
import { FitnessConfirm } from "./fitness-confirm";
import { NotesEditor } from "./notes-editor";
import { useProgramRecovery } from "./program-recovery";
import { focusSessionError } from "./session-validation";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { WorkoutSearch, useWorkoutSearch } from "./workout-search";
import { ProgramStartDate } from "./program-start-date";
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [addedMessage, setAddedMessage] = useState("");
  const addButton = useRef<HTMLButtonElement>(null);
  const {
    search,
    setSearch,
    query: workouts,
  } = useWorkoutSearch(pickerOpen, 12, true);
  const choices = workouts.data?.pages.flatMap((page) => page.items) ?? [];
  const referencedIds = [...new Set(draft.steps.map((step) => step.workoutId))];
  const referenced = useQueries({
    queries: referencedIds.map((id) => ({
      queryKey: ["fitness", "workout", id],
      queryFn: () => api.getStrengthPlan(id),
      retry: false,
    })),
  });
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
  const back = program ? `/fitness/programs/${program.id}` : "/fitness";
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

          <section
            className="fitness-program-sequence"
            aria-labelledby="program-workouts-heading"
          >
            <div className="fitness-program-section-heading">
              <div>
                <h2 id="program-workouts-heading">Workout sequence</h2>
                <p className="muted text-small">
                  Repeats in this order after the last workout.
                </p>
              </div>
              <span className="muted text-small">{draft.steps.length}/20</span>
            </div>
            <ol className="fitness-program-steps">
              {draft.steps.map((step, index) => {
                const saved = program?.steps.find((s) => s.id === step.id),
                  lookup = referenced[referencedIds.indexOf(step.workoutId)]!,
                  choice =
                    choices.find((w) => w.id === step.workoutId) ?? lookup.data;
                return (
                  <li key={step.id ?? index}>
                    <div>
                      <strong>
                        {choice?.title ??
                          saved?.title ??
                          (lookup.isPending
                            ? "Loading workout…"
                            : "Unavailable workout")}
                      </strong>
                      {((choice &&
                        (choice.isDraft || choice.kind !== "workout")) ||
                        (!choice && saved && !saved.available)) && (
                        <p className="error">
                          Unavailable. Remove this step and add a ready workout.
                        </p>
                      )}
                      {!choice && lookup.error && (
                        <p className="error" role="alert">
                          This workout could not be loaded. Remove it or{" "}
                          <button
                            className="fitness-text-action"
                            type="button"
                            onClick={() => void lookup.refetch()}
                          >
                            Retry loading workout
                          </button>
                          .
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
            {!draft.steps.length && (
              <p className="fitness-program-empty muted">
                Add your first workout to build the rotation.
              </p>
            )}
            <button
              ref={addButton}
              type="button"
              className="button fitness-program-add"
              aria-expanded={pickerOpen}
              aria-controls="program-workout-picker"
              data-invalid={!!fields.steps}
              aria-describedby={
                fields.steps ? "program-steps-error" : undefined
              }
              onClick={() => setPickerOpen(!pickerOpen)}
            >
              <Plus size={18} aria-hidden="true" /> Add workout
            </button>
            {fields.steps && (
              <p className="error" role="alert" id="program-steps-error">
                Add at least one workout to the sequence.
              </p>
            )}
            {pickerOpen && (
              <div
                className="fitness-program-picker"
                id="program-workout-picker"
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setPickerOpen(false);
                    addButton.current?.focus();
                  }
                }}
              >
                <WorkoutSearch value={search} onChange={setSearch} />
                <div className="fitness-program-picker-results">
                  {workouts.isPending ? (
                    <Loading />
                  ) : workouts.error ? (
                    <ErrorState
                      error={workouts.error}
                      retry={() => void workouts.refetch()}
                    />
                  ) : (
                    <>
                      <ul aria-label="Ready workouts">
                        {choices.map((workout) => (
                          <li key={workout.id}>
                            <div>
                              <strong>{workout.title}</strong>
                              <span className="muted text-small">
                                {workout.exercises.length}{" "}
                                {workout.exercises.length === 1
                                  ? "exercise"
                                  : "exercises"}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="button"
                              aria-label={`Add ${workout.title} to sequence`}
                              disabled={draft.steps.length >= 20}
                              onClick={() => {
                                change({
                                  steps: [
                                    ...draft.steps,
                                    { workoutId: workout.id },
                                  ],
                                });
                                setAddedMessage(
                                  `${workout.title} added at position ${draft.steps.length + 1}.`,
                                );
                              }}
                            >
                              Add
                            </button>
                          </li>
                        ))}
                      </ul>
                      {workouts.hasNextPage && (
                        <button
                          type="button"
                          className="button"
                          disabled={workouts.isFetchingNextPage}
                          onClick={() => void workouts.fetchNextPage()}
                        >
                          {workouts.isFetchingNextPage
                            ? "Loading…"
                            : "Show more workouts"}
                        </button>
                      )}
                      {!choices.length &&
                        (search.trim() ? (
                          <p className="muted">
                            No ready workouts match your search.
                          </p>
                        ) : (
                          <p className="muted">
                            Save a ready workout before adding it to a program.{" "}
                            <Link href="/fitness/workout/new">
                              Create a workout
                            </Link>
                          </p>
                        ))}
                    </>
                  )}
                </div>
                <div className="fitness-program-picker-footer">
                  <span className="muted text-small" role="status">
                    {draft.steps.length >= 20
                      ? "20-workout limit reached."
                      : addedMessage}
                  </span>
                  <button
                    type="button"
                    className="button"
                    onClick={() => {
                      setPickerOpen(false);
                      addButton.current?.focus();
                    }}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </section>
          <section
            className="fitness-program-preferences"
            aria-labelledby="program-dates-heading"
          >
            <h2 id="program-dates-heading">Date preferences</h2>
            <fieldset className="form-stack">
              <legend>
                Preferred training days{" "}
                <span className="muted text-small">(optional)</span>
              </legend>
              <p className="muted text-small">
                Leave blank for a flexible rotation. These preferences suggest
                dates; workouts are scheduled separately.
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
            <ProgramStartDate
              value={draft.startDate}
              onChange={(startDate) => change({ startDate })}
              error={fields.startDate}
              disabled={save.isPending || recovery.conflict}
            />
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
