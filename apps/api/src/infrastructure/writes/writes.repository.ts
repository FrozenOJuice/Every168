import { and, eq, sql } from "drizzle-orm";
import type { Database } from "../database/client.js";
import { databaseFor } from "../database/transactions.js";
import type { TransactionContext } from "../../shared/transactions.js";
import { writeReceipts } from "./writes.table.js";

export function writesRepository(db: Database) {
  return {
    async lock(userId: string, key: string, context: TransactionContext) {
      // Hash collisions only serialize unrelated commands; ownership is checked separately.
      await databaseFor(db, context).execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${userId + ":" + key}, 0))`,
      );
    },
    async get(userId: string, key: string, context: TransactionContext) {
      return (
        await databaseFor(db, context)
          .select()
          .from(writeReceipts)
          .where(
            and(eq(writeReceipts.userId, userId), eq(writeReceipts.key, key)),
          )
      )[0];
    },
    async save(
      userId: string,
      key: string,
      fingerprint: string,
      response: unknown,
      context: TransactionContext,
    ) {
      await databaseFor(db, context)
        .insert(writeReceipts)
        .values({ userId, key, fingerprint, response });
    },
  };
}
