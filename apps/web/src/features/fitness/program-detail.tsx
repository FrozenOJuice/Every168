"use client";
import { FitnessConfirm } from "./fitness-confirm";
import { useWorkoutStart } from "./active-workouts";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";
import { z } from "zod";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  instantToLocalInput,
  localInputToInstant,
} from "@168hours/domain-utils";
import {
  programScheduleInput,
  type TrainingProgram,
  type ProgramScheduleInput,
} from "@168hours/contracts";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { useCommand, CommandError } from "@/lib/use-command";
import { ErrorState, Loading, PageHeading } from "@/components/ui/feedback";
import { Dialog } from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import { invalidateFitness } from "./fitness-cache";
import { programCadence } from "./programs-page";
export function ProgramPage({ id }: { id: string }) {
  const q = useQuery({
    queryKey: ["fitness", "program", id],
    queryFn: () => api.getTrainingProgram(id),
    refetchInterval: 60000,
  });
  if (q.isPending) return <Loading />;
  if (q.error)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  return <ProgramDetail program={q.data} />;
}
function ProgramDetail({ program: p }: { program: TrainingProgram }) {
  const router = useRouter(),
    cache = useQueryClient(),
    timezone = useMe().preferences.timezone;
  const { user } = useMe();
  const [scheduling, setScheduling] = useState(() => {
    try {
      return !!sessionStorage.getItem(
        `168hours:program-schedule:${user.id}:${p.id}`,
      );
    } catch {
      return false;
    }
  });
  const [confirm, setConfirm] = useState<{
    action: "skip" | "delete";
    program: TrainingProgram;
  } | null>(null);
  const refresh = () => invalidateFitness(cache);
  const pause = useCommand({
    mutationFn: (v: { paused: boolean; version: number }, key: string) =>
      api.pauseTrainingProgram(p.id, v.paused, v.version, key),
    onSuccess: refresh,
  });
  const startWorkout = useWorkoutStart();
  const begin = useCommand({
    mutationFn: (
      v: { sequence: number; version: number; startedAt: string },
      key: string,
    ) =>
      api.beginTrainingProgram(
        p.id,
        { sequence: v.sequence, startedAt: v.startedAt },
        v.version,
        key,
      ),
    onSuccess: (w) => {
      refresh();
      router.push(`/fitness/session/${w.id}`);
    },
  });
  const skip = useCommand({
    mutationFn: (
      v: { sequence: number; version: number; blockVersion: number | null },
      key: string,
    ) =>
      api.skipTrainingProgram(
        p.id,
        { sequence: v.sequence, blockVersion: v.blockVersion },
        v.version,
        key,
      ),
    onSuccess: () => {
      refresh();
      setConfirm(null);
    },
  });
  const remove = useCommand({
    mutationFn: (version: number, key: string) =>
      api.deleteTrainingProgram(p.id, version, key),
    onSuccess: () => {
      refresh();
      router.push("/fitness/programs");
    },
  });
  const busy =
    pause.isPending || begin.isPending || skip.isPending || remove.isPending;
  const session = p.next.occurrence?.session;
  return (
    <div className="form-stack fitness-program-page">
      <Link href="/fitness/programs">← Training programs</Link>
      <PageHeading title={p.title} />
      <p className="muted">
        {programCadence(p)} · Starts {formatDate(p.startDate)}
      </p>
      {p.notes && <p className="fitness-program-notes">{p.notes}</p>}
      <div className="row">
        <Link className="button" href={`/fitness/programs/${p.id}/edit`}>
          Edit program
        </Link>
        <button
          className="button"
          disabled={busy}
          onClick={() =>
            pause.mutate({ paused: !p.paused, version: p.version })
          }
        >
          {p.paused ? "Resume program" : "Pause program"}
        </button>
      </div>
      <CommandError command={pause} />
      {p.paused && (
        <p role="status">
          This program is paused. Existing Calendar entries and workouts remain
          available; resume here to continue the sequence.
        </p>
      )}
      <section
        className="panel form-stack fitness-program-next"
        aria-labelledby="program-next-heading"
      >
        <span className="fitness-state">
          Cycle {p.next.cycle} · Step {p.next.position + 1}
        </span>
        <h2 id="program-next-heading">Next: {p.next.title}</h2>
        {p.next.block ? (
          <p>
            Scheduled:{" "}
            <Link href={`/?date=${p.next.suggestedDate}&view=day`}>
              {new Intl.DateTimeFormat("en", {
                timeZone: timezone,
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(p.next.block.startsAt))}
            </Link>
          </p>
        ) : (
          <p className="muted">
            Suggested date: {formatDate(p.next.suggestedDate)} · Not on Calendar
          </p>
        )}
        {!p.next.available && (
          <p className="error">
            This saved workout is unavailable. Edit the program to replace it,
            or skip this step.
          </p>
        )}
        {p.next.plan && (
          <p className="text-small">
            {p.next.plan.exercises.map((e) => e.name).join(" · ")}
          </p>
        )}
        <div className="row">
          {session ? (
            <Link
              className="button primary"
              href={`/fitness/session/${session.id}`}
            >
              Continue workout
            </Link>
          ) : (
            <button
              className="button primary"
              disabled={
                busy || startWorkout.checking || p.paused || !p.next.available
              }
              onClick={() =>
                void startWorkout.request(() =>
                  begin.mutate({
                    sequence: p.next.sequence,
                    version: p.version,
                    startedAt: new Date().toISOString(),
                  }),
                )
              }
            >
              Start next workout
            </button>
          )}
          {!session && (
            <>
              <button
                className="button"
                disabled={busy || p.paused || !p.next.available}
                onClick={() => setScheduling(true)}
              >
                {p.next.block ? "Reschedule" : "Schedule next workout"}
              </button>
              <button
                className="button"
                disabled={busy || p.paused}
                onClick={() => setConfirm({ action: "skip", program: p })}
              >
                Skip this workout
              </button>
            </>
          )}
        </div>
        <CommandError command={begin} />
        {startWorkout.dialog}
      </section>
      <section className="form-stack" aria-labelledby="sequence-heading">
        <h2 id="sequence-heading">Workout sequence</h2>
        <ol className="fitness-program-steps">
          {p.steps.map((step) => (
            <li key={step.id}>
              <div>
                {step.available ? (
                  <Link href={`/fitness/workout/${step.workoutId}`}>
                    {step.title}
                  </Link>
                ) : (
                  <span>{step.title} · Unavailable</span>
                )}
                {p.next.stepId === step.id && (
                  <span className="fitness-state"> Up next</span>
                )}
              </div>
            </li>
          ))}
        </ol>
        <p className="muted">
          The sequence repeats after the last step. Only the next workout is
          scheduled when you choose a time.
        </p>
      </section>
      <section className="form-stack" aria-labelledby="program-history-heading">
        <h2 id="program-history-heading">Program history</h2>
        <p>
          {p.completedCount} finished · {p.skippedCount} skipped
        </p>
        <ProgramHistory id={p.id} />
      </section>
      <button
        className="button danger"
        disabled={busy}
        onClick={() => setConfirm({ action: "delete", program: p })}
      >
        Delete program
      </button>
      {scheduling && (
        <ProgramSchedule program={p} onSaved={() => setScheduling(false)} />
      )}
      {confirm && (
        <Dialog
          title={
            confirm.action === "skip"
              ? "Skip this workout?"
              : "Delete this program?"
          }
          onClose={() => {
            if (!busy) setConfirm(null);
          }}
        >
          <div className="form-stack">
            <p>
              {confirm.action === "skip"
                ? "This advances to the next step. Any Calendar time reserved for this workout will be removed."
                : "This deletes the program and its step history. Recorded workouts and any existing Calendar entries stay available in Fitness and Calendar."}
            </p>
            <button
              className="button danger"
              disabled={busy}
              onClick={() =>
                confirm.action === "skip"
                  ? skip.mutate({
                      sequence: confirm.program.next.sequence,
                      version: confirm.program.version,
                      blockVersion: confirm.program.next.block?.version ?? null,
                    })
                  : remove.mutate(confirm.program.version)
              }
            >
              {confirm.action === "skip" ? "Confirm skip" : "Confirm delete"}
            </button>
            <button
              className="button"
              disabled={busy}
              onClick={() => setConfirm(null)}
            >
              Cancel
            </button>
            <CommandError command={confirm.action === "skip" ? skip : remove} />
          </div>
        </Dialog>
      )}
    </div>
  );
}
function ProgramSchedule({
  program: p,
  onSaved,
}: {
  program: TrainingProgram;
  onSaved: () => void;
}) {
  const { user, preferences } = useMe();
  const timezone = preferences.timezone,
    cache = useQueryClient();
  // Freeze the reviewed revision and block with the form, including across retries.
  const [base] = useState(p);
  const [cancelling, setCancelling] = useState(false);
  const startDefault = base.next.block
    ? instantToLocalInput(base.next.block.startsAt, timezone)
    : `${base.next.suggestedDate}T09:00`;
  const endDefault = base.next.block
    ? instantToLocalInput(base.next.block.endsAt, timezone)
    : `${base.next.suggestedDate}T10:00`;
  const [start, setStart] = useState(startDefault),
    [end, setEnd] = useState(endDefault),
    [error, setError] = useState("");
  const save = useCommand({
    persistence: {
      key: `168hours:program-schedule:${user.id}:${base.id}`,
      parse: (value) =>
        programScheduleInput
          .safeExtend({ version: z.number().int().positive() })
          .parse(value),
    },
    mutationFn: (
      { version, ...v }: ProgramScheduleInput & { version: number },
      key: string,
    ) => api.scheduleTrainingProgram(base.id, v, version, key),
    onSuccess: () => {
      invalidateFitness(cache);
      onSaved();
    },
  });
  useUnsavedChanges(save.isPending, "Wait for scheduling to finish.", true);
  return (
    <Dialog
      title={
        base.next.block
          ? "Reschedule program workout"
          : "Schedule program workout"
      }
      onClose={() => {
        if (save.isPending) return;
        if (start !== startDefault || end !== endDefault) setCancelling(true);
        else onSaved();
      }}
    >
      {cancelling && (
        <FitnessConfirm
          title="Discard schedule changes?"
          action="Discard changes"
          danger
          onCancel={() => setCancelling(false)}
          onConfirm={onSaved}
        />
      )}
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          try {
            const v = programScheduleInput.parse({
              startsAt:
                start === startDefault && base.next.block
                  ? base.next.block.startsAt
                  : localInputToInstant(start, timezone),
              endsAt:
                end === endDefault && base.next.block
                  ? base.next.block.endsAt
                  : localInputToInstant(end, timezone),
              sequence: base.next.sequence,
              blockVersion: base.next.block?.version ?? null,
            });
            setError("");
            save.mutate({ ...v, version: base.version });
          } catch {
            setError(
              "Choose valid, unambiguous times with the end after the start.",
            );
          }
        }}
      >
        <p>
          Reserve time for {base.next.title}. This keeps your place in the
          program.
        </p>
        <fieldset className="form-stack" disabled={save.isPending}>
          <label className="field">
            Start
            <input
              type="datetime-local"
              required
              value={
                save.needsRetry && save.recoveredVariables
                  ? instantToLocalInput(
                      save.recoveredVariables.startsAt,
                      timezone,
                    )
                  : start
              }
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label className="field">
            End
            <input
              type="datetime-local"
              required
              value={
                save.needsRetry && save.recoveredVariables
                  ? instantToLocalInput(
                      save.recoveredVariables.endsAt,
                      timezone,
                    )
                  : end
              }
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
          <button className="button primary">
            {save.isPending ? "Saving…" : "Save schedule"}
          </button>
        </fieldset>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <CommandError command={save} />
      </form>
    </Dialog>
  );
}
function ProgramHistory({ id }: { id: string }) {
  const timezone = useMe().preferences.timezone;
  const q = useInfiniteQuery({
    queryKey: ["fitness", "program-history", id],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.getProgramHistory(id, { cursor: pageParam, limit: 20 }),
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  if (q.isPending) return <Loading />;
  if (q.error)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  const labels = {
    ready: "Ready",
    scheduled: "Scheduled",
    in_progress: "In progress",
    completed: "Finished",
    skipped: "Skipped",
    unrecorded: "Workout removed",
  };
  return (
    <>
      {!q.data.pages[0]?.items.length && (
        <p className="muted">
          Start, schedule or skip your first workout to begin your program
          history.
        </p>
      )}
      <ul className="record-list">
        {q.data.pages
          .flatMap((p) => p.items)
          .map((item) => (
            <li key={item.id}>
              <div>
                {item.session ? (
                  <Link href={`/fitness/session/${item.session.id}`}>
                    {item.workoutTitleSnapshot}
                  </Link>
                ) : (
                  <span>{item.workoutTitleSnapshot}</span>
                )}
                <p className="muted text-small">
                  Cycle {item.cycle} · Step {item.position + 1}
                  {item.session || item.skippedAt
                    ? ` · ${formatDate(instantToLocalInput(item.session?.startedAt ?? item.skippedAt!, timezone).slice(0, 10))}`
                    : item.plannedDate
                      ? ` · Planned ${formatDate(item.plannedDate)}`
                      : ""}
                </p>
              </div>
              <span>{labels[item.status]}</span>
            </li>
          ))}
      </ul>
      {q.hasNextPage && (
        <button
          className="button"
          disabled={q.isFetchingNextPage}
          onClick={() => void q.fetchNextPage()}
        >
          More program history
        </button>
      )}
    </>
  );
}
export function ProgramSessionLink({ id }: { id: string }) {
  const q = useQuery({
    queryKey: ["fitness", "session-program", id],
    queryFn: () => api.getProgramForSession(id),
  });
  if (q.error)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  return q.data ? (
    <Link href={`/fitness/programs/${q.data.programId}`}>
      Back to program: {q.data.title}
    </Link>
  ) : null;
}
