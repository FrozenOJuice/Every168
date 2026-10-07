import { strengthWorkouts, cardioActivities } from "./exercise.table.js";
import { count } from "drizzle-orm";
import { changed } from "../../shared/errors/revision.js";
import { and, eq, desc, isNull, isNotNull, ilike } from "drizzle-orm";
import type { Database } from "../../infrastructure/database/client.js";
import { databaseFor } from "../../infrastructure/database/transactions.js";
import type { TransactionContext } from "../../shared/transactions.js";
import type { ExerciseInput, LibraryQuery } from "@168hours/contracts";
import {
  cursorCondition,
  pageResult,
} from "../../infrastructure/database/pagination.js";
import { exercises } from "./exercise.table.js";
export function exerciseRepository(db: Database) {
  const owned = (u: string, id: string) =>
    and(eq(exercises.userId, u), eq(exercises.id, id));
  return {
    async platformUsage() {
      const strengthWorkoutsCount = (
        await db.select({ total: count() }).from(strengthWorkouts)
      )[0]!.total;
      const cardioActivitiesCount = (
        await db.select({ total: count() }).from(cardioActivities)
      )[0]!.total;
      return {
        strengthWorkouts: strengthWorkoutsCount,
        cardioActivities: cardioActivitiesCount,
      };
    },
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
            q.search
              ? ilike(
                  exercises.name,
                  "%" + q.search.replace(/[\\%_]/g, "\\$&") + "%",
                )
              : undefined,
            cursorCondition(q, exercises.createdAt, exercises.id),
          ),
        )
        .orderBy(desc(exercises.createdAt), desc(exercises.id))
        .limit(q.limit + 1);
      return pageResult(rows, q.limit);
    },
    async get(u: string, id: string, context?: TransactionContext) {
      const query = databaseFor(db, context)
        .select()
        .from(exercises)
        .where(owned(u, id));
      return (await (context ? query.for("share") : query))[0];
    },
    async create(u: string, v: ExerciseInput, context?: TransactionContext) {
      return (
        await databaseFor(db, context)
          .insert(exercises)
          .values({ ...v, userId: u })
          .returning()
      )[0]!;
    },
    async update(
      u: string,
      id: string,
      v: Partial<ExerciseInput> & { archivedAt?: Date | null },
      version: number,
      context?: TransactionContext,
    ) {
      const row = (
        await databaseFor(db, context)
          .update(exercises)
          .set({ ...v, updatedAt: new Date() })
          .where(and(owned(u, id), eq(exercises.version, version)))
          .returning()
      )[0];
      return changed(row, () => this.get(u, id, context));
    },
  };
}
