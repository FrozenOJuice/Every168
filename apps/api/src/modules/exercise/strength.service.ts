import {
  CALENDAR_ACTIVITY_LIMIT,
  type CalendarContribution,
} from "@168hours/contracts";
import { assertRevision } from "../../shared/errors/revision.js";
import {
  workoutUpdateInput,
  type WorkoutStartInput,
  type WorkoutUpdateInput,
} from "@168hours/contracts";
import type {
  RunInTransaction,
  TransactionContext,
} from "../../shared/transactions.js";
import { found, AppError } from "../../shared/errors/app-error.js";
import type { PlanningService } from "../planning/planning.service.js";
import type { exerciseRepository } from "./exercise.repository.js";
import type { strengthRepository } from "./strength.repository.js";
export function strengthService(
  runInTransaction: RunInTransaction,
  repo: ReturnType<typeof strengthRepository>,
  exercises: ReturnType<typeof exerciseRepository>,
  planning: PlanningService,
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
        label: "Exercise",
        href: "/exercise",
        truncated: rows.length > CALENDAR_ACTIVITY_LIMIT,
        entries: rows.slice(0, CALENDAR_ACTIVITY_LIMIT).map((row) => ({
          source: { type: "strength_workout", id: row.id },
          domain: "Exercise",
          icon: "dumbbell",
          kind: "session",
          status: row.endedAt ? "recorded" : "draft",
          title: row.title,
          summary: row.endedAt
            ? "Finished workout"
            : "Workout draft · not finished",
          occurredAt: row.startedAt.toISOString(),
          endsAt: row.endedAt?.toISOString() ?? null,
          href: `/exercise/workout/${row.id}`,
        })),
      };
    },
    list: repo.list,
    latest: repo.latest,
    async get(u: string, id: string) {
      return found(await repo.get(u, id));
    },
    async start(u: string, v: WorkoutStartInput, context?: TransactionContext) {
      if (v.linkedTimeBlockId)
        await planning.getBlock(u, v.linkedTimeBlockId, context);
      const row = await repo.start(u, v, context);
      return { ...row, exercises: [] };
    },
    async save(
      u: string,
      id: string,
      input: WorkoutUpdateInput,
      version: number,
      context?: TransactionContext,
    ) {
      const v = workoutUpdateInput.parse(input);
      return runInTransaction(async (tx) => {
        const old = assertRevision(await repo.get(u, id, tx, true), version);
        const block = v.linkedTimeBlockId
          ? await planning.getBlock(u, v.linkedTimeBlockId, tx)
          : null;
        const seen = new Set<string>();
        const names: string[] = [];
        for (const e of v.exercises) {
          if (e.id) {
            if (seen.has(e.id))
              throw new AppError(
                422,
                "VALIDATION_ERROR",
                "Each workout exercise must have a unique identifier.",
              );
            seen.add(e.id);
          }
          const existing = e.id
            ? found(old.exercises.find((x) => x.id === e.id))
            : undefined;
          const seenSets = new Set<string>();
          for (const set of e.sets) {
            if (!set.id) continue;
            if (seenSets.has(set.id))
              throw new AppError(
                422,
                "VALIDATION_ERROR",
                "Each set must have a unique identifier.",
              );
            seenSets.add(set.id);
            found(existing?.sets.find((s) => s.id === set.id));
          }
          const definition = found(await exercises.get(u, e.exerciseId, tx));
          if (definition.archivedAt && existing?.exerciseId !== e.exerciseId)
            throw new AppError(
              422,
              "BUSINESS_RULE",
              "Choose an active exercise.",
            );
          names.push(
            existing?.exerciseId === e.exerciseId
              ? existing.exerciseNameSnapshot
              : definition.name,
          );
        }
        const result = found(await repo.replace(tx, u, id, v, names, old));
        if (v.endedAt)
          await planning.recordSource(tx, u, {
            title: v.title,
            categoryId: block?.categoryId ?? null,
            timeBlockId: v.linkedTimeBlockId,
            startsAt: v.startedAt,
            endsAt: v.endedAt,
            sourceType: "strength_workout",
            sourceId: id,
          });
        else await planning.removeSource(tx, u, "strength_workout", id);
        return result;
      }, context);
    },
    async remove(
      u: string,
      id: string,
      version: number,
      context?: TransactionContext,
    ) {
      return runInTransaction(async (tx) => {
        assertRevision(await repo.get(u, id, tx, true), version);
        await planning.removeSource(tx, u, "strength_workout", id);
        found(await repo.remove(tx, u, id));
        return { ok: true as const };
      }, context);
    },
  };
}
export type StrengthService = ReturnType<typeof strengthService>;
