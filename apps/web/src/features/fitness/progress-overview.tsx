"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { addDays, localDate } from "@168hours/domain-utils";
import { WorkoutHistory } from "./workout-history";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { ErrorState, Loading } from "@/components/ui/feedback";
import { CalendarDatePicker } from "@/features/planning/calendar-date-picker";
import { formatDate, number } from "@/lib/format";
import { formatRestDuration } from "./rest-duration";
import { historyHref } from "./workout-history-return";

export function FitnessHistoryPage({ date }: { date?: string }) {
  return (
    <div className="fitness-progress-page form-stack">
      <WorkoutHistory />
      <section
        className="fitness-history-weekly"
        aria-labelledby="fitness-weekly-heading"
      >
        <WeeklyTotals date={date} />
      </section>
    </div>
  );
}

function WeeklyTotals({ date }: { date?: string }) {
  const { preferences } = useMe();
  const router = useRouter();
  const params = useSearchParams();
  const anchor = useRef<HTMLButtonElement>(null);
  const [picker, setPicker] = useState(false);
  const closePicker = useCallback(() => setPicker(false), []);
  const q = useQuery({
    queryKey: [
      "fitness",
      "progress",
      date,
      preferences.timezone,
      preferences.weekStartsOn,
    ],
    queryFn: () => api.getFitnessOverview(date),
    placeholderData: keepPreviousData,
  });
  const today = localDate(new Date(), preferences.timezone);
  const navigate = (next: string) => {
    setPicker(false);
    router.replace(historyHref(params.get("search") ?? "", next), {
      scroll: false,
    });
  };
  const heading = (controls?: ReactNode) => (
    <div className="fitness-week-heading">
      <h2 id="fitness-weekly-heading">Weekly totals</h2>
      <div className="fitness-week-controls">
        <button
          type="button"
          className="button fitness-this-week"
          onClick={() => navigate(today)}
        >
          This week
        </button>
        {controls}
      </div>
    </div>
  );
  if (q.isPending)
    return (
      <div className="form-stack">
        {heading()}
        <Loading />
      </div>
    );
  if (q.error)
    return (
      <div className="form-stack">
        {heading()}
        <ErrorState error={q.error} retry={() => void q.refetch()} />
      </div>
    );
  const current = q.data.weeks.at(-1)!;
  const weekEnd = addDays(q.data.weekStart, 6);
  const sameYear = q.data.weekStart.slice(0, 4) === weekEnd.slice(0, 4);
  const weekLabel = sameYear
    ? `${formatDate(q.data.weekStart, { month: "short", day: "numeric" })} - ${q.data.weekStart.slice(0, 7) === weekEnd.slice(0, 7) ? Number(weekEnd.slice(8)) : formatDate(weekEnd, { month: "short", day: "numeric" })}, ${weekEnd.slice(0, 4)}`
    : `${formatDate(q.data.weekStart, { dateStyle: "medium" })} - ${formatDate(weekEnd, { dateStyle: "medium" })}`;
  const elapsed =
    current.durationSeconds < 60
      ? "<1m"
      : formatRestDuration(Math.round(current.durationSeconds / 60) * 60);
  return (
    <div className="form-stack fitness-week-recap" aria-busy={q.isFetching}>
      {heading(
        <div className="fitness-week-toolbar">
          <button
            type="button"
            className="button"
            aria-label="Previous week"
            onClick={() => navigate(addDays(q.data.weekStart, -7))}
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            ref={anchor}
            className="button fitness-week-date"
            aria-label="Choose week"
            aria-haspopup="dialog"
            aria-expanded={picker}
            onClick={() => setPicker(!picker)}
          >
            <CalendarDays size={18} aria-hidden="true" />
            <span>{weekLabel}</span>
          </button>
          <button
            type="button"
            className="button"
            aria-label="Next week"
            onClick={() => navigate(addDays(q.data.weekStart, 7))}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>,
      )}
      {picker && (
        <CalendarDatePicker
          date={q.data.weekStart}
          weekStart={q.data.weekStart}
          today={today}
          view="week"
          anchor={anchor}
          onClose={closePicker}
          onSelect={navigate}
        />
      )}
      {current.workoutCount === 0 ? (
        <p className="fitness-week-empty">No finished workouts this week.</p>
      ) : (
        <>
          <dl className="fitness-week-totals">
            <div>
              <dt>Workouts</dt>
              <dd>{number(current.workoutCount, 0)}</dd>
            </div>
            <div>
              <dt>Workout time</dt>
              <dd>{elapsed}</dd>
            </div>
            <div>
              <dt>Completed sets</dt>
              <dd>{number(current.completedSets, 0)}</dd>
            </div>
          </dl>
        </>
      )}
    </div>
  );
}
