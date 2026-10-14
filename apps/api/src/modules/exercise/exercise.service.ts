import type { strengthPlansRepository } from "./strength-plans.repository.js";
import type { BlockSourceLink } from "../planning/planning.service.js";
import type { cardioRepository } from "./cardio.repository.js";
import type { TransactionContext } from "../../shared/transactions.js";
import type { ExerciseInput, StrengthProgressQuery } from "@168hours/contracts";
import { found } from "../../shared/errors/app-error.js";
import type { exerciseRepository } from "./exercise.repository.js";
import type { strengthRepository } from "./strength.repository.js";
export function exerciseService(
  repo: ReturnType<typeof exerciseRepository>,
  strength: ReturnType<typeof strengthRepository>,
  cardio: ReturnType<typeof cardioRepository>,
  plans: ReturnType<typeof strengthPlansRepository>,
) {
  return {
    async capturePlanLinks(u: string, id: string, context: TransactionContext) {
      return [
        ...(await strength.capturePlanLinks(u, id, context)),
        ...(await cardio.capturePlanLinks(u, id, context)),
        ...(await plans.capturePlanLinks(u, id, context)),
      ];
    },
    async restorePlanLinks(
      u: string,
      id: string,
      links: BlockSourceLink[],
      context: TransactionContext,
    ) {
      for (const link of links)
        await (
          link.kind === "strength"
            ? strength
            : link.kind === "strength-plan"
              ? plans
              : cardio
        ).restorePlanLink(u, id, link, context);
    },
    platformUsage: repo.platformUsage,
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
    async progress(u: string, id: string, q: StrengthProgressQuery) {
      const exercise = found(await repo.get(u, id));
      return { exercise, ...(await strength.progress(u, id, q)) };
    },
    async restore(
      u: string,
      id: string,
      version: number,
      context?: TransactionContext,
    ) {
      return found(
        await repo.update(u, id, { archivedAt: null }, version, context),
      );
    },
  };
}
export type ExerciseService = ReturnType<typeof exerciseService>;
