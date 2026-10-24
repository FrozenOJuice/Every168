import { z } from "zod";
import { idSchema } from "@168hours/contracts";
import { assertRevision } from "../../shared/errors/revision.js";
import type { GoalsService } from "../goals/goals.service.js";
import {
  blockInput,
  timeEntryInput,
  type BlockInput,
  type TimeEntryInput,
} from "@168hours/contracts";
import { weekRange, overlaps } from "@168hours/domain-utils";
import type { TransactionContext } from "../../shared/transactions.js";
import { found } from "../../shared/errors/app-error.js";
import type { CategoriesService } from "../categories/categories.service.js";
import type { IdentityService } from "../identity/identity.service.js";
import type { planningRepository } from "./planning.repository.js";
import { summarizeWeek } from "./planning.summary.js";
export type { BlockSourceLink } from "./planning.types.js";
import type { BlockSourceLink } from "./planning.types.js";
export function planningService(
  repo: ReturnType<typeof planningRepository>,
  categories: CategoriesService,
  identity: IdentityService,
  goals: GoalsService,
  sourceLinks?: {
    capture: (
      u: string,
      id: string,
      context: TransactionContext,
    ) => Promise<BlockSourceLink[]>;
    restore: (
      u: string,
      id: string,
      links: BlockSourceLink[],
      context: TransactionContext,
    ) => Promise<void>;
  },
) {
  async function category(
    u: string,
    id: string | null,
    context?: TransactionContext,
  ) {
    if (id) await categories.get(u, id, context);
  }
  return {
    platformUsage: repo.platformUsage,
    blocksByIds(u: string, ids: string[]) {
      const checked = z.array(idSchema).max(100).parse(ids);
      return checked.length
        ? repo.blocksByIds(u, checked)
        : Promise.resolve([]);
    },
    async getBlock(u: string, id: string, tx?: TransactionContext) {
      return found(await repo.getBlock(u, id, tx));
    },
    async getEntry(u: string, id: string) {
      return found(await repo.getEntry(u, id));
    },
    async getWeek(u: string, date: string) {
      const prefs = await identity.getPreferences(u);
      const range = weekRange(date, prefs.timezone, prefs.weekStartsOn);
      const [{ blocks, entries }, cats] = await Promise.all([
        repo.weekRecords(u, range.startsAt, range.endsAt),
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
    async createBlock(
      u: string,
      input: BlockInput,
      context?: TransactionContext,
    ) {
      const data = blockInput.parse(input);
      await category(u, data.categoryId, context);
      if (data.goalId) await goals.get(u, data.goalId, context);
      return repo.createBlock(u, data, context);
    },
    async updateBlock(
      u: string,
      id: string,
      input: BlockInput,
      version: number,
      context?: TransactionContext,
    ) {
      const data = blockInput.parse(input);
      await category(u, data.categoryId, context);
      if (data.goalId) await goals.get(u, data.goalId, context);
      return found(await repo.updateBlock(u, id, data, version, context));
    },
    async deleteBlock(
      u: string,
      id: string,
      version: number,
      context?: TransactionContext,
      excludeOccurrence = true,
    ) {
      found(await repo.deleteBlock(u, id, version, context, excludeOccurrence));
      return { ok: true as const };
    },
    async updateBlockWithUndo(
      u: string,
      id: string,
      input: BlockInput,
      version: number,
      context: TransactionContext,
    ) {
      const data = blockInput.parse(input);
      await category(u, data.categoryId, context);
      if (data.goalId) await goals.get(u, data.goalId, context);
      return repo.updateBlockWithUndo(u, id, data, version, context);
    },
    async undoEdit(
      u: string,
      undoId: string,
      version: number,
      context: TransactionContext,
    ) {
      const receipt = found(await repo.getEdit(u, undoId, context));
      await category(u, receipt.before.categoryId, context);
      if (receipt.before.goalId)
        await goals.get(u, receipt.before.goalId, context);
      return repo.undoEdit(u, undoId, version, context);
    },
    async deleteBlockWithUndo(
      u: string,
      id: string,
      version: number,
      context: TransactionContext,
      excludeOccurrence = true,
    ) {
      const links = (await sourceLinks?.capture(u, id, context)) ?? [];
      return repo.deleteBlockWithUndo(
        u,
        id,
        version,
        links,
        context,
        excludeOccurrence,
      );
    },
    async restoreBlock(
      u: string,
      undoId: string,
      context: TransactionContext,
      seriesRestore = false,
    ) {
      const receipt = found(await repo.getDeletion(u, undoId, context));
      await category(u, receipt.snapshot.categoryId, context);
      if (receipt.snapshot.goalId)
        await goals.get(u, receipt.snapshot.goalId, context);
      const restored = await repo.restoreBlock(
        u,
        undoId,
        context,
        seriesRestore,
      );
      await sourceLinks?.restore(u, restored.id, receipt.sourceLinks, context);
      return restored;
    },
    async createEntry(
      u: string,
      input: TimeEntryInput,
      context?: TransactionContext,
    ) {
      const data = timeEntryInput.parse(input);
      await category(u, data.categoryId, context);
      if (data.timeBlockId)
        found(await repo.getBlock(u, data.timeBlockId, context));
      return repo.createEntry(u, data, context);
    },
    async updateEntry(
      u: string,
      id: string,
      input: TimeEntryInput,
      version: number,
      context?: TransactionContext,
    ) {
      assertRevision(await repo.getEntry(u, id, context), version);
      const data = timeEntryInput.parse(input);
      await category(u, data.categoryId, context);
      if (data.timeBlockId)
        found(await repo.getBlock(u, data.timeBlockId, context));
      return found(await repo.updateEntry(u, id, data, version, context));
    },
    async deleteEntry(
      u: string,
      id: string,
      version: number,
      context?: TransactionContext,
    ) {
      found(await repo.deleteEntry(u, id, version, context));
      return { ok: true as const };
    },
    async recordSource(
      tx: TransactionContext,
      u: string,
      input: TimeEntryInput & {
        sourceType: "strength_workout" | "cardio_activity" | "task_time";
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
