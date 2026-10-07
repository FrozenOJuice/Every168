import {
  CALENDAR_ACTIVITY_LIMIT,
  type CalendarContribution,
} from "@168hours/contracts";
import { localDate, fromKilograms } from "@168hours/domain-utils";
import type { TransactionContext } from "../../shared/transactions.js";
import type { WeightInput, MeasurementHistoryQuery } from "@168hours/contracts";
import { addDays, dayRange } from "@168hours/domain-utils";
import type { IdentityService } from "../identity/identity.service.js";
import { found } from "../../shared/errors/app-error.js";
import type { bodyRepository } from "./body.repository.js";
export function bodyService(
  repo: ReturnType<typeof bodyRepository>,
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
        label: "Weight",
        href: "/food",
        truncated: rows.length > CALENDAR_ACTIVITY_LIMIT,
        entries: rows.slice(0, CALENDAR_ACTIVITY_LIMIT).map((row) => ({
          source: { type: "weight_entry", id: row.id },
          domain: "Weight",
          icon: "scale",
          kind: "moment",
          status: "recorded",
          title: "Weight recorded",
          summary: `${Number(fromKilograms(row.weightKg, range.weightUnit).toFixed(2))} ${range.weightUnit}`,
          occurredAt: row.measuredAt.toISOString(),
          endsAt: null,
          href: `/food?date=${localDate(row.measuredAt, range.timezone)}#food-weight`,
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
    latest: repo.latest,
    async review(u: string, date: string) {
      const { timezone } = await identity.getPreferences(u);
      const range = dayRange(date, timezone);
      const from = addDays(date, -29);
      const result = await repo.review(
        u,
        range.startsAt,
        range.endsAt,
        dayRange(from, timezone).startsAt,
      );
      return {
        date,
        latest: result.latest,
        entries: result.entries,
        trend: {
          from,
          to: date,
          entries: result.trend.slice(0, 200),
          truncated: result.trend.length > 200,
        },
      };
    },
    async get(u: string, id: string) {
      return found(await repo.get(u, id));
    },
    async update(
      u: string,
      id: string,
      v: WeightInput,
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
  };
}
export type BodyService = ReturnType<typeof bodyService>;
