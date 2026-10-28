"use client";
import { ActiveWorkouts } from "./active-workouts";
import { ProgramsOverview } from "./programs-page";
import Link from "next/link";
import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ArrowUpRight, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { ErrorState, Loading } from "@/components/ui/feedback";

import { FitnessSelect } from "./fitness-select";
import { WorkoutSearch, useWorkoutSearch } from "./workout-search";
import { PlanCard } from "./workout-actions";
export function FitnessPage() {
  return (
    <div className="fitness-training-overview">
      <ActiveWorkouts />
      <WorkoutsOverview />
      <ProgramsOverview />
    </div>
  );
}
function WorkoutsOverview() {
  return (
    <div className="fitness-my-workouts">
      <section
        id="my-workouts"
        tabIndex={-1}
        aria-labelledby="my-workouts-heading"
      >
        <div className="fitness-section-heading">
          <div>
            <h2 id="my-workouts-heading">My workouts</h2>
          </div>
          <div className="fitness-workout-header-actions">
            <Link
              className="button primary"
              href="/fitness/workout/new"
              aria-label="Create workout"
            >
              <Plus size={16} aria-hidden="true" />
              Create workout
            </Link>
          </div>
        </div>
        <PlanList />
      </section>
    </div>
  );
}
function PlanList() {
  const { search, setSearch, query: q } = useWorkoutSearch(true, 6);
  return (
    <>
      <WorkoutSearch value={search} onChange={setSearch} />
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => void q.refetch()} />
      ) : !q.data.pages[0]?.items.length ? (
        <p className="fitness-overview-empty">
          {search.trim()
            ? "No workouts match your search."
            : "No saved workouts yet."}
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
          type="button"
          className="button fitness-load-more-workouts"
          disabled={q.isFetchingNextPage}
          aria-busy={q.isFetchingNextPage}
          onClick={() => void q.fetchNextPage()}
        >
          {q.isFetchingNextPage ? "Loading…" : "Load more workouts"}
        </button>
      )}
    </>
  );
}
export function WorkoutHistory() {
  const timezone = useMe().preferences.timezone;
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
      </div>
      {
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
      }
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => void q.refetch()} />
      ) : q.data.pages[0]?.items.length ? (
        <div className="fitness-history-items">
          {q.data.pages
            .flatMap((p) => p.items)

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
      {q.hasNextPage && (
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
