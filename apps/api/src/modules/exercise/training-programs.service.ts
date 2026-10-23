import { randomUUID } from "node:crypto";
import { addDays, localDate, weekday } from "@168hours/domain-utils";
import {
  trainingProgramInput,
  type TrainingProgramInput,
  type TrainingProgramQuery,
  type ProgramScheduleInput,
  type PageQuery,
  type ProgramOccurrence,
} from "@168hours/contracts";
import { AppError, found } from "../../shared/errors/app-error.js";
import { assertRevision } from "../../shared/errors/revision.js";
import type { TransactionContext } from "../../shared/transactions.js";
import type { IdentityService } from "../identity/identity.service.js";
import type { PlanningService } from "../planning/planning.service.js";
import type { StrengthPlansService } from "./strength-plans.service.js";
import type { StrengthService } from "./strength.service.js";
import type { trainingProgramsRepository } from "./training-programs.repository.js";

type Details = NonNullable<
  Awaited<ReturnType<ReturnType<typeof trainingProgramsRepository>["get"]>>
>;
type StoredProgramStep = Details["program"]["steps"][number];
type Entry = NonNullable<Details["latest"]>;
function occurrence(row: Entry, latest = true) {
  const status: ProgramOccurrence["status"] = row.occurrence.skippedAt
    ? "skipped"
    : row.session?.endedAt
      ? "completed"
      : row.session
        ? "in_progress"
        : !latest
          ? "unrecorded"
          : row.plan?.timeBlockId
            ? "scheduled"
            : "ready";
  return { ...row.occurrence, session: row.session, status };
}
function nextTrainingDate(date: string, days: number[]) {
  if (!days.length) return date;
  for (let n = 0; n < 7; n++) {
    const candidate = addDays(date, n);
    if (days.includes(weekday(candidate))) return candidate;
  }
  return date;
}
export function trainingProgramsService(
  repo: ReturnType<typeof trainingProgramsRepository>,
  plans: StrengthPlansService,
  strength: StrengthService,
  planning: PlanningService,
  identity: IdentityService,
) {
  async function definition(u: string, id: string, ctx?: TransactionContext) {
    try {
      return await plans.get(u, id, ctx);
    } catch (error) {
      if (error instanceof AppError && error.status === 404) return null;
      throw error;
    }
  }
  async function snapshot(
    u: string,
    input: TrainingProgramInput,
    old: StoredProgramStep[],
    ctx: TransactionContext,
  ) {
    const v = trainingProgramInput.parse(input),
      seen = new Set<string>();
    const steps: StoredProgramStep[] = [];
    const definitions = new Map<
      string,
      Awaited<ReturnType<typeof plans.get>>
    >();
    // Lock shared definitions in a consistent order across programs.
    for (const id of [...new Set(v.steps.map((s) => s.workoutId))].sort())
      definitions.set(id, await plans.get(u, id, ctx));
    // Keep stable step identities across reorder/edit; a workout may intentionally occur twice.
    for (const step of v.steps) {
      if (step.id && !old.some((s) => s.id === step.id))
        throw new AppError(
          422,
          "VALIDATION_ERROR",
          "Choose a step belonging to this program.",
        );
      const id = step.id ?? randomUUID();
      if (seen.has(id))
        throw new AppError(
          422,
          "VALIDATION_ERROR",
          "Each program step must have a unique identifier.",
        );
      seen.add(id);
      const plan = definitions.get(step.workoutId)!;
      if (plan.kind !== "workout" || plan.isDraft)
        throw new AppError(
          422,
          "BUSINESS_RULE",
          "Programs require ready reusable workouts. Save the workout draft first.",
        );
      steps.push({ id, workoutId: plan.id, title: plan.title });
    }
    return { ...v, steps };
  }
  async function view(u: string, data: Details, ctx?: TransactionContext) {
    const { program, latest, counts } = data;
    const { timezone } = await identity.getPreferences(u, ctx);
    const today = localDate(new Date(), timezone);
    const definitions = new Map<
      string,
      Awaited<ReturnType<typeof definition>>
    >();
    for (const id of [...new Set(program.steps.map((s) => s.workoutId))].sort())
      definitions.set(id, await definition(u, id, ctx));
    const steps = program.steps.map((s) => {
      const p = definitions.get(s.workoutId);
      return {
        ...s,
        title: p?.title ?? s.title,
        available: !!p && p.kind === "workout" && !p.isDraft,
      };
    });
    const pending =
      latest && !latest.occurrence.skippedAt && !latest.session?.endedAt;
    let sequence = 0,
      position = 0,
      cycle = 1;
    let date = program.trainingDays.length
      ? program.startDate
      : [program.startDate, today].sort().at(-1)!;
    if (latest) {
      const item = latest.occurrence;
      if (pending) {
        sequence = item.sequence;
        position = item.position;
        cycle = item.cycle;
        date = item.plannedDate ?? date;
      } else {
        sequence = item.sequence + 1;
        const previousPosition = steps.findIndex((s) => s.id === item.stepId);
        const candidate =
          previousPosition >= 0 ? previousPosition + 1 : item.position;
        position = candidate >= steps.length ? 0 : candidate;
        cycle = item.cycle + (candidate >= steps.length ? 1 : 0);
        const completedDate = localDate(
          item.skippedAt ?? latest.session!.endedAt!,
          timezone,
        );
        date = program.trainingDays.length
          ? addDays(
              [
                item.plannedDate ?? completedDate,
                completedDate,
                program.startDate,
              ]
                .sort()
                .at(-1)!,
              1,
            )
          : [program.startDate, today].sort().at(-1)!;
      }
    }
    const step = pending
      ? steps.find((s) => s.id === latest.occurrence.stepId)
      : steps[position]!;
    const plan = pending ? latest.plan : null;
    const block = plan?.timeBlockId
      ? await planning.getBlock(u, plan.timeBlockId, ctx)
      : null;
    return {
      ...program,
      ...counts,
      steps,
      next: {
        sequence,
        position,
        cycle,
        stepId: pending ? latest.occurrence.stepId : step!.id,
        workoutId: step?.workoutId ?? null,
        title: pending ? latest.occurrence.workoutTitleSnapshot : step!.title,
        available: !!plan || !!step?.available,
        suggestedDate: block
          ? localDate(block.startsAt, timezone)
          : pending
            ? date
            : nextTrainingDate(date, program.trainingDays),
        occurrence: pending ? occurrence(latest) : null,
        plan,
        block,
      },
    };
  }
  async function get(u: string, id: string, ctx?: TransactionContext) {
    return view(u, found(await repo.get(u, id, ctx)), ctx);
  }
  async function current(
    u: string,
    id: string,
    sequence: number,
    version: number,
    ctx: TransactionContext,
  ) {
    const data = found(await repo.get(u, id, ctx));
    assertRevision(data.program, version);
    if (data.program.paused)
      throw new AppError(
        422,
        "BUSINESS_RULE",
        "Resume this program before starting, scheduling or skipping a workout.",
      );
    const program = await view(u, data, ctx);
    if (program.next.sequence !== sequence)
      throw new AppError(
        409,
        "STALE_REVISION",
        "Program progress changed. Reload before continuing.",
      );
    if (sequence > 1000000)
      throw new AppError(
        422,
        "BUSINESS_RULE",
        "Create a new program to continue training.",
      );
    return program;
  }
  async function ensureOccurrence(
    u: string,
    program: Awaited<ReturnType<typeof get>>,
    ctx: TransactionContext,
  ) {
    if (program.next.occurrence) return program.next.occurrence;
    if (!program.next.available || !program.next.workoutId)
      throw new AppError(
        422,
        "BUSINESS_RULE",
        "This workout is unavailable. Edit the program and choose a ready workout.",
      );
    const plan = await plans.instance(u, program.next.workoutId, ctx);
    return repo.createOccurrence(
      u,
      {
        programId: program.id,
        sequence: program.next.sequence,
        position: program.next.position,
        cycle: program.next.cycle,
        stepId: program.next.stepId,
        workoutTitleSnapshot: plan.title,
        plannedDate: program.next.suggestedDate,
        planId: plan.id,
      },
      ctx,
    );
  }
  return {
    get,
    async list(u: string, q: TrainingProgramQuery) {
      const page = await repo.list(u, q);
      return {
        ...page,
        items: await Promise.all(page.items.map((p) => get(u, p.id))),
      };
    },
    async create(
      u: string,
      input: TrainingProgramInput,
      ctx: TransactionContext,
    ) {
      const row = await repo.create(u, await snapshot(u, input, [], ctx), ctx);
      return get(u, row.id, ctx);
    },
    async update(
      u: string,
      id: string,
      input: TrainingProgramInput,
      version: number,
      ctx: TransactionContext,
    ) {
      const old = found(await repo.get(u, id, ctx));
      assertRevision(old.program, version);
      await repo.update(
        u,
        id,
        await snapshot(u, input, old.program.steps, ctx),
        ctx,
      );
      return get(u, id, ctx);
    },
    async pause(
      u: string,
      id: string,
      paused: boolean,
      version: number,
      ctx: TransactionContext,
    ) {
      assertRevision(found(await repo.get(u, id, ctx)).program, version);
      await repo.update(u, id, { paused }, ctx);
      return get(u, id, ctx);
    },
    async remove(
      u: string,
      id: string,
      version: number,
      ctx: TransactionContext,
    ) {
      assertRevision(found(await repo.get(u, id, ctx)).program, version);
      await repo.remove(u, id, ctx);
      return { ok: true as const };
    },
    async begin(
      u: string,
      id: string,
      input: { sequence: number; startedAt: string },
      version: number,
      ctx: TransactionContext,
    ) {
      const program = await current(u, id, input.sequence, version, ctx);
      const item = await ensureOccurrence(u, program, ctx);
      const plan = await plans.get(u, found(item.planId ?? undefined), ctx);
      const workout = await plans.begin(
        u,
        plan.id,
        input.startedAt,
        plan.version,
        ctx,
      );
      await repo.update(u, id, {}, ctx);
      return workout;
    },
    async schedule(
      u: string,
      id: string,
      input: ProgramScheduleInput,
      version: number,
      ctx: TransactionContext,
    ) {
      const program = await current(u, id, input.sequence, version, ctx);
      const item = await ensureOccurrence(u, program, ctx);
      await plans.scheduleInstance(
        u,
        found(item.planId ?? undefined),
        { startsAt: input.startsAt, endsAt: input.endsAt },
        input.blockVersion,
        ctx,
      );
      const { timezone } = await identity.getPreferences(u, ctx);
      await repo.updateOccurrence(
        u,
        item.id,
        { plannedDate: localDate(input.startsAt, timezone) },
        ctx,
      );
      await repo.update(u, id, {}, ctx);
      return get(u, id, ctx);
    },
    async skip(
      u: string,
      id: string,
      input: { sequence: number; blockVersion: number | null },
      version: number,
      ctx: TransactionContext,
    ) {
      const program = await current(u, id, input.sequence, version, ctx);
      const existing = program.next.occurrence;
      if (existing?.session)
        throw new AppError(
          422,
          "BUSINESS_RULE",
          "Finish or discard the in-progress workout before skipping this step.",
        );
      if (existing) {
        await repo.updateOccurrence(
          u,
          existing.id,
          { skippedAt: new Date() },
          ctx,
        );
        if (existing.planId)
          await plans.cancelInstance(
            u,
            existing.planId,
            input.blockVersion,
            ctx,
          );
      } else {
        if (input.blockVersion !== null)
          throw new AppError(
            409,
            "STALE_REVISION",
            "Program schedule changed. Reload before skipping.",
          );
        await repo.createOccurrence(
          u,
          {
            programId: id,
            sequence: program.next.sequence,
            position: program.next.position,
            cycle: program.next.cycle,
            stepId: program.next.stepId,
            workoutTitleSnapshot: program.next.title,
            plannedDate: program.next.suggestedDate,
            skippedAt: new Date(),
          },
          ctx,
        );
      }
      await repo.update(u, id, {}, ctx);
      return get(u, id, ctx);
    },
    async history(u: string, id: string, q: PageQuery) {
      const data = found(await repo.get(u, id));
      const page = await repo.history(u, id, q);
      return {
        ...page,
        items: page.items.map((row) =>
          occurrence(row, row.occurrence.id === data.latest?.occurrence.id),
        ),
      };
    },
    async forSession(u: string, id: string) {
      await strength.get(u, id);
      return repo.linkForSession(u, id);
    },
  };
}
export type TrainingProgramsService = ReturnType<
  typeof trainingProgramsService
>;
