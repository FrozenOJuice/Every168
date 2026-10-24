import type { QueryClient } from "@tanstack/react-query";
export async function invalidateCalendar(cache: QueryClient) {
  await Promise.all(
    [
      "week",
      "fitness",
      "tasks",
      "calendar-activity",
      "calendar-items",
      "calendar-search",
      "calendar-series",
      "calendar-templates",
      "calendar-preview",
      "dashboard",
    ].map((key) => cache.invalidateQueries({ queryKey: [key] })),
  );
}
