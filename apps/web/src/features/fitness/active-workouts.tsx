"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Dialog } from "@/components/ui/dialog";
import { ErrorState, Loading } from "@/components/ui/feedback";
import { useMe } from "@/features/identity/me";
export function ActiveWorkouts() {
  const timezone = useMe().preferences.timezone;
  const query = useInfiniteQuery({
    queryKey: ["fitness", "active", "list"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.getWorkouts({ status: "active", limit: 10, cursor: pageParam }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  if (query.isPending) return <Loading />;
  if (query.error)
    return (
      <ErrorState error={query.error} retry={() => void query.refetch()} />
    );
  return (
    <>
      {query.data.pages
        .flatMap((page) => page.items)
        .map((workout) => (
          <section
            key={workout.id}
            className="fitness-current"
            aria-label={`In progress: ${workout.title}`}
          >
            <div>
              <span className="fitness-state">In progress</span>
              <strong>{workout.title}</strong>
              <small>
                {new Intl.DateTimeFormat("en", {
                  timeZone: timezone,
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(workout.startedAt))}
              </small>
            </div>
            <Link
              className="button primary"
              href={`/fitness/session/${workout.id}`}
            >
              Continue workout
            </Link>
          </section>
        ))}
      {query.hasNextPage && (
        <button
          className="button"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          More active workouts
        </button>
      )}
    </>
  );
}
/** Check fresh state at the point of starting; an existing session is always a choice. */
export function useWorkoutStart() {
  const [checking, setChecking] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const action = useRef<(() => void) | null>(null);
  const request = async (start: () => void, continuing = false) => {
    if (checking) return;
    if (continuing) {
      start();
      return;
    }
    action.current = start;
    setChecking(true);
    setError(null);
    try {
      const active = await api.getWorkouts({ status: "active", limit: 1 });
      if (active.items.length) setOpen(true);
      else start();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause
          : new Error("Could not check active workouts."),
      );
    } finally {
      setChecking(false);
    }
  };
  return {
    checking,
    request,
    dialog: (
      <>
        {error && (
          <ErrorState
            error={error}
            retry={() => {
              if (action.current) void request(action.current);
            }}
          />
        )}
        {open && (
          <Dialog
            title="You have a workout in progress"
            onClose={() => setOpen(false)}
          >
            <ActiveWorkouts />
            <div className="row">
              <button className="button" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button
                className="button"
                onClick={() => {
                  setOpen(false);
                  action.current?.();
                }}
              >
                Start another workout
              </button>
            </div>
          </Dialog>
        )}
      </>
    ),
  };
}
