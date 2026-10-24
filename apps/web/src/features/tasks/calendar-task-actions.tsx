"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
export function TaskBlockAction({ blockId }: { blockId: string }) {
  const query = useQuery({
    queryKey: ["tasks", "for-block", blockId],
    queryFn: () => api.getTaskForBlock(blockId),
  });
  if (query.error)
    return (
      <p role="alert">
        Could not load task link.{" "}
        <button className="text-button" onClick={() => void query.refetch()}>
          Retry task link
        </button>
      </p>
    );
  return query.data?.taskId ? (
    <Link className="button" href={`/tasks?task=${query.data.taskId}`}>
      Open task
    </Link>
  ) : null;
}
export function TaskTimeAction({ sourceId }: { sourceId: string }) {
  const query = useQuery({
    queryKey: ["tasks", "for-time", sourceId],
    queryFn: () => api.getTaskForTime(sourceId),
  });
  if (query.error)
    return (
      <p role="alert">
        Could not load task.{" "}
        <button className="text-button" onClick={() => void query.refetch()}>
          Retry task
        </button>
      </p>
    );
  return query.data ? (
    <Link className="button" href={`/tasks?task=${query.data.taskId}`}>
      Open task
    </Link>
  ) : null;
}
