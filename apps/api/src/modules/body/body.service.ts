import type { WeightInput } from "@168hours/contracts";
import { found } from "../../shared/errors/app-error.js";
import type { bodyRepository } from "./body.repository.js";
export function bodyService(repo: ReturnType<typeof bodyRepository>) {
  return {
    list: repo.list,
    create: repo.create,
    latest: repo.latest,
    async get(u: string, id: string) {
      return found(await repo.get(u, id));
    },
    async update(u: string, id: string, v: WeightInput) {
      return found(await repo.update(u, id, v));
    },
    async remove(u: string, id: string) {
      found(await repo.remove(u, id));
      return { ok: true as const };
    },
  };
}
export type BodyService = ReturnType<typeof bodyService>;
