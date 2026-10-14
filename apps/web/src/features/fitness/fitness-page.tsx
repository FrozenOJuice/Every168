"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  instantToLocalInput,
  localInputToInstant,
} from "@168hours/domain-utils";
import type { StrengthPlan } from "@168hours/contracts";
import { strengthScheduleInput } from "@168hours/contracts";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { useCommand, CommandError } from "@/lib/use-command";
import {
  Loading,
  Empty,
  ErrorState,
  PageHeading,
} from "@/components/ui/feedback";
import { Dialog } from "@/components/ui/dialog";
import { ExerciseLibrary } from "./exercise-library";
import { invalidateFitness } from "./fitness-cache";
export function FitnessPage({ tab }: { tab?: string }) {
  const active = tab === "history" || tab === "exercises" ? tab : "workouts";
  const router = useRouter();
  const cache = useQueryClient();
  const start = useCommand({
    mutationFn: (startedAt: string, key: string) =>
      api.startWorkout(
        {
          title: "Strength workout",
          startedAt,
          notes: null,
          linkedTimeBlockId: null,
        },
        key,
      ),
    onSuccess: (w) => {
      invalidateFitness(cache);
      router.push(`/fitness/session/${w.id}`);
    },
  });
  return (
    <div className="fitness-workspace">
      <PageHeading
        title="Fitness"
        description="Prepare your training, record it as you go, and see what you did."
      >
        <button
          className="button primary"
          disabled={start.isPending}
          onClick={() => start.mutate(new Date().toISOString())}
        >
          Start empty workout
        </button>
      </PageHeading>
      <CommandError command={start} />
      <nav className="fitness-tabs" aria-label="Fitness sections">
        {[
          ["workouts", "Workouts"],
          ["history", "Sessions"],
          ["exercises", "Exercises"],
        ].map(([key, label]) => (
          <Link
            key={key}
            href={`/fitness?tab=${key}`}
            aria-current={active === key ? "page" : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>
      {active === "exercises" ? (
        <ExerciseLibrary />
      ) : active === "history" ? (
        <SessionList />
      ) : (
        <>
          <div className="row between">
            <h2>Your workouts</h2>
            <Link className="button" href="/fitness/workout/new">
              Create workout
            </Link>
          </div>
          <PlanList kind="workout" />
          <h2 className="fitness-section">Scheduled training</h2>
          <PlanList kind="scheduled" />
        </>
      )}
    </div>
  );
}
function PlanList({ kind }: { kind: "workout" | "scheduled" }) {
  const q = useInfiniteQuery({
    queryKey: ["fitness", "plans", kind],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.getStrengthPlans({ kind, cursor: pageParam }),
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  if (q.isPending) return <Loading />;
  if (q.error)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  return (
    <>
      {q.data.pages[0]?.items.length === 0 ? (
        <Empty>
          {kind === "workout"
            ? "No saved workouts yet. Create one or start an empty session."
            : "No scheduled workouts yet."}
        </Empty>
      ) : (
        <div className="fitness-cards">
          {q.data.pages
            .flatMap((p) => p.items)
            .map((p) => (
              <PlanCard key={p.id} plan={p} />
            ))}
        </div>
      )}
      {q.hasNextPage && (
        <button className="button" onClick={() => void q.fetchNextPage()}>
          More workouts
        </button>
      )}
    </>
  );
}
export function BeginWorkout({ plan }: { plan: StrengthPlan }) {
  const router = useRouter();
  const cache = useQueryClient();
  const begin = useCommand({
    mutationFn: (startedAt: string, key: string) =>
      api.beginStrengthPlan(plan.id, startedAt, plan.version, key),
    onSuccess: (w) => {
      invalidateFitness(cache);
      router.push(`/fitness/session/${w.id}`);
    },
  });
  return (
    <>
      <button
        className="button primary"
        disabled={begin.isPending}
        onClick={() => begin.mutate(new Date().toISOString())}
      >
        {plan.sessionId ? "Open session" : "Start workout"}
      </button>
      <CommandError command={begin} />
    </>
  );
}
function PlanCard({ plan }: { plan: StrengthPlan }) {
  const [scheduling, setScheduling] = useState(false);
  const timezone = useMe().preferences.timezone;
  const block = useQuery({
    queryKey: ["fitness", "block", plan.timeBlockId],
    queryFn: () => api.getTimeBlock(plan.timeBlockId!),
    enabled: !!plan.timeBlockId,
  });
  return (
    <section className="panel">
      <h3>{block.data?.title ?? plan.title}</h3>
      <p className="text-small">
        {plan.exercises.length} exercises ·{" "}
        {plan.exercises.reduce((n, e) => n + e.sets.length, 0)} sets
      </p>
      {plan.notes && <p>{plan.notes}</p>}
      {block.data && (
        <p>
          <Link
            href={`/?date=${instantToLocalInput(block.data.startsAt, timezone).slice(0, 10)}&view=day`}
          >
            {new Intl.DateTimeFormat("en", {
              timeZone: timezone,
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(block.data.startsAt))}
          </Link>
        </p>
      )}
      {block.error && (
        <ErrorState error={block.error} retry={() => void block.refetch()} />
      )}
      {plan.kind === "scheduled" && !plan.timeBlockId && (
        <p className="muted">
          Calendar time was removed. You can still start this workout.
        </p>
      )}
      <div className="row">
        <BeginWorkout plan={plan} />
        {plan.kind === "workout" && (
          <>
            <Link className="button" href={`/fitness/workout/${plan.id}`}>
              Edit
            </Link>
            <button className="button" onClick={() => setScheduling(true)}>
              Schedule
            </button>
          </>
        )}
      </div>
      {scheduling && (
        <Dialog title="Schedule workout" onClose={() => setScheduling(false)}>
          <ScheduleWorkout plan={plan} onSaved={() => setScheduling(false)} />
        </Dialog>
      )}
    </section>
  );
}
function ScheduleWorkout({
  plan,
  onSaved,
}: {
  plan: StrengthPlan;
  onSaved: () => void;
}) {
  const timezone = useMe().preferences.timezone;
  const cache = useQueryClient();
  const [start, setStart] = useState(() =>
    instantToLocalInput(new Date().toISOString(), timezone),
  );
  const [end, setEnd] = useState(() =>
    instantToLocalInput(new Date(Date.now() + 3600000).toISOString(), timezone),
  );
  const [error, setError] = useState("");
  const command = useCommand({
    mutationFn: (v: { startsAt: string; endsAt: string }, key: string) =>
      api.scheduleStrengthPlan(plan.id, v, plan.version, key),
    onSuccess: () => {
      invalidateFitness(cache);
      onSaved();
    },
  });
  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        try {
          const v = strengthScheduleInput.parse({
            startsAt: localInputToInstant(start, timezone),
            endsAt: localInputToInstant(end, timezone),
          });
          setError("");
          command.mutate(v);
        } catch {
          setError(
            "Choose valid, unambiguous start and end times in your timezone.",
          );
        }
      }}
    >
      <p>
        This reserves Calendar time. It does not start or complete a session.
      </p>
      <fieldset className="form-stack" disabled={command.isPending}>
        <label>
          Start
          <input
            type="datetime-local"
            required
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label>
          End
          <input
            type="datetime-local"
            required
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        <button className="button primary">Schedule workout</button>
      </fieldset>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <CommandError command={command} />
    </form>
  );
}
function SessionList() {
  const timezone = useMe().preferences.timezone;
  const [status, setStatus] = useState<"all" | "active" | "completed">("all");
  const [search, setSearch] = useState("");
  const q = useInfiniteQuery({
    queryKey: ["fitness", "sessions", status, search],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.getWorkouts({ status, search, cursor: pageParam }),
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  return (
    <div className="form-stack">
      <div className="row">
        <label>
          Search sessions
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label>
          Status
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
          >
            <option value="all">All sessions</option>
            <option value="active">In progress</option>
            <option value="completed">Finished</option>
          </select>
        </label>
      </div>
      <p className="muted text-small">Most recently created first.</p>
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => void q.refetch()} />
      ) : (
        <ul className="record-list">
          {q.data.pages
            .flatMap((p) => p.items)
            .map((w) => (
              <li key={w.id}>
                <Link href={`/fitness/session/${w.id}`}>{w.title}</Link>
                <span>
                  {new Intl.DateTimeFormat("en", {
                    timeZone: timezone,
                    dateStyle: "medium",
                  }).format(new Date(w.startedAt))}{" "}
                  · {w.endedAt ? "Finished" : "In progress"}
                </span>
              </li>
            ))}
        </ul>
      )}
      {q.data?.pages[0]?.items.length === 0 && (
        <Empty>No sessions found.</Empty>
      )}
      {q.hasNextPage && (
        <button className="button" onClick={() => void q.fetchNextPage()}>
          More sessions
        </button>
      )}
    </div>
  );
}
