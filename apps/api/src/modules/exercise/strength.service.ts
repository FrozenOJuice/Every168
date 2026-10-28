import { normalizeMeasurementOverride } from "@168hours/contracts";
import {
  CALENDAR_ACTIVITY_LIMIT,
  type CalendarContribution,
} from "@168hours/contracts";
import { assertRevision } from "../../shared/errors/revision.js";
import {
  workoutUpdateInput,
  workoutStartingSetupSchema,
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
  const service = {
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
        label: "Fitness",
        href: "/fitness?tab=history",
        truncated: rows.length > CALENDAR_ACTIVITY_LIMIT,
        entries: rows.slice(0, CALENDAR_ACTIVITY_LIMIT).map((row) => ({
          source: { type: "strength_workout", id: row.id },
          domain: "Fitness",
          icon: "dumbbell",
          kind: "session",
          status: row.endedAt ? "recorded" : "draft",
          title: row.title,
          summary: row.endedAt ? "Finished workout" : "Workout in progress",
          occurredAt: row.startedAt.toISOString(),
          endsAt: row.endedAt?.toISOString() ?? null,
          href: `/fitness/session/${row.id}`,
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
    async captureStartingSetup(
      u: string,
      id: string,
      context: TransactionContext,
    ) {
      const workout = found(await repo.get(u, id, context, true));
      const setup = workoutStartingSetupSchema.parse({
        title: workout.title,
        notes: workout.notes,
        exercises: workout.exercises.map((e) => ({
          ...e,
          sets: e.sets.map((s) => ({
            id: s.id,
            measurementOverride: s.measurementOverride,
            targetReps: s.targetReps,
            targetWeightKg: s.targetWeightKg,
            targetDurationSeconds: s.targetDurationSeconds,
            targetDistanceMeters: s.targetDistanceMeters,
            targetLaps: s.targetLaps,
            restSeconds: s.restSeconds,
          })),
        })),
      });
      return found(await repo.setStartingSetup(u, id, setup, context));
    },
    async save(
      u: string,
      id: string,
      input: WorkoutUpdateInput,
      version: number,
      context?: TransactionContext,
      // Trusted names from an owner-scoped plan; never part of the wire input.
      exerciseNameSnapshots?: readonly string[],
    ) {
      const v = workoutUpdateInput.parse(input);
      return runInTransaction(async (tx) => {
        const old = assertRevision(await repo.get(u, id, tx, true), version);
        const block = v.linkedTimeBlockId
          ? await planning.getBlock(u, v.linkedTimeBlockId, tx)
          : null;
        const seen = new Set<string>();
        const names: string[] = [];
        const loggingTypes: import("@168hours/contracts").ExerciseLoggingType[] =
          [];
        const intents: string[][] = [];
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
          const starting = old.startingSetup?.exercises.find(
            (x) => x.id === e.id && x.exerciseId === e.exerciseId,
          );
          const existing = e.id
            ? found(old.exercises.find((x) => x.id === e.id) ?? starting)
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
            found(
              existing?.sets.find((s) => s.id === set.id) ??
                starting?.sets.find((s) => s.id === set.id),
            );
          }
          const definition = found(await exercises.get(u, e.exerciseId, tx));
          if (definition.archivedAt && existing?.exerciseId !== e.exerciseId)
            throw new AppError(
              422,
              "BUSINESS_RULE",
              "Choose an active exercise.",
            );
          loggingTypes.push(
            e.loggingType ??
              (existing?.exerciseId === e.exerciseId
                ? existing.loggingType
                : definition.loggingType),
          );
          for (const set of e.sets)
            set.measurementOverride = normalizeMeasurementOverride(
              set.measurementOverride,
              loggingTypes.at(-1)!,
            );
          intents.push(
            e.intentTags ??
              (existing?.exerciseId === e.exerciseId
                ? existing.intentTags
                : definition.intentTags),
          );
          names.push(
            existing?.exerciseId === e.exerciseId
              ? existing.exerciseNameSnapshot
              : (exerciseNameSnapshots?.[names.length] ?? definition.name),
          );
        }
        const result = found(
          await repo.replace(tx, u, id, v, names, loggingTypes, intents, old),
        );
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
    async repeat(
      u: string,
      id: string,
      version: number,
      context: TransactionContext,
    ) {
      const old = assertRevision(await repo.get(u, id, context, true), version);
      const start = await service.start(
        u,
        {
          title: old.title,
          startedAt: new Date().toISOString(),
          notes: old.notes,
          linkedTimeBlockId: null,
        },
        context,
      );
      await service.save(
        u,
        start.id,
        {
          title: start.title,
          startedAt: start.startedAt.toISOString(),
          endedAt: null,
          notes: old.notes,
          linkedTimeBlockId: null,
          exercises: old.exercises.map((e) => ({
            exerciseId: e.exerciseId,
            loggingType: e.loggingType,
            intentTags: e.intentTags,
            notes: e.notes,
            sets: e.sets.map((s) => ({
              measurementOverride: s.measurementOverride ?? null,
              reps: null,
              weightKg: null,
              durationSeconds: null,
              distanceMeters: null,
              laps: null,
              completed: false,
              resultsEdited: false,
              skipped: false,
              targetReps: s.targetReps ?? s.reps,
              targetWeightKg: s.targetWeightKg ?? s.weightKg,
              targetDurationSeconds:
                s.targetDurationSeconds ?? s.durationSeconds,
              targetDistanceMeters: s.targetDistanceMeters ?? s.distanceMeters,
              targetLaps: s.targetLaps ?? s.laps,
              restSeconds: s.restSeconds,
            })),
          })),
        },
        start.version,
        context,
      );
      return service.captureStartingSetup(u, start.id, context);
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
  return service;
}
export type StrengthService = ReturnType<typeof strengthService>;
