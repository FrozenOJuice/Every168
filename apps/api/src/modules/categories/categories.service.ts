import type { CategoryInput } from "@168hours/contracts";
import { AppError, found } from "../../shared/errors/app-error.js";
import type { categoriesRepository } from "./categories.repository.js";
export function categoriesService(
  repo: ReturnType<typeof categoriesRepository>,
) {
  return {
    list: repo.list,
    async get(userId: string, id: string) {
      return found(await repo.get(userId, id));
    },
    async requireActive(userId: string, id: string) {
      const row = found(await repo.get(userId, id));
      if (row.archivedAt)
        throw new AppError(422, "BUSINESS_RULE", "Choose an active category.");
      return row;
    },
    create: repo.create,
    async update(userId: string, id: string, input: CategoryInput) {
      return found(await repo.update(userId, id, input));
    },
    async archive(userId: string, id: string) {
      return found(await repo.update(userId, id, { archivedAt: new Date() }));
    },
  };
}
export type CategoriesService = ReturnType<typeof categoriesService>;
