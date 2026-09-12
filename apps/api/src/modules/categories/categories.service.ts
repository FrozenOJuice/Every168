import type { TransactionContext } from "../../shared/transactions.js";
import type { CategoryInput } from "@168hours/contracts";
import { AppError, found } from "../../shared/errors/app-error.js";
import type { categoriesRepository } from "./categories.repository.js";
export function categoriesService(
  repo: ReturnType<typeof categoriesRepository>,
) {
  return {
    list: repo.list,
    async get(userId: string, id: string, context?: TransactionContext) {
      return found(await repo.get(userId, id, context));
    },
    async requireActive(
      userId: string,
      id: string,
      context?: TransactionContext,
    ) {
      const row = found(await repo.get(userId, id, context));
      if (row.archivedAt)
        throw new AppError(422, "BUSINESS_RULE", "Choose an active category.");
      return row;
    },
    create: repo.create,
    async update(
      userId: string,
      id: string,
      input: CategoryInput,
      version: number,
      context?: TransactionContext,
    ) {
      return found(await repo.update(userId, id, input, version, context));
    },
    async archive(
      userId: string,
      id: string,
      version: number,
      context?: TransactionContext,
    ) {
      return found(
        await repo.update(
          userId,
          id,
          { archivedAt: new Date() },
          version,
          context,
        ),
      );
    },
  };
}
export type CategoriesService = ReturnType<typeof categoriesService>;
