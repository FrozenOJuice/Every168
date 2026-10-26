"use client";
import {
  ArrowLeft,
  ChevronDown,
  Settings2,
  SlidersHorizontal,
} from "lucide-react";
import { WorkoutReview } from "./workout-review";
import { FitnessConfirm } from "./fitness-confirm";
import { useWorkoutStart } from "./active-workouts";
import { SessionPlanEditor } from "./session-plan-editor";
import { LiveWorkout } from "./live-workout";
import { TooltipButton } from "@/components/ui/tooltip-button";
import { ProgramSessionLink } from "./program-detail";
import { WorkoutComparison } from "./workout-comparison";
import { NotesField } from "./notes-field";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  instantToLocalInput,
  localInputToInstant,
} from "@168hours/domain-utils";
import {
  workoutUpdateInput,
  strengthPlanInput,
  type Workout,
} from "@168hours/contracts";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { useCommand, CommandError } from "@/lib/use-command";
import { ErrorState, Loading } from "@/components/ui/feedback";
import { StrengthExercises } from "./strength-exercises";
import { sessionInput, planInput, type SessionDraft } from "./strength-draft";
import { invalidateFitness } from "./fitness-cache";
import { RestTimer } from "./rest-timer";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";
import { Dialog } from "@/components/ui/dialog";
import { useSessionSave } from "./use-session-save";
import {
  removedResults,
  applyRemoval,
  restoreRemoval,
} from "./session-removals";
import { useSessionRest } from "./use-session-rest";
import { sessionErrors, focusSessionError } from "./session-validation";
import {
  recoverSession,
  acceptSessionSave,
  type SessionDraftState,
  type InvalidSessionTimes,
} from "./session-recovery";

function recover(key: string, session: Workout): SessionDraftState {
  try {
    return recoverSession(sessionStorage.getItem(key), session);
  } catch {
    return recoverSession(null, session);
  }
}
export function SessionPage({ id }: { id: string }) {
  const q = useQuery({
    queryKey: ["fitness", "session", id],
    queryFn: () => api.getWorkout(id),
    refetchOnWindowFocus: false,
  });
  if (q.isPending) return <Loading />;
  if (q.error)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  return <SessionEditor key={id} session={q.data} />;
}
function SessionEditor({ session }: { session: Workout }) {
  const { user, preferences } = useMe();
  const timezone = preferences.timezone;
  const storageKey = `168hours:strength-draft:${user.id}:${session.id}`;
  const editorRef = useRef<HTMLDivElement>(null);
  const cache = useQueryClient();
  const router = useRouter();
  const [draft, setDraft] = useState(() => recover(storageKey, session));
  const [error, setError] = useState("");
  const [reviewEditing, setReviewEditing] = useState(
    () => !!session.endedAt && draft.dirty,
  );
  const [confirmation, setConfirmation] = useState<
    "finish" | "delete" | "reload" | null
  >(null);
  const [editing, setEditing] = useState(false);
  const [editorOpened, setEditorOpened] = useState(false);
  const timeError = Object.keys(draft.invalidTimes ?? {}).length > 0;
  const [storageError, setStorageError] = useState("");
  const { rest, startRest, clearRest } = useSessionRest(user.id, session.id);
  const currentDraft = useRef(draft);
  const [removal, setRemoval] = useState<{
    before: SessionDraft["exercises"];
    after: SessionDraft["exercises"];
  } | null>(null);
  const [undoRemoval, setUndoRemoval] = useState<typeof removal>(null);
  function storeDraft(next: SessionDraftState) {
    currentDraft.current = next;
    setDraft(next);
    try {
      if (next.dirty || next.pending)
        sessionStorage.setItem(storageKey, JSON.stringify(next));
      else sessionStorage.removeItem(storageKey);
      setStorageError("");
    } catch {
      setStorageError(
        "Local draft storage is unavailable. Keep this page open until saving finishes.",
      );
    }
  }
  const save = useSessionSave({
    id: session.id,
    recovered: draft.pending,
    onAttempt: (pending) => storeDraft({ ...currentDraft.current, pending }),
    onSuccess: (saved, attempt) => {
      storeDraft(acceptSessionSave(currentDraft.current, attempt, saved));
      setError("");
      invalidateFitness(cache);
    },
    onFailure: (_error, uncertain) => {
      if (!uncertain)
        storeDraft({ ...currentDraft.current, pending: undefined });
    },
  });
  const remove = useCommand({
    mutationFn: (_: void, key: string) =>
      api.deleteWorkout(session.id, draft.version, key),
    onSuccess: () => {
      try {
        sessionStorage.removeItem(storageKey);
      } catch {}
      invalidateFitness(cache);
      router.push("/fitness/history");
    },
  });
  const reusable = useCommand({
    mutationFn: (_: void, key: string) =>
      api.createStrengthPlan(
        strengthPlanInput.parse(
          planInput(
            draft.input.title,
            draft.input.notes,
            draft.input.exercises,
            true,
          ),
        ),
        key,
      ),
    onSuccess: (p) => {
      invalidateFitness(cache);
      router.push(`/fitness/workout/${p.id}`);
    },
  });
  const start = useWorkoutStart();
  const repeat = useCommand({
    mutationFn: (_: void, key: string) =>
      api.repeatWorkout(session.id, draft.version, key),
    onSuccess: (w) => {
      invalidateFitness(cache);
      router.push(`/fitness/session/${w.id}`);
    },
  });
  const busy =
    save.isPending ||
    remove.isPending ||
    reusable.isPending ||
    repeat.isPending;
  function change(
    input: SessionDraft,
    invalidTimes: InvalidSessionTimes = draft.invalidTimes ?? {},
  ) {
    storeDraft({ ...currentDraft.current, input, invalidTimes, dirty: true });
    setError("");
  }
  const blocked =
    remove.isPending ||
    reusable.isPending ||
    repeat.isPending ||
    save.needsRetry ||
    draft.conflict ||
    save.conflict;
  useUnsavedChanges(
    busy || (draft.dirty && !!storageError),
    "These workout changes have not been saved. Leave and lose them?",
    busy,
  );
  function changeExercises(exercises: SessionDraft["exercises"]) {
    const before = currentDraft.current.input.exercises;
    if (removedResults(before, exercises)) {
      setRemoval({ before, after: exercises });
      return;
    }
    change({ ...currentDraft.current.input, exercises });
  }
  // Only one revision-checked write is in flight; uncertain responses require the same-key retry.
  useEffect(() => {
    if (!draft.dirty || draft.conflict || busy || save.error || timeError)
      return;
    const parsed = workoutUpdateInput.safeParse(sessionInput(draft.input));
    if (!parsed.success) return;
    const timer = setTimeout(() => {
      save.mutate(draft);
    }, 650);
    return () => clearTimeout(timer);
  }, [draft, busy, save, timeError]);
  const validation = workoutUpdateInput.safeParse(sessionInput(draft.input));
  function saveNow(input = draft.input) {
    if (timeError) {
      setError("Correct the date and time before saving.");
      requestAnimationFrame(() => focusSessionError(editorRef.current));
      return;
    }
    const parsed = workoutUpdateInput.safeParse(sessionInput(input));
    if (!parsed.success) {
      setError("Check the highlighted workout fields.");
      setReviewEditing(true);
      const actualError = parsed.error.issues.some((issue) =>
        /\.(reps|weightKg|durationSeconds|distanceMeters|laps)$/.test(
          issue.path.join("."),
        ),
      );
      setEditing(!actualError);
      setEditorOpened(true);
      requestAnimationFrame(() => focusSessionError(editorRef.current));
      return;
    }
    const next = { ...draft, input, dirty: true };
    change(input);
    save.mutate(next);
  }
  function updateTime(value: string, kind: "startedAt" | "endedAt") {
    try {
      const old = draft.input[kind];
      const instant =
        old && instantToLocalInput(old, timezone) === value
          ? old
          : localInputToInstant(value, timezone);
      const invalidTimes = { ...draft.invalidTimes };
      delete invalidTimes[kind];
      change({ ...draft.input, [kind]: instant }, invalidTimes);
    } catch {
      change(draft.input, { ...draft.invalidTimes, [kind]: value });
    }
  }
  const fields = sessionErrors(draft.input);
  const finished = !!draft.input.endedAt;
  useEffect(() => {
    if (finished) clearRest();
  }, [finished, clearRest]);
  function finish() {
    setConfirmation(null);
    setReviewEditing(false);
    saveNow({
      ...draft.input,
      endedAt: new Date(
        Math.max(Date.now(), Date.parse(draft.input.startedAt) + 1),
      ).toISOString(),
    });
  }
  const sessionOptions = (
    <div className="fitness-session-actions">
      <button
        className="button"
        disabled={
          busy || draft.dirty || draft.conflict || !draft.input.exercises.length
        }
        onClick={() => reusable.mutate()}
      >
        Save as reusable workout
      </button>
      <button
        className="button danger"
        disabled={busy || draft.conflict}
        onClick={() => setConfirmation("delete")}
      >
        {finished ? "Delete workout" : "Discard workout"}
      </button>
    </div>
  );
  const saveStatus = (
    <p
      role="status"
      className={`fitness-save-state${!draft.dirty && !draft.conflict && !save.isPending ? " sr-only" : ""}`}
    >
      {save.isPending
        ? save.needsRetry
          ? "Save needs confirmation"
          : "Saving…"
        : draft.conflict
          ? "Recovered draft conflicts with a newer saved workout"
          : draft.dirty
            ? "Unsaved changes"
            : "Saved"}
    </p>
  );
  return (
    <div className="fitness-session-workspace" ref={editorRef}>
      {finished && (
        <Link className="fitness-session-back" href="/fitness/history">
          <ArrowLeft size={16} aria-hidden="true" />
          History
        </Link>
      )}
      {removal && (
        <Dialog
          title="Remove recorded results?"
          onClose={() => setRemoval(null)}
        >
          <p>
            This removes {removedResults(removal.before, removal.after)}{" "}
            recorded{" "}
            {removedResults(removal.before, removal.after) === 1
              ? "set"
              : "sets"}{" "}
            from this session.
          </p>
          <div className="row">
            <button className="button" onClick={() => setRemoval(null)}>
              Keep results
            </button>
            <button
              className="button danger"
              onClick={() => {
                const exercises = applyRemoval(
                  currentDraft.current.input.exercises,
                  removal.before,
                  removal.after,
                );
                change({ ...currentDraft.current.input, exercises });
                setUndoRemoval(removal);
                setRemoval(null);
              }}
            >
              Remove results
            </button>
          </div>
        </Dialog>
      )}
      {undoRemoval && (
        <p role="status">
          Recorded results removed.{" "}
          <button
            className="button"
            disabled={
              blocked ||
              busy ||
              !restoreRemoval(
                draft.input.exercises,
                undoRemoval.before,
                undoRemoval.after,
              )
            }
            onClick={() => {
              const exercises = restoreRemoval(
                currentDraft.current.input.exercises,
                undoRemoval.before,
                undoRemoval.after,
              );
              if (exercises) {
                change({ ...currentDraft.current.input, exercises });
                setUndoRemoval(null);
              }
            }}
          >
            Undo removal
          </button>
        </p>
      )}
      {confirmation && (
        <FitnessConfirm
          title={
            confirmation === "finish"
              ? "Finish this workout?"
              : confirmation === "reload"
                ? "Discard local changes?"
                : finished
                  ? "Delete recorded workout?"
                  : "Discard this workout?"
          }
          description={
            confirmation === "finish"
              ? "Skipped and unfinished sets will stay as they are."
              : confirmation === "reload"
                ? "Load the latest saved workout and remove your local edits."
                : finished
                  ? "This removes its results and recorded Calendar time. Planned time stays."
                  : "This removes the session and its results. Your reusable workout stays."
          }
          action={
            confirmation === "finish"
              ? "Finish workout"
              : confirmation === "reload"
                ? "Discard and reload"
                : finished
                  ? "Delete workout"
                  : "Discard workout"
          }
          cancel={confirmation === "finish" ? "Keep training" : "Cancel"}
          danger={confirmation !== "finish"}
          busy={busy}
          onCancel={() => setConfirmation(null)}
          onConfirm={() => {
            if (confirmation === "finish") finish();
            else if (confirmation === "delete") remove.mutate();
            else {
              try {
                sessionStorage.removeItem(storageKey);
                window.location.reload();
              } catch {
                setStorageError(
                  "Could not clear local recovery. Your changes have been kept.",
                );
                setConfirmation(null);
              }
            }
          }}
        >
          <CommandError command={remove} />
        </FitnessConfirm>
      )}
      {start.dialog}
      <ProgramSessionLink id={session.id} />
      {finished ? (
        <header className="fitness-session-header">
          <div>
            <p className="fitness-live-eyebrow">
              {reviewEditing ? "Correct recorded workout" : "Workout review"}
            </p>
            <h1>{draft.input.title}</h1>
          </div>
          <div className="fitness-session-tools">
            {saveStatus}
            <button
              className="button"
              disabled={blocked || (reviewEditing && (busy || draft.dirty))}
              onClick={() => setReviewEditing(!reviewEditing)}
            >
              {reviewEditing ? "Done correcting" : "Correct results"}
            </button>
          </div>
        </header>
      ) : (
        <header className="fitness-session-header">
          <div>
            <p className="fitness-live-eyebrow">Workout in progress</p>
            <h1>{draft.input.title}</h1>
          </div>
          <div className="fitness-session-tools">
            {saveStatus}
            <TooltipButton
              type="button"
              className="button fitness-session-edit"
              tooltip={editing ? "Back to training" : "Edit workout"}
              aria-label={editing ? "Back to training" : "Edit workout"}
              disabled={blocked}
              onClick={() => {
                setEditing(!editing);
                setEditorOpened(true);
              }}
            >
              {editing ? (
                <ArrowLeft size={16} aria-hidden="true" />
              ) : (
                <SlidersHorizontal size={16} aria-hidden="true" />
              )}
              <span>{editing ? "Back to training" : "Edit workout"}</span>
            </TooltipButton>
          </div>
        </header>
      )}
      {finished && !reviewEditing && <WorkoutReview value={draft.input} />}
      {finished && reviewEditing && (
        <p className="fitness-scope-note">
          Correcting this recorded workout. Changes save automatically.
        </p>
      )}
      {!finished && draft.input.notes && (
        <p className="fitness-live-note">{draft.input.notes}</p>
      )}
      {draft.conflict && (
        <p className="error" role="alert">
          The saved workout changed elsewhere. Your recovered draft has been
          kept, but it will not overwrite newer changes.
        </p>
      )}
      {(draft.conflict || (save.error && !save.needsRetry)) && (
        <button className="button" onClick={() => setConfirmation("reload")}>
          Discard local edits and reload
        </button>
      )}
      {storageError && (
        <p className="error" role="alert">
          {storageError}
        </p>
      )}

      <div className="form-stack">
        <RestTimer
          key={rest?.until ?? "idle"}
          until={rest?.until ?? null}
          label={rest?.exercise}
          onCancel={clearRest}
        />
        <fieldset
          hidden={finished && !reviewEditing}
          className="form-stack"
          disabled={blocked || !!removal}
        >
          {!finished ? (
            <>
              <div hidden={editing}>
                <LiveWorkout
                  sessionId={session.id}
                  value={draft.input.exercises}
                  onChange={changeExercises}
                  disabled={blocked || !!removal}
                  errors={fields}
                  onRest={startRest}
                />
              </div>
              {editorOpened && (
                <div hidden={!editing}>
                  <SessionPlanEditor
                    sessionId={session.id}
                    value={draft.input.exercises}
                    onChange={changeExercises}
                    disabled={blocked || !!removal}
                    errors={fields}
                  />
                </div>
              )}
            </>
          ) : reviewEditing ? (
            <StrengthExercises
              building
              initiallyCollapsed
              session
              sessionId={session.id}
              value={draft.input.exercises}
              onChange={changeExercises}
              errors={fields}
              disabled={blocked || !!removal}
            />
          ) : null}
        </fieldset>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {draft.dirty && !validation.success && !error && (
          <p className="error" role="alert">
            Check the highlighted workout fields.
          </p>
        )}
        <CommandError command={save} />
        {confirmation !== "delete" && <CommandError command={remove} />}
        <CommandError command={reusable} />
        <CommandError command={repeat} />
        <div className="fitness-session-actions">
          {draft.dirty && (
            <button
              className="button"
              disabled={busy || draft.conflict || !draft.dirty}
              onClick={() => saveNow()}
            >
              Save changes
            </button>
          )}
          {!finished && !editing && (
            <button
              className={`button${draft.input.exercises.every((e) => e.sets.every((set) => set.completed || set.skipped)) ? " primary" : ""}`}
              disabled={
                busy ||
                draft.conflict ||
                !draft.input.exercises.some((e) =>
                  e.sets.some((set) => set.completed && !set.skipped),
                )
              }
              onClick={() => {
                const unfinished = draft.input.exercises.some((e) =>
                  e.sets.some((set) => !set.completed && !set.skipped),
                );
                if (unfinished) setConfirmation("finish");
                else finish();
              }}
            >
              Finish workout
            </button>
          )}
          {finished && !reviewEditing && (
            <button
              className="button primary"
              disabled={busy || draft.dirty || draft.conflict}
              onClick={() => void start.request(() => repeat.mutate())}
            >
              Repeat workout
            </button>
          )}
        </div>
        <details
          hidden={finished && !reviewEditing}
          open={
            !!(
              fields.title ||
              fields.notes ||
              fields.startedAt ||
              fields.endedAt
            ) || undefined
          }
          className="fitness-workout-details fitness-session-details"
        >
          <summary className="fitness-inline-editor-heading">
            <Settings2 size={16} aria-hidden="true" />
            Workout details
            <ChevronDown
              size={16}
              className="fitness-disclosure-chevron"
              aria-hidden="true"
            />
          </summary>
          <fieldset className="form-stack" disabled={blocked || !!removal}>
            <label className="field">
              Workout name
              <input
                maxLength={160}
                aria-invalid={!!fields.title}
                aria-describedby={
                  fields.title ? "session-title-error" : undefined
                }
                value={draft.input.title}
                onChange={(e) =>
                  change({ ...draft.input, title: e.target.value })
                }
              />
            </label>
            {fields.title && (
              <p id="session-title-error" role="alert" className="error">
                {fields.title}
              </p>
            )}
            <p className="muted text-small">Times in {timezone}</p>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="session-start">Started at</label>
                <input
                  id="session-start"
                  type="datetime-local"
                  value={
                    draft.invalidTimes?.startedAt ??
                    instantToLocalInput(draft.input.startedAt, timezone)
                  }
                  aria-invalid={
                    draft.invalidTimes?.startedAt !== undefined ||
                    !!fields.startedAt
                  }
                  aria-describedby={
                    draft.invalidTimes?.startedAt !== undefined ||
                    fields.startedAt
                      ? "session-start-error"
                      : undefined
                  }
                  onChange={(e) => updateTime(e.target.value, "startedAt")}
                />
                {(draft.invalidTimes?.startedAt !== undefined ||
                  fields.startedAt) && (
                  <span id="session-start-error" className="error" role="alert">
                    Choose an unambiguous start time that exists in your
                    timezone.
                  </span>
                )}
              </div>
              {finished && (
                <div className="field">
                  <label htmlFor="session-end">Finished at</label>
                  <input
                    id="session-end"
                    type="datetime-local"
                    value={
                      draft.invalidTimes?.endedAt ??
                      instantToLocalInput(draft.input.endedAt!, timezone)
                    }
                    aria-invalid={
                      draft.invalidTimes?.endedAt !== undefined ||
                      !!fields.endedAt
                    }
                    aria-describedby={
                      draft.invalidTimes?.endedAt !== undefined ||
                      fields.endedAt
                        ? "session-end-error"
                        : undefined
                    }
                    onChange={(e) => updateTime(e.target.value, "endedAt")}
                  />
                  {(draft.invalidTimes?.endedAt !== undefined ||
                    fields.endedAt) && (
                    <span id="session-end-error" className="error" role="alert">
                      {fields.endedAt ??
                        "Choose an unambiguous finish time that exists in your timezone."}
                    </span>
                  )}
                </div>
              )}
            </div>
            <NotesField
              label="Workout notes"
              value={draft.input.notes}
              error={fields.notes}
              onChange={(notes) => change({ ...draft.input, notes })}
            />
          </fieldset>
          {!finished && sessionOptions}
        </details>
        {finished && !reviewEditing && (
          <>
            <WorkoutComparison id={session.id} version={draft.version} />
            <details className="fitness-secondary">
              <summary>More actions</summary>
              {sessionOptions}
            </details>
          </>
        )}
      </div>
    </div>
  );
}
