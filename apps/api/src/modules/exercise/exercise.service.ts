import { exerciseCatalog } from "./exercise-catalog.js";
import type { strengthPlansRepository } from "./strength-plans.repository.js";
import type { BlockSourceLink } from "../planning/planning.service.js";
import type { cardioRepository } from "./cardio.repository.js";
import type { TransactionContext } from "../../shared/transactions.js";
import { exerciseInput } from "@168hours/contracts";
import type {
  ExerciseInput,
  StrengthProgressQuery,
  ExerciseDuplicateInput,
} from "@168hours/contracts";
import { assertRevision } from "../../shared/errors/revision.js";
import { AppError, found } from "../../shared/errors/app-error.js";
import type { exerciseRepository } from "./exercise.repository.js";
import type { strengthRepository } from "./strength.repository.js";
export function exerciseService(
  repo: ReturnType<typeof exerciseRepository>,
  strength: ReturnType<typeof strengthRepository>,
  cardio: ReturnType<typeof cardioRepository>,
  plans: ReturnType<typeof strengthPlansRepository>,
) {
  async function requireCustom(
    u: string,
    id: string,
    version: number,
    context: TransactionContext,
  ) {
    const row = await repo.lock(u, id, version, context);
    if (row.catalogKey)
      throw new AppError(
        403,
        "BUILT_IN_READ_ONLY",
        "Built-in exercises are read-only. Duplicate this exercise to customize it.",
      );
  }
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
    async catalog(u: string) {
      const rows = await repo.catalogEntries(u);
      return exerciseCatalog.map((definition) => ({
        ...definition,
        exercise: rows.find((row) => row.catalogKey === definition.key) ?? null,
      }));
    },
    async useCatalog(u: string, key: string, context: TransactionContext) {
      const definition = exerciseCatalog.find((entry) => entry.key === key);
      if (!definition)
        throw new AppError(
          422,
          "VALIDATION_ERROR",
          "Choose an exercise from the library.",
        );
      const existing = await repo.forCatalog(u, key, context);
      if (existing) return existing;
      return repo.createCatalog(
        u,
        {
          name: definition.name,
          notes: definition.notes,
          catalogKey: key,
          equipment: [definition.equipment],
          muscles: definition.muscles,
          loggingType: definition.loggingType,
        },
        context,
      );
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
      context: TransactionContext,
    ) {
      await requireCustom(u, id, version, context);
      const { favourite, ...definition } = v;
      const updated = found(
        await repo.update(u, id, definition, version, context),
      );
      return favourite === undefined
        ? updated
        : repo.preference(u, id, { favourite }, updated.version, context);
    },
    async favourite(
      u: string,
      id: string,
      favourite: boolean,
      version: number,
      context: TransactionContext,
    ) {
      return repo.preference(u, id, { favourite }, version, context);
    },
    async hidden(
      u: string,
      id: string,
      hidden: boolean,
      version: number,
      context: TransactionContext,
    ) {
      const row = await repo.lock(u, id, version, context);
      if (!row.catalogKey)
        throw new AppError(
          422,
          "CUSTOM_EXERCISE",
          "Archive custom exercises instead of hiding them.",
        );
      return repo.preference(u, id, { hidden }, version, context);
    },
    async archive(
      u: string,
      id: string,
      version: number,
      context: TransactionContext,
    ) {
      await requireCustom(u, id, version, context);
      return found(
        await repo.update(u, id, { archivedAt: new Date() }, version, context),
      );
    },
    async duplicate(
      u: string,
      input: ExerciseDuplicateInput,
      context: TransactionContext,
    ) {
      const source =
        "catalogKey" in input
          ? exerciseCatalog.find(
              (definition) => definition.key === input.catalogKey,
            )
          : assertRevision(
              await repo.get(u, input.exerciseId, context),
              input.version,
            );
      if (!source)
        throw new AppError(
          422,
          "VALIDATION_ERROR",
          "Choose an exercise from the library.",
        );
      return repo.create(
        u,
        exerciseInput.parse({
          name: source.name.slice(0, 153) + " (copy)",
          notes: source.notes,
          equipment:
            typeof source.equipment === "string"
              ? [source.equipment]
              : source.equipment,
          muscles: source.muscles,
          loggingType: source.loggingType,
          favourite: false,
        }),
        context,
      );
    },
    async remove(
      u: string,
      id: string,
      version: number,
      context: TransactionContext,
    ) {
      await requireCustom(u, id, version, context);
      await repo.remove(u, id, version, context);
      return { ok: true as const };
    },
    async progress(u: string, id: string, q: StrengthProgressQuery) {
      const exercise = found(await repo.get(u, id));
      return { exercise, ...(await strength.progress(u, id, q)) };
    },
    async restore(
      u: string,
      id: string,
      version: number,
      context: TransactionContext,
    ) {
      await requireCustom(u, id, version, context);
      return found(
        await repo.update(u, id, { archivedAt: null }, version, context),
      );
    },
  };
}
export type ExerciseService = ReturnType<typeof exerciseService>;
