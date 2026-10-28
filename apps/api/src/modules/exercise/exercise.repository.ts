import {
  count,
  getTableColumns,
  sql,
  and,
  eq,
  desc,
  asc,
  isNull,
  isNotNull,
  ilike,
  or,
} from "drizzle-orm";
import { z } from "zod";
import { changed, assertRevision } from "../../shared/errors/revision.js";
import { AppError } from "../../shared/errors/app-error.js";
import type { Database } from "../../infrastructure/database/client.js";
import { databaseFor } from "../../infrastructure/database/transactions.js";
import type { TransactionContext } from "../../shared/transactions.js";
import type {
  ExerciseInput,
  ExerciseLibraryQuery,
  ExerciseLoggingType,
} from "@168hours/contracts";
import {
  cursorCondition,
  pageResult,
} from "../../infrastructure/database/pagination.js";
import { exerciseCatalog } from "./exercise-catalog.js";
import {
  exercises,
  exercisePreferences,
  strengthWorkouts,
  cardioActivities,
  workoutExercises,
  strengthPlans,
} from "./exercise.table.js";
const nameCursorSchema = z
  .object({
    sort: z.enum(["name_asc", "name_desc"]),
    name: z.string().min(1).max(160),
    id: z.uuid(),
  })
  .strict();
export function exerciseRepository(db: Database) {
  const owned = (u: string, id: string) =>
    and(eq(exercises.userId, u), eq(exercises.id, id));
  // Catalogue keys identify immutable shared definitions. Private rows provide owner-scoped workout identities.
  const scalar = (field: "name" | "notes") =>
    sql<string | null>`case ${exercises.catalogKey} ${sql.join(
      exerciseCatalog.map(
        (definition) => sql`when ${definition.key} then ${definition[field]}`,
      ),
      sql` `,
    )} else ${exercises[field]} end`;
  const metadata = (field: "equipment" | "muscles") =>
    sql<string[]>`case ${exercises.catalogKey} ${sql.join(
      exerciseCatalog.map((definition) => {
        const values =
          field === "equipment" ? [definition.equipment] : definition.muscles;
        return sql`when ${definition.key} then ARRAY[${sql.join(
          values.map((value) => sql`${value}`),
          sql`, `,
        )}]::text[]`;
      }),
      sql` `,
    )} else ${exercises[field]} end`;
  const loggingType = sql<ExerciseLoggingType>`case ${exercises.catalogKey} ${sql.join(
    exerciseCatalog.map(
      (definition) =>
        sql`when ${definition.key} then ${definition.loggingType}`,
    ),
    sql` `,
  )} else ${exercises.loggingType} end`;
  const name = scalar("name").mapWith(String);
  const notes = scalar("notes");
  const equipment = metadata("equipment"),
    muscles = metadata("muscles");
  // Nest correlated expressions so Drizzle retains outer table qualification in single-table selections.
  const favourite = sql<boolean>`${sql`coalesce((select ${exercisePreferences.favourite} from ${exercisePreferences} where ${exercisePreferences.userId}=${exercises.userId} and ${exercisePreferences.exerciseId}=${exercises.id}), false)`}`;
  const hidden = sql<boolean>`${sql`coalesce((select ${exercisePreferences.hidden} from ${exercisePreferences} where ${exercisePreferences.userId}=${exercises.userId} and ${exercisePreferences.exerciseId}=${exercises.id}), false)`}`;
  const used = sql<boolean>`exists(select 1 from ${workoutExercises} where ${workoutExercises.userId}=${exercises.userId} and ${workoutExercises.exerciseId}=${exercises.id}) or exists(select 1 from ${strengthPlans}, jsonb_array_elements(${strengthPlans.exercises}) entry where ${strengthPlans.userId}=${exercises.userId} and entry->>'exerciseId'=${exercises.id}::text) or exists(select 1 from ${strengthWorkouts}, jsonb_array_elements(${strengthWorkouts.startingSetup}->'exercises') entry where ${strengthWorkouts.userId}=${exercises.userId} and entry->>'exerciseId'=${exercises.id}::text)`;
  const columns = {
    ...getTableColumns(exercises),
    name,
    notes,
    equipment,
    muscles,
    loggingType,
    favourite,
    hidden,
    source: sql<
      "system" | "custom"
    >`case when ${exercises.catalogKey} is null then 'custom' else 'system' end`,
    archivedAt:
      sql<Date | null>`case when ${exercises.catalogKey} is null then ${exercises.archivedAt} else null end`.mapWith(
        exercises.archivedAt,
      ),
    canDelete: sql<boolean>`${exercises.catalogKey} is null and not (${used})`,
  };
  async function get(u: string, id: string, context?: TransactionContext) {
    const query = databaseFor(db, context)
      .select(columns)
      .from(exercises)
      .where(owned(u, id));
    return (await (context ? query.for("share") : query))[0];
  }
  async function lock(
    u: string,
    id: string,
    version: number,
    context: TransactionContext,
  ) {
    const row = (
      await databaseFor(db, context)
        .select({
          id: exercises.id,
          version: exercises.version,
          catalogKey: exercises.catalogKey,
        })
        .from(exercises)
        .where(owned(u, id))
        .for("update")
    )[0];
    return assertRevision(row, version);
  }
  return {
    async createCatalog(
      u: string,
      v: Omit<ExerciseInput, "favourite"> & { catalogKey: string },
      context: TransactionContext,
    ) {
      const tx = databaseFor(db, context);
      const definition = v;
      const created = (
        await tx
          .insert(exercises)
          .values({ ...definition, userId: u })
          .onConflictDoNothing({
            target: [exercises.userId, exercises.catalogKey],
          })
          .returning({ id: exercises.id })
      )[0];
      const id =
        created?.id ??
        (
          await tx
            .select({ id: exercises.id })
            .from(exercises)
            .where(
              and(
                eq(exercises.userId, u),
                eq(exercises.catalogKey, v.catalogKey),
              ),
            )
        )[0]!.id;
      return (await get(u, id, context))!;
    },
    catalogEntries: (u: string) =>
      db
        .select(columns)
        .from(exercises)
        .where(and(eq(exercises.userId, u), isNotNull(exercises.catalogKey))),
    async forCatalog(u: string, key: string, context: TransactionContext) {
      return (
        await databaseFor(db, context)
          .select(columns)
          .from(exercises)
          .where(and(eq(exercises.userId, u), eq(exercises.catalogKey, key)))
          .for("share")
      )[0];
    },
    async platformUsage() {
      return {
        strengthWorkouts: (
          await db.select({ total: count() }).from(strengthWorkouts)
        )[0]!.total,
        cardioActivities: (
          await db.select({ total: count() }).from(cardioActivities)
        )[0]!.total,
      };
    },
    async list(u: string, q: ExerciseLibraryQuery) {
      const sort = q.sort ?? "recent";
      const nameKey = sql`lower(${name}) collate "C"`;
      let boundary;
      if (sort === "recent")
        boundary = cursorCondition(q, exercises.createdAt, exercises.id);
      else if (q.cursor) {
        try {
          const cursor = nameCursorSchema.parse(
            JSON.parse(Buffer.from(q.cursor, "base64url").toString()),
          );
          if (cursor.sort !== sort) throw new Error("Cursor sort mismatch");
          boundary =
            sort === "name_asc"
              ? sql`(${nameKey}, ${exercises.id}) > (lower(${cursor.name}) collate "C", ${cursor.id}::uuid)`
              : sql`(${nameKey}, ${exercises.id}) < (lower(${cursor.name}) collate "C", ${cursor.id}::uuid)`;
        } catch {
          throw new AppError(
            422,
            "VALIDATION_ERROR",
            "Invalid exercise cursor.",
          );
        }
      }
      const inactive = or(
        and(isNull(exercises.catalogKey), isNotNull(exercises.archivedAt)),
        and(isNotNull(exercises.catalogKey), hidden),
      );
      const rows = await db
        .select(columns)
        .from(exercises)
        .where(
          and(
            eq(exercises.userId, u),
            q.archived === "true" ? inactive : sql`not (${inactive})`,
            q.equipment?.length
              ? sql`${equipment} && ARRAY[${sql.join(
                  q.equipment.map((value) => sql`${value}`),
                  sql`, `,
                )}]::text[]`
              : undefined,
            q.muscle?.length
              ? sql`${muscles} && ARRAY[${sql.join(
                  q.muscle.map((value) => sql`${value}`),
                  sql`, `,
                )}]::text[]`
              : undefined,
            q.favourites === "true" ? favourite : undefined,
            q.search
              ? ilike(name, "%" + q.search.replace(/[\\%_]/g, "\\$&") + "%")
              : undefined,
            boundary,
          ),
        )
        .orderBy(
          ...(sort === "recent"
            ? [desc(exercises.createdAt), desc(exercises.id)]
            : sort === "name_asc"
              ? [asc(nameKey), asc(exercises.id)]
              : [desc(nameKey), desc(exercises.id)]),
        )
        .limit(q.limit + 1);
      if (sort === "recent") return pageResult(rows, q.limit);
      const items = rows.slice(0, q.limit);
      const last = items.at(-1);
      return {
        items,
        nextCursor:
          rows.length > q.limit && last
            ? Buffer.from(
                JSON.stringify({ sort, name: last.name, id: last.id }),
              ).toString("base64url")
            : null,
      };
    },
    get,
    lock,
    async create(u: string, v: ExerciseInput, context?: TransactionContext) {
      const tx = databaseFor(db, context);
      const { favourite: initialFavourite, ...definition } = v;
      const row = (
        await tx
          .insert(exercises)
          .values({ ...definition, userId: u })
          .returning({ id: exercises.id })
      )[0]!;
      if (initialFavourite !== undefined)
        await tx.insert(exercisePreferences).values({
          userId: u,
          exerciseId: row.id,
          favourite: initialFavourite,
        });
      return (await get(u, row.id, context))!;
    },
    async update(
      u: string,
      id: string,
      v: Partial<Omit<ExerciseInput, "favourite">> & {
        archivedAt?: Date | null;
      },
      version: number,
      context?: TransactionContext,
    ) {
      const row = (
        await databaseFor(db, context)
          .update(exercises)
          .set({ ...v, updatedAt: new Date() })
          .where(and(owned(u, id), eq(exercises.version, version)))
          .returning({ id: exercises.id })
      )[0];
      await changed(row, () => get(u, id, context));
      return (await get(u, id, context))!;
    },
    async preference(
      u: string,
      id: string,
      values: { favourite?: boolean; hidden?: boolean },
      version: number,
      context: TransactionContext,
    ) {
      await lock(u, id, version, context);
      const tx = databaseFor(db, context);
      await tx
        .update(exercises)
        .set({ updatedAt: new Date() })
        .where(owned(u, id));
      await tx
        .insert(exercisePreferences)
        .values({ userId: u, exerciseId: id, ...values })
        .onConflictDoUpdate({
          target: [exercisePreferences.userId, exercisePreferences.exerciseId],
          set: { ...values, updatedAt: new Date() },
        });
      return (await get(u, id, context))!;
    },
    async remove(
      u: string,
      id: string,
      version: number,
      context: TransactionContext,
    ) {
      const row = await lock(u, id, version, context);
      if (row.catalogKey)
        throw new AppError(
          403,
          "BUILT_IN_READ_ONLY",
          "Built-in exercises cannot be deleted. Hide this exercise instead.",
        );
      if (!(await get(u, id, context))!.canDelete)
        throw new AppError(
          422,
          "EXERCISE_IN_USE",
          "This exercise is used in a workout or its history. Archive it instead.",
        );
      await databaseFor(db, context).delete(exercises).where(owned(u, id));
    },
  };
}
