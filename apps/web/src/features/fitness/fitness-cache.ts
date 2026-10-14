import type { QueryClient } from "@tanstack/react-query";
import { invalidateCalendar } from "@/features/planning/invalidate-calendar";
export function invalidateFitness(cache: QueryClient) {
  void invalidateCalendar(cache);
}
