import type { CalendarContribution } from "@168hours/contracts";
import { dayRange } from "@168hours/domain-utils";
import type { IdentityService } from "../identity/identity.service.js";
export type CalendarActivityProvider = (
  userId: string,
  range: {
    startsAt: string;
    endsAt: string;
    timezone: string;
    weightUnit: "kg" | "lb";
  },
) => Promise<CalendarContribution>;
export function calendarActivityService(
  identity: IdentityService,
  providers: CalendarActivityProvider[],
) {
  return {
    async range(userId: string, from: string, to: string) {
      const preferences = await identity.getPreferences(userId);
      const range = {
        startsAt: dayRange(from, preferences.timezone).startsAt,
        endsAt: dayRange(to, preferences.timezone).endsAt,
        timezone: preferences.timezone,
        weightUnit: preferences.weightUnit,
      };
      // No stored duplicate activity feed. Corrections/deletions are visible on the next read.
      const contributions = await Promise.all(
        providers.map((provider) => provider(userId, range)),
      );
      return {
        timezone: range.timezone,
        entries: contributions
          .flatMap((c) => c.entries)
          .sort(
            (a, b) =>
              Date.parse(a.occurredAt) - Date.parse(b.occurredAt) ||
              a.source.type.localeCompare(b.source.type) ||
              a.source.id.localeCompare(b.source.id),
          ),
        truncatedSources: contributions
          .filter((c) => c.truncated)
          .map(({ label, href }) => ({ label, href })),
      };
    },
  };
}
export type CalendarActivityService = ReturnType<
  typeof calendarActivityService
>;
