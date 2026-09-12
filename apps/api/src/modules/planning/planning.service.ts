import type { GoalsService } from "../goals/goals.service.js";
import {
  blockInput,
  timeEntryInput,
  type BlockInput,
  type TimeEntryInput,
} from "@168hours/contracts";
import { weekRange, overlaps } from "@168hours/domain-utils";
import type { Db } from "../../infrastructure/database/client.js";
import { found } from "../../shared/errors/app-error.js";
import type { CategoriesService } from "../categories/categories.service.js";
import type { IdentityService } from "../identity/identity.service.js";
import type { planningRepository } from "./planning.repository.js";
import { summarizeWeek } from "./planning.summary.js";
export function planningService(
  repo: ReturnType<typeof planningRepository>,
  categories: CategoriesService,
  identity: IdentityService,
  goals: GoalsService,
) {
  async function category(u: string, id: string | null) {
    if (id) await categories.get(u, id);
  }
  return {
    async getBlock(u: string, id: string, tx?: Db) {
      return found(await repo.getBlock(u, id, tx));
    },
    async getEntry(u: string, id: string) {
      return found(await repo.getEntry(u, id));
    },
    async getWeek(u: string, date: string) {
      const prefs = await identity.getPreferences(u);
      const range = weekRange(date, prefs.timezone, prefs.weekStartsOn);
      const [blocks, entries, cats] = await Promise.all([
        repo.blocks(u, range.startsAt, range.endsAt),
        repo.entries(u, range.startsAt, range.endsAt),
        categories.list(u),
      ]);
      return {
        ...range,
        timezone: prefs.timezone,
        ...summarizeWeek(blocks, entries, cats, range),
        blocks,
        entries,
        days: range.days.map((day) => ({
          ...day,
          blockIds: blocks.filter((b) => overlaps(b, day)).map((b) => b.id),
          entryIds: entries.filter((e) => overlaps(e, day)).map((e) => e.id),
        })),
      };
    },
    async createBlock(u: string, input: BlockInput) {
      const data = blockInput.parse(input);
      await category(u, data.categoryId);
      if (data.goalId) await goals.get(u, data.goalId);
      return repo.createBlock(u, data);
    },
    async updateBlock(u: string, id: string, input: BlockInput) {
      const data = blockInput.parse(input);
      await category(u, data.categoryId);
      if (data.goalId) await goals.get(u, data.goalId);
      return found(await repo.updateBlock(u, id, data));
    },
    async deleteBlock(u: string, id: string) {
      found(await repo.deleteBlock(u, id));
      return { ok: true as const };
    },
    async createEntry(u: string, input: TimeEntryInput) {
      const data = timeEntryInput.parse(input);
      await category(u, data.categoryId);
      if (data.timeBlockId) found(await repo.getBlock(u, data.timeBlockId));
      return repo.createEntry(u, data);
    },
    async updateEntry(u: string, id: string, input: TimeEntryInput) {
      const data = timeEntryInput.parse(input);
      await category(u, data.categoryId);
      if (data.timeBlockId) found(await repo.getBlock(u, data.timeBlockId));
      return found(await repo.updateEntry(u, id, data));
    },
    async deleteEntry(u: string, id: string) {
      found(await repo.deleteEntry(u, id));
      return { ok: true as const };
    },
    async recordSource(
      tx: Db,
      u: string,
      input: TimeEntryInput & {
        sourceType: "strength_workout" | "cardio_activity";
        sourceId: string;
      },
    ) {
      timeEntryInput.parse({
        title: input.title,
        categoryId: input.categoryId,
        timeBlockId: input.timeBlockId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
      });
      if (input.timeBlockId)
        found(await repo.getBlock(u, input.timeBlockId, tx));
      return repo.upsertSource(tx, u, input);
    },
    removeSource: repo.removeSource,
  };
}
export type PlanningService = ReturnType<typeof planningService>;
