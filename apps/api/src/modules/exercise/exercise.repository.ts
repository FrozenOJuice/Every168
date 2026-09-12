import { and, eq, desc, isNull, isNotNull, ilike } from "drizzle-orm";
import type { Db, Database } from "../../infrastructure/database/client.js";
import type { ExerciseInput, LibraryQuery } from "@168hours/contracts";
import { cursorCondition, pageResult } from "../../shared/http/pagination.js";
import { exercises } from "./exercise.table.js";
export function exerciseRepository(db: Database) {
  const owned = (u: string, id: string) =>
    and(eq(exercises.userId, u), eq(exercises.id, id));
  return {
    async list(u: string, q: LibraryQuery) {
      const rows = await db
        .select()
        .from(exercises)
        .where(
          and(
            eq(exercises.userId, u),
            q.archived === "true"
              ? isNotNull(exercises.archivedAt)
              : isNull(exercises.archivedAt),
            q.search ? ilike(exercises.name, "%" + q.search + "%") : undefined,
            cursorCondition(q, exercises.createdAt, exercises.id),
          ),
        )
        .orderBy(desc(exercises.createdAt), desc(exercises.id))
        .limit(q.limit + 1);
      return pageResult(rows, q.limit);
    },
    async get(u: string, id: string, tx: Db = db) {
      return (await tx.select().from(exercises).where(owned(u, id)))[0];
    },
    async create(u: string, v: ExerciseInput) {
      return (
        await db
          .insert(exercises)
          .values({ ...v, userId: u })
          .returning()
      )[0]!;
    },
    async update(
      u: string,
      id: string,
      v: Partial<ExerciseInput> & { archivedAt?: Date },
    ) {
      return (
        await db
          .update(exercises)
          .set({ ...v, updatedAt: new Date() })
          .where(owned(u, id))
          .returning()
      )[0];
    },
  };
}
