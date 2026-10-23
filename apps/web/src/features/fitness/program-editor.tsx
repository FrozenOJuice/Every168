"use client";
import Link from "next/link";
import { useState } from "react";
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
export function ProgramEditorPage({ id }: { id?: string }) {
  const q = useQuery({
    queryKey: ["fitness", "program", id],
    queryFn: () => api.getTrainingProgram(id!),
    enabled: !!id,
    refetchOnWindowFocus: false,
  });
  if (id && q.isPending) return <Loading />;
  if (q.error)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  return <ProgramEditor key={id ?? "new"} program={q.data} />;
}
function ProgramEditor({
  program: initialProgram,
}: {
  program?: TrainingProgram;
}) {
  const [program] = useState(initialProgram);
  const { preferences } = useMe(),
    router = useRouter(),
    cache = useQueryClient();
  const [draft, setDraft] = useState<TrainingProgramInput>(() => ({
    title: program?.title ?? "",
    notes: program?.notes ?? null,
    startDate:
      program?.startDate ?? localDate(new Date(), preferences.timezone),
    trainingDays: program?.trainingDays ?? [],
    paused: program?.paused ?? false,
    steps: program?.steps.map(({ id, workoutId }) => ({ id, workoutId })) ?? [],
  }));
  const [dirty, setDirty] = useState(false),
    [error, setError] = useState("");
  const [selected, setSelected] = useState("");
  useUnsavedChanges(dirty, "Leave this program without saving your changes?");
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
    setDraft({ ...draft, ...v });
    setDirty(true);
    setError("");
  };
  const save = useCommand({
    mutationFn: (input: TrainingProgramInput, key: string) =>
      program
        ? api.updateTrainingProgram(program.id, input, program.version, key)
        : api.createTrainingProgram(input, key),
    onSuccess: (p) => {
      setDirty(false);
      invalidateFitness(cache);
      router.push(`/fitness/programs/${p.id}`);
    },
  });
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
    <div className="form-stack fitness-program-page">
      <Link href={back}>← {program ? "Program" : "Training programs"}</Link>
      <PageHeading
        title={program ? "Edit training program" : "Create training program"}
        description="Repeat an ordered sequence of your saved workouts, at your own pace or on preferred days."
      />
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          const parsed = trainingProgramInput.safeParse(draft);
          if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? "Check your program.");
            return;
          }
          save.mutate(parsed.data);
        }}
      >
        <fieldset className="form-stack" disabled={save.isPending}>
          <label className="field">
            Program name
            <input
              required
              maxLength={160}
              value={draft.title}
              onChange={(e) => change({ title: e.target.value })}
            />
          </label>
          <label className="field">
            Start date
            <input
              required
              type="date"
              value={draft.startDate}
              onChange={(e) => change({ startDate: e.target.value })}
            />
          </label>
          <fieldset className="form-stack">
            <legend>Preferred training days</legend>
            <p className="muted">
              Leave every day unchecked for a flexible rotation. Days suggest
              when to train; they do not create Calendar entries.
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
            <p className="muted">
              Finishing or skipping a workout moves to the next one. After the
              last workout, the sequence repeats. Add up to 20 steps, including
              repeats of the same workout.
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
                      <button
                        type="button"
                        className="button"
                        aria-label={`Move step ${index + 1} up`}
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="button"
                        aria-label={`Move step ${index + 1} down`}
                        disabled={index === draft.steps.length - 1}
                        onClick={() => move(index, 1)}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="button"
                        aria-label={`Remove step ${index + 1}`}
                        onClick={() =>
                          change({
                            steps: draft.steps.filter((_, i) => i !== index),
                          })
                        }
                      >
                        Remove
                      </button>
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
          <label className="field">
            Program notes
            <textarea
              maxLength={4000}
              value={draft.notes ?? ""}
              onChange={(e) => change({ notes: e.target.value || null })}
            />
          </label>
          {program?.next.occurrence && (
            <p className="muted">
              Changes apply to future workouts. Your current workout keeps its
              saved exercises and targets.
            </p>
          )}
          <div className="row">
            <button className="button primary">
              {save.isPending ? "Saving…" : "Save program"}
            </button>
            <Link className="button" href={back}>
              Cancel
            </Link>
          </div>
        </fieldset>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <CommandError command={save} />
      </form>
    </div>
  );
}
