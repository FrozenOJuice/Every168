"use client";

import { localDate } from "@168hours/domain-utils";
import { useState } from "react";
import type { StrengthPlan } from "@168hours/contracts";
import type { CalendarSchedulerProps } from "@/features/workspace/calendar-scheduling";
import { CalendarSourcePicker } from "@/features/workspace/calendar-source-picker";
import { useWorkoutSearch } from "./workout-search";
import { ScheduleWorkout } from "./schedule-workout";

export function CalendarWorkoutScheduler({
  context,
  onClose,
  onScheduled,
}: CalendarSchedulerProps) {
  const [selected, setSelected] = useState<StrengthPlan | null>(null);
  const { search, setSearch, query } = useWorkoutSearch(!selected, 12, true);
  const choices = query.data?.pages.flatMap((page) => page.items) ?? [];
  if (selected)
    return (
      <ScheduleWorkout
        plan={selected}
        initialContext={context}
        onClose={onClose}
        onChooseAnother={() => setSelected(null)}
        onScheduled={(schedule) =>
          onScheduled({
            date: localDate(schedule.startsAt, context.timezone),
            message: `${selected.title} scheduled.`,
          })
        }
      />
    );
  return (
    <CalendarSourcePicker
      title="Schedule workout"
      searchLabel="Search workouts"
      search={search}
      onSearch={setSearch}
      loading={query.isPending}
      error={query.error}
      onRetry={() => void query.refetch()}
      choices={choices.map((plan) => ({
        id: plan.id,
        title: plan.title,
        detail: `${plan.exercises.length} ${plan.exercises.length === 1 ? "exercise" : "exercises"}`,
      }))}
      emptyMessage={
        search.trim()
          ? "No workouts match your search."
          : "No workouts ready to schedule. Save a workout in Fitness first."
      }
      onSelect={(id) => {
        const plan = choices.find((plan) => plan.id === id);
        if (plan) setSelected(plan);
      }}
      onLoadMore={
        query.hasNextPage ? () => void query.fetchNextPage() : undefined
      }
      loadingMore={query.isFetchingNextPage}
      onClose={onClose}
    />
  );
}
