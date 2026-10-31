import { AppError } from "../../shared/errors/app-error.js";
import {
  calendarSearchQuery,
  type CalendarSearchQuery,
} from "@168hours/contracts";
import { addDays, dayRange } from "@168hours/domain-utils";
import type { IdentityService } from "../identity/identity.service.js";
import type { calendarSearchRepository } from "./calendar-search.repository.js";
export function calendarSearchService(
  repo: ReturnType<typeof calendarSearchRepository>,
  identity: IdentityService,
  allowUnscheduled: boolean,
) {
  return {
    async search(u: string, input: CalendarSearchQuery) {
      const q = calendarSearchQuery.parse(input),
        prefs = await identity.getPreferences(u);
      if (!allowUnscheduled && q.kind === "unscheduled")
        throw new AppError(404, "NOT_FOUND", "Search type not available.");
      return repo.search(
        u,
        q,
        q.from ? dayRange(q.from, prefs.timezone).startsAt : undefined,
        q.to ? dayRange(addDays(q.to, 1), prefs.timezone).startsAt : undefined,
        allowUnscheduled,
      );
    },
  };
}
export type CalendarSearchService = ReturnType<typeof calendarSearchService>;
