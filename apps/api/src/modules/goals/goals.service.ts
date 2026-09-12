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
    async get(u: string, id: string) {
      return found(await repo.get(u, id));
    },
    async create(u: string, v: GoalInput) {
      if (v.categoryId) await categories.get(u, v.categoryId);
      return repo.create(u, v, v.status === "completed" ? new Date() : null);
    },
    async update(u: string, id: string, v: GoalInput) {
      const existing = found(await repo.get(u, id));
      if (v.categoryId) await categories.get(u, v.categoryId);
      return found(
        await repo.update(
          u,
          id,
          v,
          v.status === "completed"
            ? (existing.completedAt ?? new Date())
            : null,
        ),
      );
    },
  };
}
export type GoalsService = ReturnType<typeof goalsService>;
