"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { addDays, fromKilograms, localDate } from "@168hours/domain-utils";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { ErrorState, Loading, PageHeading } from "@/components/ui/feedback";
import { formatDate, hours, number } from "@/lib/format";
import { MetricCards, ProgressChart, volumeText } from "./progress-shared";
import { FitnessSelect } from "./fitness-select";

export function FitnessProgressPage({ date }: { date?: string }) {
  const { preferences } = useMe();
  const router = useRouter();
  const [measure, setMeasure] = useState("workoutCount");
  const q = useQuery({
    queryKey: [
      "fitness",
      "progress",
      date,
      preferences.timezone,
      preferences.weekStartsOn,
    ],
    queryFn: () => api.getFitnessOverview(date),
  });
  if (q.isPending) return <Loading />;
  if (q.error)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  const current = q.data.weeks.at(-1)!;
  const labels = {
    workoutCount: "Finished workouts",
    durationSeconds: "Training time",
    completedSets: "Completed sets",
    volumeKg: "Recorded volume",
  };
  const metric = measure as keyof typeof labels;
  const format = (value: number) =>
    metric === "durationSeconds"
      ? hours(value)
      : metric === "volumeKg"
        ? `${number(fromKilograms(value, preferences.weightUnit))} ${preferences.weightUnit}·reps`
        : number(value, 0);
  return (
    <div className="fitness-progress-page form-stack">
      <Link href="/fitness">← Fitness</Link>
      <PageHeading
        title="Progress"
        description="See your training over time and explore each exercise."
      />
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
                  router.push(`/fitness/progress?date=${e.target.value}`);
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
            href={`/fitness/progress?date=${localDate(new Date(), preferences.timezone)}`}
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
        <h3>Last 12 weeks</h3>
        <FitnessSelect
          label="Weekly measure"
          searchable={false}
          value={metric}
          onChange={setMeasure}
          options={Object.entries(labels).map(([value, label]) => ({
            value,
            label,
          }))}
        />
        <ProgressChart
          label={labels[metric]}
          points={q.data.weeks.map((w) => ({
            label: formatDate(w.weekStart),
            value: w[metric],
            href: `/fitness/progress?date=${w.weekStart}`,
          }))}
          format={format}
        />
      </section>
      <ProgressExerciseList />
    </div>
  );
}
function ProgressExerciseList() {
  const [search, setSearch] = useState("");
  const q = useInfiniteQuery({
    queryKey: ["fitness", "progress-exercises", search],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.getProgressExercises({ search, cursor: pageParam, limit: 20 }),
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  return (
    <section className="form-stack" aria-labelledby="exercise-progress-heading">
      <h2 id="exercise-progress-heading">Exercise progress</h2>
      <p className="muted">
        All exercises with completed sets in finished workouts, including
        archived exercises.
      </p>
      <label className="field">
        Find a recorded exercise
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} retry={() => void q.refetch()} />
      ) : (
        <>
          {!q.data.pages[0]?.items.length && (
            <p>
              {search
                ? "No matching exercises."
                : "Finish a workout to see your exercise progress here."}
            </p>
          )}
          <ul className="record-list">
            {q.data.pages
              .flatMap((p) => p.items)
              .map((e) => (
                <li key={e.id}>
                  <Link href={`/fitness/progress/${e.id}`}>{e.name}</Link>
                  <span className="muted">
                    {e.archived ? "Archived · " : ""}Records and trends →
                  </span>
                </li>
              ))}
          </ul>
          {q.hasNextPage && (
            <button
              className="button"
              disabled={q.isFetchingNextPage}
              onClick={() => void q.fetchNextPage()}
            >
              More exercises
            </button>
          )}
        </>
      )}
    </section>
  );
}
