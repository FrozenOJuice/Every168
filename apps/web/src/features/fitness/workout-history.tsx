"use client";
import Link from "next/link";
import { useFitnessNavigation } from "./fitness-navigation";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { idSchema } from "@168hours/contracts";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { ErrorState, Loading } from "@/components/ui/feedback";
import { WorkoutSearch } from "./workout-search";
import { formatRestDuration } from "./rest-duration";
import { historyHref } from "./workout-history-return";
import { localDate, workoutSeconds } from "@168hours/domain-utils";
import type { WorkoutHistoryItem } from "@168hours/contracts";

const savedPosition = z.object({
  href: z.string(),
  page: z.number().finite().nonnegative(),
  pane: z.number().finite().nonnegative(),
  pages: z.number().int().min(1).max(1000),
});
export function WorkoutHistory() {
  const {
    user,
    preferences: { timezone },
  } = useMe();
  const navigation = useFitnessNavigation();
  const params = useSearchParams();
  const router = useRouter();
  const [search, setSearch] = useState(() =>
    (params.get("search") ?? "").slice(0, 160),
  );
  const root = useRef<HTMLElement>(null);
  const restored = useRef("");
  const href = historyHref(search, params.get("date"));
  const q = useInfiniteQuery({
    queryKey: ["fitness", "sessions", "completed", search.trim()],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.getWorkouts({
        status: "completed",
        search: search.trim(),
        cursor: pageParam,
        limit: 10,
      }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const restoreId =
    params.get("restoreSession") ?? navigation.current?.position?.sessionId;
  const { data, isFetching, error, hasNextPage, fetchNextPage } = q;
  useEffect(() => {
    if (
      !idSchema.safeParse(restoreId).success ||
      restored.current === restoreId ||
      !data ||
      isFetching ||
      error
    )
      return;
    try {
      const saved = savedPosition.safeParse(
        JSON.parse(
          sessionStorage.getItem(`168hours:history:${user.id}:${restoreId}`) ??
            "null",
        ),
      );
      if (!saved.success || saved.data.href !== href) return;
      if (data.pages.length < saved.data.pages && hasNextPage) {
        void fetchNextPage();
        return;
      }
      let second = 0;
      const first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => {
          restored.current = restoreId!;
          root.current
            ?.closest(".fitness-primary-pane")
            ?.scrollTo({ top: saved.data.pane, behavior: "instant" });
          window.scrollTo({ top: saved.data.page, behavior: "instant" });
          root.current
            ?.querySelector<HTMLElement>(`[data-session-id="${restoreId}"]`)
            ?.focus({ preventScroll: true });
        });
      });
      return () => {
        cancelAnimationFrame(first);
        cancelAnimationFrame(second);
      };
    } catch {
      /* Optional position storage never blocks History. */
    }
  }, [
    restoreId,
    user.id,
    href,
    data,
    isFetching,
    error,
    hasNextPage,
    fetchNextPage,
  ]);
  function update(nextSearch: string) {
    setSearch(nextSearch);
    router.replace(historyHref(nextSearch, params.get("date")), {
      scroll: false,
    });
  }
  const items = q.data?.pages.flatMap((page) => page.items) ?? [];
  const groups = new Map<string, WorkoutHistoryItem[]>();
  for (const workout of items) {
    const day = localDate(new Date(workout.startedAt), timezone);
    const group = groups.get(day) ?? [];
    group.push(workout);
    groups.set(day, group);
  }
  return (
    <section
      ref={root}
      aria-labelledby="fitness-history-heading"
      className="fitness-workout-history"
    >
      <div className="fitness-section-heading">
        <h2 id="fitness-history-heading">Workout history</h2>
      </div>
      <div className="fitness-history-filters">
        <WorkoutSearch value={search} onChange={update} />
      </div>
      {q.isPending ? (
        <Loading />
      ) : q.error && !q.data ? (
        <ErrorState error={q.error} retry={() => void q.refetch()} />
      ) : !items.length ? (
        <p className="fitness-overview-empty">
          {search.trim()
            ? "No workouts match your search."
            : "No finished workouts yet."}
        </p>
      ) : (
        <div className="fitness-history-groups">
          {Array.from(groups, ([day, workouts]) => (
            <section
              key={day}
              className="fitness-history-day"
              aria-labelledby={`history-day-${day}`}
            >
              <h3 id={`history-day-${day}`}>
                <time dateTime={day}>
                  {new Intl.DateTimeFormat("en", {
                    timeZone: timezone,
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  }).format(new Date(workouts[0]!.startedAt))}
                </time>
              </h3>
              <ul className="fitness-history-items">
                {workouts.map((workout) => {
                  const when = new Intl.DateTimeFormat("en", {
                    timeZone: timezone,
                    timeStyle: "short",
                  }).format(new Date(workout.startedAt));
                  const duration = workout.endedAt
                    ? formatRestDuration(workoutSeconds(workout))
                    : null;
                  return (
                    <li key={workout.id}>
                      <Link
                        className="fitness-history-item"
                        aria-label={`Open workout: ${workout.title}, ${day}, ${when}, ${duration}`}
                        data-session-id={workout.id}
                        href={`/fitness/session/${workout.id}?${new URLSearchParams({ returnHistory: href })}`}
                        onClick={(event) => {
                          if (
                            event.button ||
                            event.metaKey ||
                            event.ctrlKey ||
                            event.shiftKey ||
                            event.altKey
                          )
                            return;
                          try {
                            sessionStorage.setItem(
                              `168hours:history:${user.id}:${workout.id}`,
                              JSON.stringify({
                                href,
                                page: window.scrollY,
                                pane:
                                  root.current?.closest(".fitness-primary-pane")
                                    ?.scrollTop ?? 0,
                                pages: q.data!.pages.length,
                              }),
                            );
                          } catch {
                            /* Navigation works without storage. */
                          }
                        }}
                      >
                        <span className="fitness-history-copy">
                          <strong>{workout.title}</strong>
                          <span className="fitness-history-result">
                            {[
                              `${workout.exerciseCount} ${workout.exerciseCount === 1 ? "exercise" : "exercises"}`,
                              `${workout.completedSetCount} completed ${workout.completedSetCount === 1 ? "set" : "sets"}`,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                        <span className="fitness-history-timing">
                          <time dateTime={workout.startedAt}>{when}</time>
                          <span>{duration}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
      {q.data && q.error && (
        <div className="fitness-library-load-error" role="alert">
          <p className="error">
            {q.isFetchNextPageError
              ? "Couldn’t load older workouts."
              : "Couldn’t refresh history. Your loaded workouts are still shown."}
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
                : "Retry refreshing history"}
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
          {q.isFetchingNextPage ? "Loading workouts…" : "Load older workouts"}
        </button>
      )}
    </section>
  );
}
