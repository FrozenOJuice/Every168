"use client";
import {
  ArrowLeft,
  ChevronDown,
  Clock,
  MoreHorizontal,
  SlidersHorizontal,
} from "lucide-react";
import {
  restoreStartingWorkout,
  startingSetupChanged,
  undoStartingRestore,
} from "./restore-starting-workout";
import { workoutCopySignature } from "./workout-copy-signature";
import { SessionStartField } from "./session-start-field";
import { SessionSaveFeedback } from "./session-save-feedback";
import { WorkoutReview } from "./workout-review";
import { FitnessConfirm } from "./fitness-confirm";
import { useWorkoutStart } from "./active-workouts";
import { WorkoutEditor } from "./workout-editor";
import { useFitnessExercisePanel } from "./fitness-exercise-workspace";
import { LiveWorkoutStatus } from "./live-workout-status";
import { LiveWorkout } from "./live-workout";
import { TooltipButton } from "@/components/ui/tooltip-button";
import { ProgramSessionLink } from "./program-detail";
import { WorkoutComparison } from "./workout-comparison";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
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
import { sessionInput, planInput, type SessionDraft } from "./strength-draft";
import { invalidateFitness } from "./fitness-cache";
import { RestTimer } from "./rest-timer";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";
import { Toast, useToast, type ToastNotice } from "@/components/ui/toast";
import { ContextMenu } from "@/components/ui/context-menu";
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
  const { setSessionEditor, setRecordedSession } = useFitnessExercisePanel();
  const timezone = preferences.timezone;
  const storageKey = `168hours:strength-draft:${user.id}:${session.id}`;
  const editorRef = useRef<HTMLDivElement>(null);
  const cache = useQueryClient();
  const router = useRouter();
  const [draft, setDraft] = useState(() => recover(storageKey, session));
  const lastSavedWorkout = useRef(session);
  const [confirmedFinished, setConfirmedFinished] = useState(!!session.endedAt);
  const finishRequested = !!draft.input.endedAt && !confirmedFinished;
  const copyStorageKey = `168hours:last-workout-copy:${user.id}:${session.id}`;
  const [lastCopiedSetup, setLastCopiedSetup] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(copyStorageKey);
    } catch {
      return null;
    }
  });
  const copySetup = planInput(
    draft.input.title,
    draft.input.notes,
    draft.input.exercises,
  );
  const currentCopySignature = workoutCopySignature(copySetup);
  const startingCopySignature = session.startingSetup
    ? workoutCopySignature(session.startingSetup)
    : null;
  const copyUnchanged =
    currentCopySignature === startingCopySignature ||
    currentCopySignature === lastCopiedSetup;
  const [error, setError] = useState("");
  const { notice, show, dismiss } = useToast<
    ToastNotice & { durationMs?: number }
  >();
  const [timingOpen, setTimingOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(!!draft.input.notes);
  const [reviewEditing, setReviewEditing] = useState(
    () => !!session.endedAt && draft.dirty,
  );
  const [confirmation, setConfirmation] = useState<
    "finish" | "delete" | "reload" | null
  >(null);
  const [restoreConfirm, setRestoreConfirm] = useState(false);
  const [repeatConfirm, setRepeatConfirm] = useState(false);
  const [cancelCorrectionsConfirm, setCancelCorrectionsConfirm] =
    useState(false);
  const [editing, setEditing] = useState(false);
  const [returning, setReturning] = useState(false);
  const returnRequested = useRef(false);
  const [actionsMenu, setActionsMenu] = useState<{
    anchor: HTMLElement;
    x: number;
    y: number;
  } | null>(null);
  const closeActions = useCallback(() => setActionsMenu(null), []);
  const [editorOpened, setEditorOpened] = useState(false);
  const timeError = Object.keys(draft.invalidTimes ?? {}).length > 0;
  const [storageError, setStorageError] = useState("");
  const { rest, startRest, clearRest, cancelSetRest } = useSessionRest(
    user.id,
    session.id,
    draft.input.exercises,
  );
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
      lastSavedWorkout.current = saved;
      const next = acceptSessionSave(currentDraft.current, attempt, saved);
      storeDraft(next);
      setConfirmedFinished(!!saved.endedAt);
      if (returnRequested.current && !next.dirty) {
        returnRequested.current = false;
        setReturning(false);
        setEditing(false);
        setReviewEditing(false);
      } else if (
        returnRequested.current &&
        (Object.keys(next.invalidTimes ?? {}).length ||
          !workoutUpdateInput.safeParse(sessionInput(next.input)).success)
      ) {
        returnRequested.current = false;
        setReturning(false);
      }
      setError("");
      invalidateFitness(cache);
    },
    onFailure: (_error, uncertain) => {
      returnRequested.current = false;
      setReturning(false);
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
        sessionStorage.removeItem(copyStorageKey);
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
          ),
        ),
        key,
      ),
    onSuccess: (p) => {
      const signature = workoutCopySignature(p);
      setLastCopiedSetup(signature);
      try {
        sessionStorage.setItem(copyStorageKey, signature);
      } catch {
        /* Keep the mounted-session guard if storage is unavailable. */
      }
      invalidateFitness(cache);
      show({
        message: "Workout saved",
        kind: "success",
        action: {
          label: "Edit workout",
          onClick: () => router.push(`/fitness/workout/${p.id}`),
        },
      });
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
    dismiss();
    storeDraft({ ...currentDraft.current, input, invalidTimes, dirty: true });
    setError("");
  }
  const blocked =
    finishRequested ||
    remove.isPending ||
    reusable.isPending ||
    repeat.isPending ||
    save.needsRetry ||
    draft.conflict ||
    save.conflict;
  useUnsavedChanges(
    busy || (draft.dirty && (confirmedFinished || !!storageError)),
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
    if (
      !draft.dirty ||
      draft.conflict ||
      busy ||
      save.error ||
      timeError ||
      (confirmedFinished && !returnRequested.current)
    )
      return;
    const parsed = workoutUpdateInput.safeParse(sessionInput(draft.input));
    if (!parsed.success) return;
    const timer = setTimeout(() => {
      save.mutate(draft);
    }, 650);
    return () => clearTimeout(timer);
  }, [draft, busy, save, timeError, confirmedFinished]);
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
  function doneEditing() {
    if (
      draft.conflict ||
      save.conflict ||
      remove.isPending ||
      reusable.isPending ||
      repeat.isPending
    )
      return;
    if (!save.needsRetry && (timeError || !validation.success)) {
      saveNow();
      return;
    }
    if (!draft.dirty && !save.isPending) {
      setEditing(false);
      setReviewEditing(false);
      return;
    }
    returnRequested.current = true;
    setReturning(true);
    if (save.needsRetry) save.retry();
    else if (!save.retrying) saveNow();
  }
  const cancelCorrectionsBlocked = busy || returning || !!removal;
  function discardCorrections() {
    if (cancelCorrectionsBlocked) return;
    const saved =
      session.version > lastSavedWorkout.current.version
        ? session
        : lastSavedWorkout.current;
    storeDraft(recoverSession(null, saved));
    save.reset();
    returnRequested.current = false;
    setReturning(false);
    setReviewEditing(false);
    setEditing(false);
    setCancelCorrectionsConfirm(false);
    setError("");
    setUndoRemoval(null);
    setNotesOpen(!!saved.notes);
    invalidateFitness(cache);
  }
  function cancelCorrections() {
    if (cancelCorrectionsBlocked) return;
    if (draft.dirty) setCancelCorrectionsConfirm(true);
    else discardCorrections();
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
  if (fields.notes && !notesOpen) setNotesOpen(true);
  const finished = !!draft.input.endedAt && confirmedFinished;
  useLayoutEffect(() => {
    setRecordedSession(finished ? `/fitness/session/${session.id}` : null);
    return () => setRecordedSession(null);
  }, [finished, session.id, setRecordedSession]);
  useLayoutEffect(() => {
    setSessionEditor(
      editing || reviewEditing ? `/fitness/session/${session.id}` : null,
    );
    return () => setSessionEditor(null);
  }, [editing, reviewEditing, session.id, setSessionEditor]);

  const metadataInvalid = !!(
    fields.title ||
    fields.notes ||
    fields.startedAt ||
    fields.endedAt ||
    timeError
  );
  if ((timeError || fields.startedAt || fields.endedAt) && !timingOpen)
    setTimingOpen(true);
  if (metadataInvalid && !finished && !editing) {
    setEditing(true);
    setEditorOpened(true);
  }
  if (metadataInvalid && finished && !reviewEditing) setReviewEditing(true);

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
  const starting = session.startingSetup;
  const canRestore =
    !finished && starting && startingSetupChanged(draft.input, starting);
  const restoreRemoves = starting
    ? removedResults(
        draft.input.exercises,
        restoreStartingWorkout(draft.input, starting).exercises,
      )
    : 0;
  function restoreSetup() {
    if (!starting) return;
    const before = currentDraft.current.input;
    change(restoreStartingWorkout(before, starting));
    setRestoreConfirm(false);
    show({
      message: "Starting workout restored",
      durationMs: 8000,
      kind: "success",
      action: {
        label: "Undo",
        onClick: () =>
          change(undoStartingRestore(before, currentDraft.current.input)),
      },
    });
  }
  const sessionOptions = (
    <div className="fitness-session-actions">
      <div className="fitness-session-setup-actions" hidden={reviewEditing}>
        <button
          className="button"
          disabled={
            busy ||
            draft.dirty ||
            draft.conflict ||
            !draft.input.exercises.length ||
            copyUnchanged
          }
          onClick={() => {
            if (!copyUnchanged) reusable.mutate();
          }}
        >
          Save as new workout
        </button>
        {canRestore && (
          <button
            className="button"
            disabled={busy || draft.dirty || blocked}
            onClick={() =>
              restoreRemoves ? setRestoreConfirm(true) : restoreSetup()
            }
          >
            Restore starting workout
          </button>
        )}
      </div>
      {reviewEditing && (
        <button
          className="button"
          disabled={cancelCorrectionsBlocked}
          onClick={cancelCorrections}
        >
          Cancel
        </button>
      )}
      {editing || reviewEditing ? (
        <button
          className="button primary fitness-session-done"
          disabled={
            returning ||
            save.retrying ||
            draft.conflict ||
            save.conflict ||
            remove.isPending ||
            reusable.isPending ||
            repeat.isPending ||
            !!removal
          }
          onClick={doneEditing}
        >
          {returning || save.retrying
            ? "Saving…"
            : save.error && !save.conflict && !draft.conflict
              ? "Retry save"
              : reviewEditing
                ? "Save corrections"
                : "Done editing"}
        </button>
      ) : (
        <button
          className="button danger"
          disabled={busy || draft.conflict}
          onClick={() => setConfirmation("delete")}
        >
          {finished ? "Delete workout" : "Discard workout"}
        </button>
      )}
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
  const timing = (
    <>
      {finished ? (
        <div className="fitness-session-timing-heading">
          <h2>Timing</h2>
          <span className="muted text-small">{timezone}</span>
        </div>
      ) : (
        <div className="fitness-session-start-heading">
          <label htmlFor="session-start">Started at</label>
          <span className="muted text-small">{timezone}</span>
        </div>
      )}
      <div className="form-grid fitness-live-timing-fields">
        <div className="field">
          {finished && <label htmlFor="session-start">Started at</label>}
          <SessionStartField
            value={
              draft.invalidTimes?.startedAt ??
              instantToLocalInput(draft.input.startedAt, timezone)
            }
            onChange={(value) => updateTime(value, "startedAt")}
            invalid={
              draft.invalidTimes?.startedAt !== undefined || !!fields.startedAt
            }
            describedBy={
              draft.invalidTimes?.startedAt !== undefined || fields.startedAt
                ? "session-start-error"
                : undefined
            }
            disabled={blocked || returning}
          />
          {(draft.invalidTimes?.startedAt !== undefined ||
            fields.startedAt) && (
            <span id="session-start-error" className="error" role="alert">
              Choose an unambiguous start time that exists in your timezone.
            </span>
          )}
        </div>
        {finished && (
          <div className="field">
            <label htmlFor="session-end">Finished at</label>
            <SessionStartField
              id="session-end"
              kind="finish"
              value={
                draft.invalidTimes?.endedAt ??
                instantToLocalInput(draft.input.endedAt!, timezone)
              }
              invalid={
                draft.invalidTimes?.endedAt !== undefined || !!fields.endedAt
              }
              describedBy={
                draft.invalidTimes?.endedAt !== undefined || fields.endedAt
                  ? "session-end-error"
                  : undefined
              }
              disabled={blocked || returning}
              onChange={(value) => updateTime(value, "endedAt")}
            />
            {(draft.invalidTimes?.endedAt !== undefined || fields.endedAt) && (
              <span id="session-end-error" className="error" role="alert">
                {fields.endedAt ??
                  "Choose an unambiguous finish time that exists in your timezone."}
              </span>
            )}
          </div>
        )}
      </div>
    </>
  );
  return (
    <div className="fitness-session-workspace" ref={editorRef}>
      {notice && (
        <Toast
          key={notice.id}
          {...notice}
          action={
            notice.action
              ? {
                  ...notice.action,
                  disabled: busy || draft.dirty || draft.conflict,
                }
              : undefined
          }
          onDismiss={() => dismiss(notice.id)}
        />
      )}
      {actionsMenu && (
        <ContextMenu
          {...actionsMenu}
          label="Workout actions"
          onClose={closeActions}
          actions={[
            {
              label: finished ? "Delete workout" : "Discard workout",
              destructive: true,
              disabled: busy || draft.conflict || returning,
              run: () => setConfirmation("delete"),
            },
          ]}
        />
      )}
      {restoreConfirm && (
        <FitnessConfirm
          title="Restore starting workout?"
          description={`This removes ${restoreRemoves} logged ${restoreRemoves === 1 ? "set" : "sets"} added since this workout started.`}
          action="Restore workout"
          danger
          busy={busy || blocked}
          onCancel={() => setRestoreConfirm(false)}
          onConfirm={restoreSetup}
        />
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
      {cancelCorrectionsConfirm && (
        <FitnessConfirm
          title="Discard corrections?"
          description="Return to the saved workout summary and discard your unsaved corrections."
          action="Discard corrections"
          cancel="Keep editing"
          danger
          busy={cancelCorrectionsBlocked}
          onCancel={() => setCancelCorrectionsConfirm(false)}
          onConfirm={discardCorrections}
        />
      )}
      {repeatConfirm && (
        <FitnessConfirm
          title="Repeat this workout?"
          description={`Start a new session of “${draft.input.title}” with the same exercises and targets.`}
          action="Start workout"
          cancel="Cancel"
          busy={busy || start.checking}
          onCancel={() => setRepeatConfirm(false)}
          onConfirm={() => {
            setRepeatConfirm(false);
            void start.request(() => repeat.mutate());
          }}
        />
      )}
      {start.dialog}
      {!editing && !reviewEditing && <ProgramSessionLink id={session.id} />}
      {((!finished && editorOpened) || reviewEditing) && (
        <div
          hidden={!editing && !reviewEditing}
          className="fitness-workout-builder fitness-session-shared-editor"
        >
          <div className="fitness-builder-form">
            <WorkoutEditor
              mode="session"
              heading={finished ? "Correct results" : "Edit workout"}
              backLabel={finished ? "Back to summary" : "Back to workout"}
              onBack={finished ? cancelCorrections : doneEditing}
              backDisabled={
                finished
                  ? cancelCorrectionsBlocked
                  : blocked || metadataInvalid || returning
              }
              headerActions={
                <div className="fitness-session-editor-tools">
                  {saveStatus}
                  <TooltipButton
                    type="button"
                    className="icon-button"
                    tooltip="Workout actions"
                    aria-label="Workout actions"
                    aria-haspopup="menu"
                    aria-expanded={!!actionsMenu}
                    disabled={busy || returning}
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
                </div>
              }
              name={draft.input.title}
              notes={draft.input.notes}
              notesOpen={notesOpen}
              onNotesOpenChange={setNotesOpen}
              onNameChange={(title) =>
                change({ ...currentDraft.current.input, title })
              }
              onNotesChange={(notes) =>
                change({ ...currentDraft.current.input, notes })
              }
              disabled={blocked || !!removal || returning}
              errors={fields}
              timing={
                <details
                  className="fitness-inline-editor"
                  open={timingOpen}
                  onToggle={(event) => {
                    if (event.currentTarget.open !== timingOpen)
                      setTimingOpen(event.currentTarget.open);
                  }}
                >
                  <summary
                    className="fitness-inline-editor-heading"
                    role="button"
                    aria-expanded={timingOpen}
                  >
                    <Clock size={16} aria-hidden="true" />
                    {finished ? "Adjust workout time" : "Adjust start time"}
                    <ChevronDown
                      className="fitness-disclosure-chevron"
                      size={16}
                      aria-hidden="true"
                    />
                  </summary>
                  <div className="form-stack" style={{ padding: 12 }}>
                    {timing}
                  </div>
                </details>
              }
              notices={
                <>
                  <RestTimer
                    key={rest?.until ?? "idle"}
                    until={rest?.until ?? null}
                    label={rest?.exercise}
                    onCancel={clearRest}
                  />
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
                  <CommandError command={reusable} />
                </>
              }
              context={
                <p className="fitness-builder-context">
                  {finished
                    ? "Correct recorded results. Your reusable workout stays unchanged."
                    : "Changes apply to this session only."}
                </p>
              }
              exercises={{
                value: draft.input.exercises,
                onChange: changeExercises,
                initiallyCollapsed: true,
                sessionId: session.id,
                session: finished,
                disabled: blocked || !!removal || returning,
                errors: fields,
              }}
              footer={
                <>
                  {(editing || reviewEditing) && (
                    <SessionSaveFeedback
                      error={save.error}
                      conflict={draft.conflict || save.conflict}
                      needsRetry={save.needsRetry}
                      onReload={() => setConfirmation("reload")}
                    />
                  )}
                  {sessionOptions}
                </>
              }
            />
          </div>
        </div>
      )}
      {finished
        ? !reviewEditing && (
            <header className="fitness-session-header fitness-summary-header">
              <div className="fitness-summary-navigation">
                <Link className="fitness-session-back" href="/fitness/history">
                  <ArrowLeft size={16} aria-hidden="true" />
                  Back to history
                </Link>
                <div className="fitness-session-tools">
                  {saveStatus}
                  <button
                    className="button"
                    disabled={blocked}
                    onClick={() => setReviewEditing(true)}
                  >
                    Correct results
                  </button>
                </div>
              </div>
            </header>
          )
        : !editing && (
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
                  tooltip={editing ? "Back to workout" : "Edit workout"}
                  aria-label={editing ? "Back to workout" : "Edit workout"}
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
                  <span>{editing ? "Back to workout" : "Edit workout"}</span>
                </TooltipButton>
              </div>
            </header>
          )}
      {finished && !reviewEditing && <WorkoutReview value={draft.input} />}
      {!finished && !editing && draft.input.notes && (
        <p className="fitness-live-note">{draft.input.notes}</p>
      )}
      {storageError && (
        <p className="error" role="alert">
          {storageError}
        </p>
      )}

      <div className="form-stack" hidden={editing || reviewEditing}>
        {!finished && (
          <LiveWorkoutStatus
            startedAt={draft.input.startedAt}
            exercises={draft.input.exercises}
          >
            <RestTimer
              key={rest?.until ?? "idle"}
              until={rest?.until ?? null}
              label={rest?.exercise}
              onCancel={clearRest}
            />
            {!editing && (
              <SessionSaveFeedback
                error={save.error}
                conflict={draft.conflict || save.conflict}
                needsRetry={save.needsRetry}
                retrying={save.retrying}
                onRetry={() => (save.needsRetry ? save.retry() : saveNow())}
                onReload={() => setConfirmation("reload")}
              />
            )}
          </LiveWorkoutStatus>
        )}
        <fieldset
          hidden={finished && !reviewEditing}
          className="form-stack"
          disabled={blocked || !!removal || returning}
        >
          {!finished ? (
            <>
              <div hidden={editing}>
                <LiveWorkout
                  sessionId={session.id}
                  value={draft.input.exercises}
                  onChange={changeExercises}
                  disabled={blocked || !!removal || returning}
                  errors={fields}
                  onRest={startRest}
                  onUndoRest={cancelSetRest}
                />
              </div>
            </>
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

        {confirmation !== "delete" && <CommandError command={remove} />}
        <CommandError command={reusable} />
        <CommandError command={repeat} />
        <div className="fitness-session-actions">
          {!finished && !editing && (
            <button
              className={`button${draft.input.exercises.every((e) => e.sets.every((set) => set.completed || set.skipped)) ? " primary" : ""}`}
              data-finish-workout
              disabled={
                busy ||
                blocked ||
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
              {finishRequested
                ? save.retrying
                  ? "Finishing…"
                  : "Finish pending"
                : "Finish workout"}
            </button>
          )}
          {finished && !reviewEditing && (
            <>
              <button
                className="button"
                disabled={
                  busy || start.checking || draft.dirty || draft.conflict
                }
                onClick={() => setRepeatConfirm(true)}
              >
                Repeat workout
              </button>
              <Link
                className="button primary fitness-session-done"
                href="/fitness"
              >
                Back to training
              </Link>
            </>
          )}
        </div>
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
