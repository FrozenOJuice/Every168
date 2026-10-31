import { createClient } from "@168hours/api-client";
import { calendarRecoveryFetch } from "@/features/planning/calendar-write-recovery";
export const api = createClient({ fetch: calendarRecoveryFetch });
