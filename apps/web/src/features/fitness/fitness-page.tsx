"use client";
import { ActiveWorkouts } from "./active-workouts";
import { features } from "@/lib/release";
import { ProgramsOverview } from "./programs-page";
import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Plus } from "lucide-react";
import { ErrorState, Loading } from "@/components/ui/feedback";

import { WorkoutSearch, useWorkoutSearch } from "./workout-search";
import { PlanCard } from "./workout-actions";
export function FitnessPage() {
  return (
    <div className="fitness-training-overview">
      <ActiveWorkouts />
      <WorkoutsOverview />
      {features.trainingPrograms && <ProgramsOverview />}
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
const compactWorkoutsQuery = "(max-width: 900px)";
function subscribeWorkoutLayout(onChange: () => void) {
  const media = window.matchMedia(compactWorkoutsQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
function PlanList() {
  const compact = useSyncExternalStore(
    subscribeWorkoutLayout,
    () => window.matchMedia(compactWorkoutsQuery).matches,
    () => false,
  );
  const {
    search,
    setSearch,
    query: q,
  } = useWorkoutSearch(true, compact ? 4 : 6);
  return (
    <>
      <WorkoutSearch value={search} onChange={setSearch} />
      {q.isPending ? (
        <Loading />
      ) : q.isError && !q.data ? (
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
      {q.data && q.error && (
        <div className="fitness-library-load-error" role="alert">
          <p className="error">
            {q.isFetchNextPageError
              ? "Couldn’t load more workouts."
              : "Couldn’t refresh workouts. Your loaded workouts are still shown."}
          </p>
          <button
            type="button"
            className="button"
            disabled={q.isFetching}
            onClick={() =>
              void (q.isFetchNextPageError ? q.fetchNextPage() : q.refetch())
            }
          >
            {q.isFetching
              ? "Loading workouts…"
              : q.isFetchNextPageError
                ? "Retry loading workouts"
                : "Retry refreshing workouts"}
          </button>
        </div>
      )}
      {q.hasNextPage && !q.error && (
        <button
          type="button"
          className="button fitness-load-more-workouts"
          disabled={q.isFetchingNextPage}
          aria-busy={q.isFetchingNextPage}
          onClick={() => void q.fetchNextPage()}
        >
          {q.isFetchingNextPage ? "Loading workouts…" : "Load more workouts"}
        </button>
      )}
    </>
  );
}
