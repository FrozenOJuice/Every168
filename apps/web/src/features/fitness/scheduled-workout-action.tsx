"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { BeginWorkout } from "./workout-actions";
export function ScheduledWorkoutAction({ blockId }: { blockId: string }) {
  const q = useQuery({
    queryKey: ["fitness", "scheduled-block", blockId],
    queryFn: () => api.getStrengthPlanForBlock(blockId),
  });
  const session = useQuery({
    queryKey: ["fitness", "session", q.data?.sessionId],
    queryFn: () => api.getWorkout(q.data!.sessionId!),
    enabled: !!q.data?.sessionId,
  });
  if (q.isPending) return null;
  if (q.data?.sessionId && session.isPending)
    return <p role="status">Loading workout…</p>;
  if (q.error || session.error)
    return (
      <p role="alert" className="error">
        Workout details could not load.{" "}
        <button
          className="button"
          onClick={() => void (q.error ? q.refetch() : session.refetch())}
        >
          Retry workout details
        </button>
      </p>
    );
  return q.data ? (
    <div className="row">
      {session.data?.endedAt ? (
        <Link
          className="button primary"
          href={`/fitness/session/${session.data.id}`}
        >
          View workout summary
        </Link>
      ) : (
        <BeginWorkout plan={q.data} />
      )}
    </div>
  ) : null;
}
