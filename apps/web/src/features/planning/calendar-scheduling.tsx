"use client";

import { CalendarWorkoutScheduler } from "@/features/fitness/calendar-workout-scheduler";
import type {
  CalendarSchedulingSource,
  CalendarSchedulerProps,
} from "@/features/workspace/calendar-scheduling";
import { useCalendarInteractions } from "./calendar-interactions";

/** Composition point: register enabled domain adapters here, never in Calendar's forms/API. */
export const calendarSchedulingSources: readonly CalendarSchedulingSource[] = [
  {
    id: "fitness.workout",
    actionLabel: "Schedule workout",
    Scheduler: CalendarWorkoutScheduler,
  },
];

export function CalendarScheduling({
  source,
  ...props
}: CalendarSchedulerProps & { source: CalendarSchedulingSource }) {
  const interaction = useCalendarInteractions();
  return (
    <source.Scheduler
      {...props}
      onScheduled={(result) => {
        interaction?.showNotice(result.message, { kind: "change" });
        props.onScheduled(result);
      }}
    />
  );
}
