import {
  strengthPlanInput,
  strengthScheduleInput,
  strengthBeginInput,
  type StrengthPlanInput,
  type StrengthScheduleInput,
} from "@168hours/contracts";
import { assertRevision } from "../../shared/errors/revision.js";
import { found, AppError } from "../../shared/errors/app-error.js";
import type { TransactionContext } from "../../shared/transactions.js";
import type { PlanningService } from "../planning/planning.service.js";
import type { StrengthService } from "./strength.service.js";
import type { exerciseRepository } from "./exercise.repository.js";
import type { strengthPlansRepository } from "./strength-plans.repository.js";

export function strengthPlansService(
  repo: ReturnType<typeof strengthPlansRepository>,
  exercises: ReturnType<typeof exerciseRepository>,
  strength: StrengthService,
  planning: PlanningService,
) {
  async function snapshot(
    u: string,
    input: StrengthPlanInput,
    tx: TransactionContext,
  ) {
    const v = strengthPlanInput.parse(input);
    const rows = [];
    for (const e of v.exercises) {
      const definition = found(await exercises.get(u, e.exerciseId, tx));
      if (definition.archivedAt)
        throw new AppError(422, "BUSINESS_RULE", "Choose an active exercise.");
      rows.push({ ...e, name: definition.name });
    }
    return { ...v, exercises: rows };
  }
  return {
    list: repo.list,
    forBlock: repo.forBlock,
    async get(u: string, id: string) {
      return found(await repo.get(u, id));
    },
    async create(u: string, input: StrengthPlanInput, tx: TransactionContext) {
      return repo.create(
        u,
        { ...(await snapshot(u, input, tx)), kind: "workout" },
        tx,
      );
    },
    async update(
      u: string,
      id: string,
      input: StrengthPlanInput,
      version: number,
      tx: TransactionContext,
    ) {
      const old = assertRevision(await repo.get(u, id, tx), version);
      if (old.kind !== "workout")
        throw new AppError(
          422,
          "BUSINESS_RULE",
          "Edit the session after starting a scheduled workout.",
        );
      return repo.update(u, id, await snapshot(u, input, tx), tx);
    },
    async remove(
      u: string,
      id: string,
      version: number,
      tx: TransactionContext,
    ) {
      const old = assertRevision(await repo.get(u, id, tx), version);
      if (old.kind !== "workout")
        throw new AppError(
          422,
          "BUSINESS_RULE",
          "Manage scheduled time from Calendar.",
        );
      await repo.remove(u, id, tx);
      return { ok: true as const };
    },
    async schedule(
      u: string,
      id: string,
      input: StrengthScheduleInput,
      version: number,
      tx: TransactionContext,
    ) {
      const plan = assertRevision(await repo.get(u, id, tx), version);
      if (plan.kind !== "workout")
        throw new AppError(422, "BUSINESS_RULE", "Choose a reusable workout.");
      const schedule = strengthScheduleInput.parse(input);
      const block = await planning.createBlock(
        u,
        {
          ...schedule,
          title: plan.title,
          notes: plan.notes,
          categoryId: null,
          goalId: null,
        },
        tx,
      );
      return repo.create(
        u,
        {
          title: plan.title,
          notes: plan.notes,
          exercises: plan.exercises,
          kind: "scheduled",
          timeBlockId: block.id,
        },
        tx,
      );
    },
    async begin(
      u: string,
      id: string,
      startedAt: string,
      version: number,
      tx: TransactionContext,
    ) {
      strengthBeginInput.parse({ startedAt });
      const plan = found(await repo.get(u, id, tx));
      // A scheduled workout is resumed rather than started twice, even from another tab.
      if (plan.sessionId) return strength.get(u, plan.sessionId);
      assertRevision(plan, version);
      const scheduledBlock = plan.timeBlockId
        ? await planning.getBlock(u, plan.timeBlockId, tx)
        : null;
      const sessionTitle = scheduledBlock?.title ?? plan.title;
      const sessionNotes = scheduledBlock ? scheduledBlock.notes : plan.notes;
      const session = await strength.start(
        u,
        {
          title: sessionTitle,
          notes: sessionNotes,
          startedAt,
          linkedTimeBlockId: plan.timeBlockId,
        },
        tx,
      );
      const workout = await strength.save(
        u,
        session.id,
        {
          title: sessionTitle,
          notes: sessionNotes,
          startedAt,
          endedAt: null,
          linkedTimeBlockId: plan.timeBlockId,
          exercises: plan.exercises.map((e) => ({
            exerciseId: e.exerciseId,
            notes: e.notes,
            sets: e.sets.map((s) => ({
              ...s,
              reps: null,
              weightKg: null,
              durationSeconds: null,
              completed: false,
              skipped: false,
            })),
          })),
        },
        session.version,
        tx,
      );
      if (plan.kind === "scheduled")
        await repo.update(u, id, { sessionId: session.id }, tx);
      return workout;
    },
  };
}
export type StrengthPlansService = ReturnType<typeof strengthPlansService>;
