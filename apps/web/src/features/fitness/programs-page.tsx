"use client";
import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Loading, ErrorState, PageHeading } from "@/components/ui/feedback";
import { FitnessSelect } from "./fitness-select";
import { trainingDayNames } from "./program-editor";
import type { TrainingProgram } from "@168hours/contracts";
export function programCadence(p: Pick<TrainingProgram, "trainingDays">) {
  return p.trainingDays.length
    ? [1, 2, 3, 4, 5, 6, 0]
        .filter((d) => p.trainingDays.includes(d))
        .map((d) => trainingDayNames[d]!.slice(0, 3))
        .join(" · ")
    : "Flexible rotation";
}
export function ProgramsPage() {
  const [status, setStatus] = useState<"all" | "active" | "paused">("active");
  return (
    <div className="form-stack fitness-program-page">
      <Link href="/fitness">← Fitness</Link>
      <PageHeading
        title="Training programs"
        description="Give your saved workouts a repeatable order and keep track of what comes next."
      />
      <Link className="button primary" href="/fitness/programs/new">
        Create program
      </Link>
      <FitnessSelect
        label="Program status"
        value={status}
        onChange={(s) => setStatus(s as typeof status)}
        searchable={false}
        options={[
          { value: "active", label: "Active programs" },
          { value: "paused", label: "Paused programs" },
          { value: "all", label: "All programs" },
        ]}
      />
      <ProgramList status={status} />
    </div>
  );
}
export function ProgramsOverview() {
  return (
    <section
      id="training-programs"
      tabIndex={-1}
      className="fitness-program-overview"
      aria-labelledby="programs-heading"
    >
      <div className="fitness-section-heading">
        <h2 id="programs-heading">Training programs</h2>
        <Link className="button" href="/fitness/programs/new">
          <Plus size={16} aria-hidden="true" />
          Create program
        </Link>
      </div>
      <ProgramList compact status="all" />
    </section>
  );
}
function ProgramList({
  status,
  compact = false,
}: {
  status: "all" | "active" | "paused";
  compact?: boolean;
}) {
  const q = useInfiniteQuery({
    queryKey: ["fitness", "programs", status, compact],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.getTrainingPrograms({
        paused: status,
        limit: compact ? 3 : 20,
        cursor: pageParam,
      }),
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  if (q.isPending) return <Loading />;
  if (q.error)
    return <ErrorState error={q.error} retry={() => void q.refetch()} />;
  return (
    <>
      <div className="fitness-cards">
        {q.data.pages
          .flatMap((p) => p.items)
          .map((p) => (
            <Link
              className="panel fitness-program-card"
              key={p.id}
              href={`/fitness/programs/${p.id}`}
            >
              <strong>{p.title}</strong>
              <span className="muted text-small">
                {programCadence(p)} · {p.steps.length} steps
                {p.paused ? " · Paused" : ""}
              </span>
              <span>Next: {p.next.title}</span>
              <span className="muted text-small">
                Cycle {p.next.cycle} · {p.completedCount} finished
                {p.next.occurrence?.session ? " · In progress" : ""}
              </span>
            </Link>
          ))}
      </div>
      {!q.data.pages[0]?.items.length && (
        <p className={compact ? "fitness-overview-empty" : "muted"}>
          No {status === "all" ? "" : status + " "}programs yet.{" "}
          {compact && "Organize workouts into a repeating training plan."}
          {!compact && status !== "paused" && (
            <Link href="/fitness/programs/new">Create a program</Link>
          )}
        </p>
      )}
      {q.hasNextPage && (
        <button
          className="button"
          disabled={q.isFetchingNextPage}
          onClick={() => void q.fetchNextPage()}
        >
          {compact ? "Show more programs" : "More programs"}
        </button>
      )}
    </>
  );
}
