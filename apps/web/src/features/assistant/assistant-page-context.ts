"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { dateSchema } from "@168hours/contracts";
import { localDate } from "@168hours/domain-utils";
import { useMe } from "@/features/identity/me";
import { useDomainDay } from "@/features/workspace/domain-day-context";
function usePageLabel() {
  const path = usePathname();
  const params = useSearchParams();
  const { date } = useDomainDay();
  const {
    preferences: { timezone },
  } = useMe();
  if (path === "/assistant") return null;
  if (path === "/") {
    const parsed = dateSchema.safeParse(params.get("date"));
    const view = params.get("view");
    return {
      page: `Calendar · ${view === "day" ? "Day" : view === "month" ? "Month" : "Week"}`,
      date: parsed.success ? parsed.data : localDate(new Date(), timezone),
    };
  }
  if (path === "/food") {
    const views: Record<string, string> = {
      day: "Daily log",
      food: "Food library",
      meal: "Saved meals",
      recipe: "Recipes",
      history: "History",
    };
    return {
      page: `Food · ${views[params.get("view") ?? "day"] ?? "Daily log"}`,
      date,
    };
  }
  if (path.startsWith("/fitness")) {
    const view = path.startsWith("/fitness/workout/")
      ? "Workout editor"
      : path.startsWith("/fitness/session/")
        ? "Workout session"
        : path.startsWith("/fitness/programs")
          ? "Training programs"
          : path.startsWith("/fitness/exercises")
            ? "Exercises"
            : path.startsWith("/fitness/history") ||
                path.startsWith("/fitness/progress")
              ? "History"
              : "Training";
    return { page: `Fitness · ${view}`, date };
  }
  if (path === "/tasks") {
    const views: Record<string, string> = {
      inbox: "Inbox",
      today: "Today",
      upcoming: "Upcoming",
      all: "All tasks",
      projects: "Projects",
      routines: "Routines",
    };
    return {
      page: `Tasks · ${views[params.get("view") ?? "inbox"] ?? "Inbox"}`,
      date,
    };
  }
  const names: Record<string, string> = {
    "/settings": "Settings",
    "/admin": "Admin",
    "/routines": "Routines",
    "/goals": "Goals",
    "/unscheduled": "Unscheduled plans",
  };
  return { page: names[path] ?? "168Hours", date: null };
}

export type AssistantPageContext = {
  page: string;
  date: string | null;
  href: string;
  returnLabel: string;
};
export function useAssistantPageContext(): AssistantPageContext | null {
  const label = usePageLabel();
  const path = usePathname();
  const params = useSearchParams();
  if (!label) return null;
  const query = new URLSearchParams(params.toString());
  if (label.date) query.set("date", label.date);
  const text = query.toString();
  const destination =
    path.startsWith("/fitness/workout/") || path.startsWith("/fitness/session/")
      ? "workout"
      : label.page.split(" · ")[0]!;
  return {
    ...label,
    href: path + (text ? "?" + text : ""),
    returnLabel: "Return to " + destination,
  };
}
