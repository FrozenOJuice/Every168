import type { TransactionContext } from "../../shared/transactions.js";
import type { GoalInput } from "@168hours/contracts";
import { found } from "../../shared/errors/app-error.js";
import type { CategoriesService } from "../categories/categories.service.js";
import type { goalsRepository } from "./goals.repository.js";
export function goalsService(
  repo: ReturnType<typeof goalsRepository>,
  categories: CategoriesService,
) {
  return {
    list: repo.list,
    async get(u: string, id: string, context?: TransactionContext) {
      return found(await repo.get(u, id, context));
    },
    async create(u: string, v: GoalInput, context?: TransactionContext) {
      if (v.categoryId) await categories.get(u, v.categoryId, context);
      return repo.create(
        u,
        v,
        v.status === "completed" ? new Date() : null,
        context,
      );
    },
    async update(
      u: string,
      id: string,
      v: GoalInput,
      version: number,
      context?: TransactionContext,
    ) {
      const existing = found(await repo.get(u, id, context));
      if (v.categoryId) await categories.get(u, v.categoryId, context);
      return found(
        await repo.update(
          u,
          id,
          v,
          v.status === "completed"
            ? (existing.completedAt ?? new Date())
            : null,
          version,
          context,
        ),
      );
    },
  };
}
export type GoalsService = ReturnType<typeof goalsService>;
