"use client";
import { ProgramsOverview } from "./programs-page";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ArrowUpRight, ChevronDown, Play, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { useCommand, CommandError } from "@/lib/use-command";
import { ErrorState, Loading } from "@/components/ui/feedback";

import { FitnessSelect } from "./fitness-select";
import { PlanCard } from "./workout-actions";
import { invalidateFitness } from "./fitness-cache";
export function FitnessPage() {
  const active = useQuery({
    queryKey: ["fitness", "active"],
    queryFn: () => api.getWorkouts({ status: "active", limit: 1 }),
  });
  const current = active.data?.items[0];
  return (
    <div className="fitness-training-overview">
      <Link
        className="fitness-text-action fitness-progress-link"
        href="/fitness/progress"
      >
        View progress →
      </Link>
      <NextWorkout />
      {current && (
        <section className="fitness-current" aria-label="Workout in progress">
          <div>
            <span className="fitness-state">In progress</span>
            <strong>{current.title}</strong>
            <span className="text-small">Pick up where you left off.</span>
          </div>
          <Link
            className="button primary"
            href={`/fitness/session/${current.id}`}
          >
            Continue workout
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </section>
      )}
      {active.error && (
        <ErrorState error={active.error} retry={() => void active.refetch()} />
      )}
      <ProgramsOverview />
      <WorkoutsOverview />
      <FitnessActivityOverview />
    </div>
  );
}
function WorkoutsOverview() {
  const router = useRouter();
  const cache = useQueryClient();
  const start = useCommand({
    mutationFn: (startedAt: string, key: string) =>
      api.startWorkout(
        {
          title: "Workout",
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
    <div className="fitness-my-workouts">
      <section id="my-workouts" aria-labelledby="my-workouts-heading">
        <div className="fitness-section-heading">
          <div>
            <h2 id="my-workouts-heading">My workouts</h2>
          </div>
          <div className="fitness-workout-header-actions">
            <Link
              className="fitness-text-action"
              href="/fitness/workout/new"
              aria-label="Create workout"
            >
              <Plus size={16} aria-hidden="true" />
              Create
            </Link>
          </div>
        </div>
        <PlanList kind="workout" />
        <button
          className="fitness-text-action fitness-empty-workout"
          disabled={start.isPending}
          onClick={() => start.mutate(new Date().toISOString())}
        >
          <Play size={16} aria-hidden="true" />
          Start empty workout
        </button>
        <CommandError command={start} />
      </section>
    </div>
  );
}
function NextWorkout() {
  const q = useQuery({
    queryKey: ["fitness", "next"],
    queryFn: api.getNextStrengthWorkout,
    refetchInterval: 60000,
  });
  return (
    <section aria-labelledby="next-workout-heading">
      <div className="fitness-section-heading">
        <h2 id="next-workout-heading">Next workout</h2>
      </div>
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => void q.refetch()} />
      ) : q.data ? (
        <PlanCard plan={q.data.plan} scheduledBlock={q.data.block} />
      ) : (
        <p className="fitness-overview-empty">No scheduled workouts.</p>
      )}
    </section>
  );
}
function FitnessActivityOverview() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const reveal = () => {
      if (window.location.hash === "#history") setOpen(true);
    };
    reveal();
    window.addEventListener("hashchange", reveal);
    return () => window.removeEventListener("hashchange", reveal);
  }, []);
  return (
    <details
      id="history"
      className="fitness-secondary fitness-overview-history"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        History <ChevronDown size={16} aria-hidden="true" />
      </summary>
      <WorkoutHistory />
    </details>
  );
}

function PlanList({ kind }: { kind: "workout" | "scheduled" }) {
  const q = useInfiniteQuery({
    queryKey: ["fitness", "plans", kind],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.getStrengthPlans({ kind, cursor: pageParam, limit: 3 }),
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  if (q.isPending) return <Loading />;
  if (q.error)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  return (
    <>
      {!q.data.pages[0]?.items.length ? (
        <p className="fitness-overview-empty">
          {kind === "workout"
            ? "No saved workouts yet."
            : "No planned workouts."}
        </p>
      ) : (
        <div className="fitness-cards">
          {q.data.pages
            .flatMap((p) => p.items)
            .map((plan) => (
              <PlanCard key={plan.id} plan={plan} />
            ))}
        </div>
      )}
      {q.hasNextPage && (
        <button
          className="fitness-text-action"
          disabled={q.isFetchingNextPage}
          onClick={() => void q.fetchNextPage()}
        >
          Show more workouts
        </button>
      )}
    </>
  );
}
function WorkoutHistory() {
  const timezone = useMe().preferences.timezone;
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "completed">("all");
  const q = useInfiniteQuery({
    queryKey: ["fitness", "sessions", status, search],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.getWorkouts({
        status,
        search,
        cursor: pageParam,
        limit: 10,
      }),
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  return (
    <section aria-labelledby="fitness-history-heading">
      <div className="fitness-section-heading">
        <div>
          <h2 id="fitness-history-heading">History</h2>
        </div>
        <button
          className="fitness-text-action"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Less" : "View all"}
        </button>
      </div>
      {expanded && (
        <div className="fitness-history-filters">
          <label className="field">
            Find a workout
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <FitnessSelect
            label="Workout status"
            value={status}
            onChange={(value) => setStatus(value as typeof status)}
            options={[
              { value: "all", label: "All workouts" },
              { value: "active", label: "In progress" },
              { value: "completed", label: "Finished" },
            ]}
          />
        </div>
      )}
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => void q.refetch()} />
      ) : q.data.pages[0]?.items.length ? (
        <div className="fitness-history-items">
          {q.data.pages
            .flatMap((p) => p.items)
            .slice(0, expanded ? undefined : 3)
            .map((w) => (
              <Link
                key={w.id}
                href={`/fitness/session/${w.id}`}
                className="fitness-history-item"
              >
                <div>
                  <strong>{w.title}</strong>
                  <small>
                    {new Intl.DateTimeFormat("en", {
                      timeZone: timezone,
                      dateStyle: "medium",
                    }).format(new Date(w.startedAt))}
                  </small>
                </div>
                <span className="fitness-state">
                  {w.endedAt ? "Finished" : "In progress"}
                </span>
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            ))}
        </div>
      ) : (
        <p className="fitness-overview-empty">No workouts recorded yet.</p>
      )}
      {expanded && q.hasNextPage && (
        <button
          className="fitness-text-action"
          disabled={q.isFetchingNextPage}
          onClick={() => void q.fetchNextPage()}
        >
          More history
        </button>
      )}
    </section>
  );
}
