"use client";
import { useState } from "react";
import Link from "next/link";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { ExerciseLoggingType } from "@168hours/contracts";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { ErrorState, Loading, PageHeading } from "@/components/ui/feedback";
import { number } from "@/lib/format";
import { FitnessSelect } from "./fitness-select";
import {
  load,
  distance,
  ProgressChart,
  sessionDate,
  trackingLabels,
  volumeText,
} from "./progress-shared";

export function ExerciseProgressPage({ id }: { id: string }) {
  const {
    preferences: { timezone, weightUnit: unit, distanceUnit },
  } = useMe();
  const [mode, setMode] = useState<ExerciseLoggingType>();
  const [measure, setMeasure] = useState("maxWeightKg");
  const q = useInfiniteQuery({
    queryKey: ["fitness", "exercise-report", id, mode],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.getExerciseReport(id, {
        loggingType: mode,
        cursor: pageParam,
        limit: 30,
      }),
    getNextPageParam: (p) => p.sessions.nextCursor ?? undefined,
  });
  if (q.isPending) return <Loading />;
  if (q.error)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  const data = q.data.pages[0]!;
  const sessions = q.data.pages.flatMap((p) => p.sessions.items);
  const weighted =
    data.loggingType === "reps_load" || data.loggingType === "duration_load";
  const timed = [
    "duration",
    "duration_load",
    "distance_duration",
    "laps_duration",
  ].includes(data.loggingType);
  const options = [
    ...(data.loggingType === "distance_duration"
      ? [{ value: "maxDistanceMeters", label: "Longest distance" }]
      : []),
    ...(data.loggingType === "laps_duration"
      ? [{ value: "maxLaps", label: "Most laps" }]
      : []),
    ...(weighted ? [{ value: "maxWeightKg", label: "Highest load" }] : []),
    {
      value: timed ? "maxDurationSeconds" : "maxReps",
      label: timed ? "Longest set" : "Most reps in a set",
    },
    ...(data.loggingType === "reps_load"
      ? [{ value: "volumeKg", label: "Recorded session volume" }]
      : []),
  ];
  const metric = (
    options.some((o) => o.value === measure) ? measure : options[0]!.value
  ) as
    | "maxWeightKg"
    | "maxDurationSeconds"
    | "maxReps"
    | "volumeKg"
    | "maxDistanceMeters"
    | "maxLaps";
  const format = (v: number) =>
    metric === "maxWeightKg"
      ? load(v, unit)
      : metric === "volumeKg"
        ? load(v, unit, true)
        : metric === "maxDurationSeconds"
          ? `${number(v)} sec`
          : metric === "maxDistanceMeters"
            ? distance(v, distanceUnit)
            : `${number(v)} ${metric === "maxLaps" ? "laps" : "reps"}`;
  const latestValue = sessions[0]?.[metric] ?? null;
  const previousValue = sessions[1]?.[metric] ?? null;
  const titles = {
    load: "Highest load",
    reps: "Most reps in a set",
    duration: "Longest set",
    setVolume: "Highest set volume",
    distance: "Longest distance",
    laps: "Most laps",
  };
  return (
    <div className="fitness-progress-page form-stack">
      <Link href="/fitness/progress">← Progress</Link>
      <PageHeading
        title={`${data.exercise.name} progress`}
        description="Completed sets from finished workouts. Open a result to review its session."
      />
      {data.exercise.archivedAt && (
        <p className="muted">
          This exercise is archived. Its progress remains available.
        </p>
      )}
      <FitnessSelect
        label="Tracking type"
        searchable={false}
        value={data.loggingType}
        onChange={(v) => setMode(v as ExerciseLoggingType)}
        options={Object.entries(trackingLabels).map(([value, label]) => ({
          value,
          label,
        }))}
      />
      <p className="muted text-small">
        Results stay separate by the tracking type recorded in each workout.
        Targets, skipped sets and unfinished workouts are excluded.
      </p>
      <section className="form-stack" aria-labelledby="records-heading">
        <h2 id="records-heading">Personal records</h2>
        <p className="muted text-small">
          All-time best recorded sets for this tracking type. Ties show the
          earliest workout. A higher load and more reps may come from different
          sets.
        </p>
        {!data.records.length ? (
          <p>No records yet for {trackingLabels[data.loggingType]}.</p>
        ) : (
          <ul className="fitness-progress-records">
            {data.records.map((r) => (
              <li key={r.metric}>
                <span>{titles[r.metric]}</span>
                <strong>
                  {r.metric === "load" || r.metric === "setVolume"
                    ? load(r.value, unit, r.metric === "setVolume")
                    : r.metric === "distance"
                      ? distance(r.value, distanceUnit)
                      : `${number(r.value)} ${r.metric === "reps" ? "reps" : r.metric === "laps" ? "laps" : "sec"}`}
                </strong>
                <span className="text-small">
                  {[
                    r.distanceMeters !== null
                      ? distance(r.distanceMeters, distanceUnit)
                      : null,
                    r.laps !== null ? `${r.laps} laps` : null,
                    r.reps !== null ? `${r.reps} reps` : null,
                    r.weightKg !== null ? load(r.weightKg, unit) : null,
                    r.durationSeconds !== null
                      ? `${r.durationSeconds} sec`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <Link href={`/fitness/session/${r.workoutId}`}>
                  {sessionDate(r.startedAt, timezone)} · {r.workoutTitle}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="form-stack" aria-labelledby="exercise-trend-heading">
        <h2 id="exercise-trend-heading">Session trend</h2>
        <FitnessSelect
          label="Progress measure"
          searchable={false}
          value={metric}
          onChange={setMeasure}
          options={options}
        />
        <ProgressChart
          label={`${options.find((o) => o.value === metric)!.label} · ${sessions.length} shown sessions`}
          points={[...sessions].reverse().map((s) => ({
            label: sessionDate(s.startedAt, timezone),
            value: s[metric],
            href: `/fitness/session/${s.id}`,
          }))}
          format={format}
        />
        {metric === "volumeKg" && (
          <p className="muted text-small">
            Volume sums recorded load × reps. Sessions with missing measurements
            are partial; see the session rows below.
          </p>
        )}
        {sessions.length >= 2 && (
          <p className="fitness-progress-change">
            Latest compared with previous:{" "}
            <strong>
              {latestValue === null ||
              previousValue === null ||
              (metric === "volumeKg" &&
                (sessions[0]!.missingVolumeSets ||
                  sessions[1]!.missingVolumeSets))
                ? "Not comparable — measurements are incomplete"
                : `${format(latestValue)} vs ${format(previousValue)}`}
            </strong>
            . Compare the set details before treating a change as improvement.
          </p>
        )}
        <ul className="record-list fitness-progress-sessions">
          {sessions.map((s) => (
            <li key={s.id}>
              <div>
                <Link href={`/fitness/session/${s.id}`}>
                  {sessionDate(s.startedAt, timezone)} · {s.title}
                </Link>
                <p className="muted text-small">
                  {s.completedSets} completed sets
                  {data.loggingType === "reps_load"
                    ? ` · Volume: ${volumeText(s, unit)}`
                    : ""}
                </p>
              </div>
              <strong>
                {s[metric] === null ? "Not recorded" : format(s[metric])}
              </strong>
            </li>
          ))}
        </ul>
        {q.hasNextPage && (
          <button
            className="button"
            disabled={q.isFetchingNextPage}
            onClick={() => void q.fetchNextPage()}
          >
            Load older sessions
          </button>
        )}
        {!sessions.length && (
          <p>No finished sessions for this tracking type yet.</p>
        )}
      </section>
    </div>
  );
}
