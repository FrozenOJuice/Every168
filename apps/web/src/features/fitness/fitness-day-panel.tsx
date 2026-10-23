"use client";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { canNavigateAway } from "@/lib/use-unsaved-changes";
import { DomainDayPanel } from "@/features/workspace/domain-day-panel";
import { useDomainDay } from "@/features/workspace/domain-day-context";
export function FitnessDayPanel({ onNavigate }: { onNavigate: () => void }) {
  const { date, selectDate } = useDomainDay();
  const router = useRouter();
  const links = useQuery({
    queryKey: ["fitness", "day-links", date],
    queryFn: () => api.getFitnessDayLinks(date),
  });
  return (
    <DomainDayPanel
      domain="Fitness"
      sources={["strength_workout", "cardio_activity"]}
      sourceLabels={["Fitness", "Exercise"]}
      date={date}
      onDate={selectDate}
      plans={{
        blockIds: links.data?.blockIds ?? [],
        pending: links.isPending,
        error: links.error,
        retry: () => void links.refetch(),
      }}
      onActivity={(entry) => {
        if (!canNavigateAway()) return;
        onNavigate();
        router.push(entry.href);
      }}
      onCalendar={() => {
        if (!canNavigateAway()) return;
        onNavigate();
        router.push(`/?date=${date}&view=day`);
      }}
    />
  );
}
