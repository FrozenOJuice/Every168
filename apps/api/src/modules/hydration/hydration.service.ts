import {
  CALENDAR_ACTIVITY_LIMIT,
  type CalendarContribution,
} from "@168hours/contracts";
import { localDate } from "@168hours/domain-utils";
import type { TransactionContext } from "../../shared/transactions.js";
import { dayRange } from "@168hours/domain-utils";
import type { WaterInput, MeasurementHistoryQuery } from "@168hours/contracts";
import { found } from "../../shared/errors/app-error.js";
import type { IdentityService } from "../identity/identity.service.js";
import type { hydrationRepository } from "./hydration.repository.js";
export function hydrationService(
  repo: ReturnType<typeof hydrationRepository>,
  identity: IdentityService,
) {
  return {
    async calendarActivity(
      u: string,
      range: {
        startsAt: string;
        endsAt: string;
        timezone: string;
        weightUnit: "kg" | "lb";
      },
    ): Promise<CalendarContribution> {
      const rows = await repo.activityRange(u, range.startsAt, range.endsAt);
      return {
        label: "Water",
        href: "/food",
        truncated: rows.length > CALENDAR_ACTIVITY_LIMIT,
        entries: rows.slice(0, CALENDAR_ACTIVITY_LIMIT).map((row) => ({
          source: { type: "water_entry", id: row.id },
          domain: "Water",
          icon: "droplet",
          kind: "moment",
          status: "recorded",
          title: "Water",
          summary: `${row.amountMl} ml`,
          occurredAt: row.consumedAt.toISOString(),
          endsAt: null,
          href: `/food?date=${localDate(row.consumedAt, range.timezone)}#food-water`,
        })),
      };
    },
    async list(u: string, q: MeasurementHistoryQuery) {
      const before = q.through
        ? dayRange(q.through, (await identity.getPreferences(u)).timezone)
            .endsAt
        : undefined;
      return repo.list(u, q, before);
    },
    create: repo.create,
    async get(u: string, id: string) {
      return found(await repo.get(u, id));
    },
    async update(
      u: string,
      id: string,
      v: WaterInput,
      version: number,
      context?: TransactionContext,
    ) {
      return found(await repo.update(u, id, v, version, context));
    },
    async remove(
      u: string,
      id: string,
      version: number,
      context?: TransactionContext,
    ) {
      found(await repo.remove(u, id, version, context));
      return { ok: true as const };
    },
    async daily(u: string, date: string) {
      const prefs = await identity.getPreferences(u);
      const range = dayRange(date, prefs.timezone);
      const result = await repo.daily(u, range.startsAt, range.endsAt);
      return {
        date,
        totalMl: result.length
          ? result.reduce((sum, entry) => sum + entry.amountMl, 0)
          : null,
        count: result.length,
        entries: result,
      };
    },
  };
}
export type HydrationService = ReturnType<typeof hydrationService>;
