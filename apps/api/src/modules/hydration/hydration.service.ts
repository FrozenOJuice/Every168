import { dayRange } from "@168hours/domain-utils";
import type { WaterInput } from "@168hours/contracts";
import { found } from "../../shared/errors/app-error.js";
import type { IdentityService } from "../identity/identity.service.js";
import type { hydrationRepository } from "./hydration.repository.js";
export function hydrationService(
  repo: ReturnType<typeof hydrationRepository>,
  identity: IdentityService,
) {
  return {
    list: repo.list,
    create: repo.create,
    async get(u: string, id: string) {
      return found(await repo.get(u, id));
    },
    async update(u: string, id: string, v: WaterInput) {
      return found(await repo.update(u, id, v));
    },
    async remove(u: string, id: string) {
      found(await repo.remove(u, id));
      return { ok: true as const };
    },
    async daily(u: string, date: string) {
      const prefs = await identity.getPreferences(u);
      const range = dayRange(date, prefs.timezone);
      const result = await repo.daily(u, range.startsAt, range.endsAt);
      return {
        date,
        totalMl: result.count ? result.total : null,
        count: result.count,
      };
    },
  };
}
export type HydrationService = ReturnType<typeof hydrationService>;
