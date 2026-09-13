"use client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeading, Loading, ErrorState } from "@/components/ui/feedback";
import { WorkoutEditor } from "./workout-editor";
export function WorkoutPage({ id }: { id: string }) {
  const query = useQuery({
    queryKey: ["workout", id],
    queryFn: () => api.getWorkout(id),
    refetchOnWindowFocus: false,
  });
  return (
    <div className="workout-workspace">
      <PageHeading
        eyebrow="Strength"
        title={query.data?.title ?? "Your workout"}
        description="Record sets as you go. Save your progress before leaving."
      >
        <Link className="button" href="/exercise">
          Workout history
        </Link>
      </PageHeading>
      {query.isPending ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <WorkoutEditor key={query.data.id} workout={query.data} />
      )}
    </div>
  );
}
