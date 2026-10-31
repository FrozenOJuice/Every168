import type { ComponentType } from "react";

/** Calendar supplies placement; each domain owns eligible records and canonical writes. */
export type CalendarScheduleContext = {
  date: string;
  timezone: string;
  minute?: number;
  durationMinutes?: number;
};
export type CalendarScheduleResult = {
  date: string;
  message: string;
};
export type CalendarSchedulerProps = {
  context: CalendarScheduleContext;
  onClose: () => void;
  onScheduled: (result: CalendarScheduleResult) => void;
};
export type CalendarSchedulingSource = {
  id: string;
  actionLabel: string;
  Scheduler: ComponentType<CalendarSchedulerProps>;
};
