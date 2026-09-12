"use client";
import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import type { Goal, GoalsQuery } from "@168hours/contracts";
import { api } from "@/lib/api";
import { Dialog } from "@/components/ui/dialog";
import {
  Empty,
  ErrorState,
  Loading,
  PageHeading,
} from "@/components/ui/feedback";
import { GoalForm } from "./goal-form";
import { GoalCard } from "./goal-card";
export function GoalsPage() {
  const [status, setStatus] = useState<GoalsQuery["status"]>("active");
  const [editing, setEditing] = useState<Goal | "new" | null>(null);
  const query = useInfiniteQuery({
    queryKey: ["goals", status],
    queryFn: ({ pageParam }) =>
      api.getGoals({ status, cursor: pageParam, limit: 30 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const goals = query.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <>
      <PageHeading
        eyebrow="A sense of direction"
        title="Goals"
        description="Keep what matters in view, one step at a time."
      >
        <button className="button primary" onClick={() => setEditing("new")}>
          Add goal
        </button>
      </PageHeading>
      <div className="tabs" aria-label="Goal status">
        {(["active", "completed", "paused", "archived"] as const).map((s) => (
          <button
            key={s}
            aria-pressed={status === s}
            onClick={() => setStatus(s)}
          >
            {s}
          </button>
        ))}
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : goals.length ? (
        <div className="goal-grid">
          {goals.map((g) => (
            <GoalCard key={g.id} goal={g} onEdit={setEditing} />
          ))}
        </div>
      ) : (
        <Empty>
          No {status} goals yet. A small, clear intention is a good place to
          start.
        </Empty>
      )}
      {query.hasNextPage && (
        <button
          className="button"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          Load more goals
        </button>
      )}
      {editing && (
        <Dialog
          title={editing === "new" ? "Add goal" : "Edit goal"}
          onClose={() => setEditing(null)}
        >
          <GoalForm
            goal={editing === "new" ? undefined : editing}
            onSaved={() => setEditing(null)}
          />
        </Dialog>
      )}
    </>
  );
}
