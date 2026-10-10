import {
  routineInput,
  routineProgressInput,
  type RoutineInput,
  type RoutineProgressInput,
} from "@168hours/contracts";
import { AppError, found } from "../../shared/errors/app-error.js";
import { assertRevision } from "../../shared/errors/revision.js";
import type { routinesRepository } from "./routines.repository.js";
import type { TransactionContext } from "../../shared/transactions.js";

export function routinesService(repo: ReturnType<typeof routinesRepository>) {
  return {
    list: (u: string) => repo.list(u),
    get: (u: string, id: string) => repo.get(u, id).then(found),
    create: (u: string, v: RoutineInput, ctx?: TransactionContext) =>
      repo.create(u, routineInput.parse(v), ctx),
    update: (
      u: string,
      id: string,
      v: RoutineInput,
      version: number,
      ctx?: TransactionContext,
    ) => repo.update(u, id, routineInput.parse(v), version, ctx),
    async progress(
      u: string,
      id: string,
      v: RoutineProgressInput,
      version: number,
      ctx?: TransactionContext,
    ) {
      const routine = found(await repo.get(u, id, ctx));
      assertRevision(routine, version);
      const checked = routineProgressInput.parse(v).checked;
      if (
        new Set(checked).size !== checked.length ||
        checked.some((index) => index >= routine.steps.length)
      )
        throw new AppError(
          422,
          "ROUTINE_STEPS",
          "Choose steps from this routine only.",
        );
      return repo.progress(u, id, checked, version, ctx);
    },
    async complete(
      u: string,
      id: string,
      version: number,
      ctx?: TransactionContext,
    ) {
      const routine = found(await repo.get(u, id, ctx));
      assertRevision(routine, version);
      if (routine.checked.length !== routine.steps.length)
        throw new AppError(
          422,
          "ROUTINE_INCOMPLETE",
          "Check every step before completing the routine.",
        );
      return repo.complete(u, id, version, ctx);
    },
    remove: (
      u: string,
      id: string,
      version: number,
      ctx?: TransactionContext,
    ) => repo.remove(u, id, version, ctx).then(() => ({ ok: true as const })),
  };
}
export type RoutinesService = ReturnType<typeof routinesService>;
