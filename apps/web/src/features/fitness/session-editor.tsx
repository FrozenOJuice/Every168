"use client";
import { ProgramSessionLink } from "./program-detail";
import { WorkoutComparison } from "./workout-comparison";
import { NotesField } from "./notes-field";
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
import { ErrorState, Loading, PageHeading } from "@/components/ui/feedback";
import { StrengthExercises } from "./strength-exercises";
import {
  sessionDraft,
  sessionInput,
  planInput,
  type SessionDraft,
} from "./strength-draft";
import { invalidateFitness } from "./fitness-cache";
import { RestTimer } from "./rest-timer";
import {
  recoverSession,
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
  const focusRef = useRef<{
    index: number;
    start: number | null;
    end: number | null;
  } | null>(null);
  const restoreFocus = useRef(false);
  const rememberFocus = useCallback(() => {
    const fields = Array.from(
      editorRef.current?.querySelectorAll<
        HTMLInputElement | HTMLTextAreaElement
      >("input,textarea") ?? [],
    );
    const active = document.activeElement;
    const index = fields.findIndex((field) => field === active);
    const field = fields[index];
    focusRef.current = field
      ? { index, start: field.selectionStart, end: field.selectionEnd }
      : null;
  }, []);
  const cache = useQueryClient();
  const router = useRouter();
  const [draft, setDraft] = useState(() => recover(storageKey, session));
  const [error, setError] = useState("");
  const timeError = Object.keys(draft.invalidTimes ?? {}).length > 0;
  const [storageError, setStorageError] = useState("");
  const [restUntil, setRestUntil] = useState<number | null>(null);
  const save = useCommand({
    mutationFn: (attempt: SessionDraftState, key: string) =>
      api.saveWorkout(
        session.id,
        workoutUpdateInput.parse(sessionInput(attempt.input)),
        attempt.version,
        key,
      ),
    onSuccess: (w) => {
      setDraft({
        input: sessionDraft(w),
        version: w.version,
        dirty: false,
        conflict: false,
      });
      setError("");
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        setStorageError(
          "Local draft storage is unavailable. Wait for Saved before leaving.",
        );
      }
      invalidateFitness(cache);
      restoreFocus.current = true;
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
    const next = { ...draft, input, invalidTimes, dirty: true };
    setDraft(next);
    setError("");
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      setStorageError(
        "Local draft storage is unavailable. Wait for Saved before leaving.",
      );
    }
  }
  // Only one revision-checked write is in flight; uncertain responses require the same-key retry.
  useEffect(() => {
    if (!draft.dirty || draft.conflict || busy || save.error || timeError)
      return;
    const parsed = workoutUpdateInput.safeParse(sessionInput(draft.input));
    if (!parsed.success) return;
    const timer = setTimeout(() => {
      rememberFocus();
      save.mutate(draft);
    }, 650);
    return () => clearTimeout(timer);
  }, [draft, busy, save, timeError, rememberFocus]);
  useLayoutEffect(() => {
    if (busy || !restoreFocus.current) return;
    restoreFocus.current = false;
    const previous = focusRef.current;
    if (!previous || document.activeElement !== document.body) return;
    const field = editorRef.current?.querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement
    >("input,textarea")[previous.index];
    field?.focus({ preventScroll: true });
    if (field && previous.start !== null && previous.end !== null)
      field.setSelectionRange(previous.start, previous.end);
  }, [busy, draft]);
  const validation = workoutUpdateInput.safeParse(sessionInput(draft.input));
  function saveNow(input = draft.input) {
    if (timeError) {
      setError("Correct the date and time before saving.");
      return;
    }
    const parsed = workoutUpdateInput.safeParse(sessionInput(input));
    if (!parsed.success) {
      setError(parsed.error.issues[0]!.message);
      return;
    }
    const next = { ...draft, input, dirty: true };
    change(input);
    rememberFocus();
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
  const finished = !!draft.input.endedAt;
  return (
    <div className="fitness-session-workspace" ref={editorRef}>
      <Link href="/fitness/history">← History</Link>
      <ProgramSessionLink id={session.id} />
      <PageHeading
        title={finished ? "Workout review" : "Workout in progress"}
        description={
          finished
            ? "Review or correct what you actually did."
            : "Record each set as you go. Targets stay separate from your results."
        }
      />
      <p role="status" className="fitness-save-state">
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
      {draft.conflict && (
        <p className="error" role="alert">
          The saved workout changed elsewhere. Your recovered draft has been
          kept, but it will not overwrite newer changes.
        </p>
      )}
      {(draft.conflict || save.error) && (
        <button
          className="button"
          onClick={() => {
            if (
              confirm("Discard local edits and load the latest saved workout?")
            ) {
              sessionStorage.removeItem(storageKey);
              window.location.reload();
            }
          }}
        >
          Discard local edits and reload
        </button>
      )}
      {storageError && (
        <p className="error" role="alert">
          {storageError}
        </p>
      )}
      {finished && (
        <WorkoutComparison id={session.id} version={draft.version} />
      )}
      <div className="form-stack">
        <fieldset className="form-stack" disabled={busy || draft.conflict}>
          <details className="fitness-workout-details">
            <summary>Workout details</summary>
            <div className="form-stack">
              {" "}
              <label className="field">
                Workout name
                <input
                  maxLength={160}
                  value={draft.input.title}
                  onChange={(e) =>
                    change({ ...draft.input, title: e.target.value })
                  }
                />
              </label>
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
                    aria-invalid={draft.invalidTimes?.startedAt !== undefined}
                    aria-describedby={
                      draft.invalidTimes?.startedAt !== undefined
                        ? "session-start-error"
                        : undefined
                    }
                    onChange={(e) => updateTime(e.target.value, "startedAt")}
                  />
                  {draft.invalidTimes?.startedAt !== undefined && (
                    <span
                      id="session-start-error"
                      className="error"
                      role="alert"
                    >
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
                      aria-invalid={draft.invalidTimes?.endedAt !== undefined}
                      aria-describedby={
                        draft.invalidTimes?.endedAt !== undefined
                          ? "session-end-error"
                          : undefined
                      }
                      onChange={(e) => updateTime(e.target.value, "endedAt")}
                    />
                    {draft.invalidTimes?.endedAt !== undefined && (
                      <span
                        id="session-end-error"
                        className="error"
                        role="alert"
                      >
                        Choose an unambiguous finish time that exists in your
                        timezone.
                      </span>
                    )}
                  </div>
                )}
              </div>
              <NotesField
                label="Workout notes"
                value={draft.input.notes}
                onChange={(notes) => change({ ...draft.input, notes })}
              />
            </div>
          </details>
          <StrengthExercises
            session
            sessionId={session.id}
            value={draft.input.exercises}
            onChange={(exercises) => change({ ...draft.input, exercises })}
            disabled={busy || draft.conflict}
            onRest={(seconds) => setRestUntil(Date.now() + seconds * 1000)}
          />
        </fieldset>
        <RestTimer until={restUntil} onCancel={() => setRestUntil(null)} />
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {draft.dirty && !validation.success && (
          <p className="error" role="alert">
            {validation.error.issues[0]!.message}
          </p>
        )}
        <CommandError command={save} />
        <CommandError command={remove} />
        <CommandError command={reusable} />
        <CommandError command={repeat} />
        <div className="fitness-session-actions">
          <button
            className="button"
            disabled={busy || draft.conflict || !draft.dirty}
            onClick={() => saveNow()}
          >
            Save changes
          </button>
          {!finished && (
            <button
              className="button primary"
              disabled={busy || draft.conflict}
              onClick={() => {
                const unfinished = draft.input.exercises.some((e) =>
                  e.sets.some((s) => !s.completed && !s.skipped),
                );
                if (
                  unfinished &&
                  !confirm(
                    "Finish with unfinished sets? They will remain unfinished.",
                  )
                )
                  return;
                saveNow({
                  ...draft.input,
                  endedAt: new Date(
                    Math.max(Date.now(), Date.parse(draft.input.startedAt) + 1),
                  ).toISOString(),
                });
              }}
            >
              Finish workout
            </button>
          )}
          {finished && (
            <button
              className="button"
              disabled={busy || draft.dirty || draft.conflict}
              onClick={() => repeat.mutate()}
            >
              Repeat workout
            </button>
          )}
          <button
            className="button"
            disabled={
              busy ||
              draft.dirty ||
              draft.conflict ||
              !draft.input.exercises.length
            }
            onClick={() => reusable.mutate()}
          >
            Save as reusable workout
          </button>
          <button
            className="button danger"
            disabled={busy || draft.conflict}
            onClick={() => {
              if (
                confirm(
                  finished
                    ? "Delete this workout and its recorded Calendar time?"
                    : "Discard this workout?",
                )
              )
                remove.mutate();
            }}
          >
            {finished ? "Delete workout" : "Discard workout"}
          </button>
        </div>
      </div>
    </div>
  );
}
