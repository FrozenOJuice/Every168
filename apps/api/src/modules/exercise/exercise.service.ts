import type { TransactionContext } from "../../shared/transactions.js";
import type { ExerciseInput, PageQuery } from "@168hours/contracts";
import { found } from "../../shared/errors/app-error.js";
import type { exerciseRepository } from "./exercise.repository.js";
import type { strengthRepository } from "./strength.repository.js";
export function exerciseService(
  repo: ReturnType<typeof exerciseRepository>,
  strength: ReturnType<typeof strengthRepository>,
) {
  return {
    list: repo.list,
    create: repo.create,
    async get(u: string, id: string) {
      return found(await repo.get(u, id));
    },
    async update(
      u: string,
      id: string,
      v: ExerciseInput,
      version: number,
      context?: TransactionContext,
    ) {
      return found(await repo.update(u, id, v, version, context));
    },
    async archive(
      u: string,
      id: string,
      version: number,
      context?: TransactionContext,
    ) {
      return found(
        await repo.update(u, id, { archivedAt: new Date() }, version, context),
      );
    },
    async progress(u: string, id: string, q: PageQuery) {
      const exercise = found(await repo.get(u, id));
      return { exercise, ...(await strength.progress(u, id, q)) };
    },
  };
}
export type ExerciseService = ReturnType<typeof exerciseService>;
