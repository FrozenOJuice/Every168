"use client";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { BeginWorkout } from "./fitness-page";
export function ScheduledWorkoutAction({ blockId }: { blockId: string }) {
  const q = useQuery({
    queryKey: ["fitness", "scheduled-block", blockId],
    queryFn: () => api.getStrengthPlanForBlock(blockId),
  });
  if (q.isPending) return null;
  if (q.error)
    return (
      <p role="alert" className="error">
        Workout details could not load.{" "}
        <button className="button" onClick={() => void q.refetch()}>
          Retry workout details
        </button>
      </p>
    );
  return q.data ? (
    <div className="row">
      <BeginWorkout plan={q.data} />
    </div>
  ) : null;
}
