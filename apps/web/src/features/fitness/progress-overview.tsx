"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { addDays, localDate } from "@168hours/domain-utils";
import { WorkoutHistory } from "./fitness-page";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { ErrorState, Loading } from "@/components/ui/feedback";
import { formatDate, hours, number } from "@/lib/format";
import { MetricCards, volumeText } from "./progress-shared";

export function FitnessHistoryPage({ date }: { date?: string }) {
  return (
    <div className="fitness-progress-page form-stack">
      <WorkoutHistory />
      <details
        className="fitness-secondary fitness-weekly-summary"
        open={!!date}
      >
        <summary>Weekly totals</summary>
        <WeeklyTotals date={date} />
      </details>
    </div>
  );
}
function WeeklyTotals({ date }: { date?: string }) {
  const { preferences } = useMe();
  const router = useRouter();
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
  if (q.isPending) return <Loading />;
  if (q.error)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  const current = q.data.weeks.at(-1)!;
  return (
    <section aria-labelledby="fitness-week-heading" className="form-stack">
      <h2 id="fitness-week-heading">
        Week of {formatDate(q.data.weekStart, { dateStyle: "medium" })}
      </h2>
      <div className="fitness-progress-navigation">
        <Link
          className="button"
          href={`?date=${addDays(q.data.weekStart, -7)}`}
          aria-label="Previous week"
        >
          ←
        </Link>
        <label className="field">
          Week containing
          <input
            type="date"
            value={date ?? q.data.weekStart}
            onChange={(e) => {
              if (e.target.value)
                router.push(`/fitness/history?date=${e.target.value}`);
            }}
          />
        </label>
        <Link
          className="button"
          href={`?date=${addDays(q.data.weekStart, 7)}`}
          aria-label="Next week"
        >
          →
        </Link>
        <Link
          href={`/fitness/history?date=${localDate(new Date(), preferences.timezone)}`}
        >
          This week
        </Link>
      </div>
      <MetricCards
        items={[
          {
            label: "Finished workouts",
            value: number(current.workoutCount, 0),
          },
          { label: "Training time", value: hours(current.durationSeconds) },
          {
            label: "Completed sets",
            value: number(current.completedSets, 0),
          },
          {
            label: "Recorded volume",
            value: volumeText(current, preferences.weightUnit),
          },
        ]}
      />
      <p className="muted text-small">
        Finished workouts are assigned to the week they started in{" "}
        {q.data.timezone}. Training time sums their full session durations,
        including rest. Volume is actual load × reps for Reps + load sets;
        incomplete measurements are flagged.
      </p>
    </section>
  );
}
