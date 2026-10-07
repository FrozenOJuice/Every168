import { changed } from "../../shared/errors/revision.js";
import { databaseFor } from "../../infrastructure/database/transactions.js";
import type { TransactionContext } from "../../shared/transactions.js";
import { and, eq, sql } from "drizzle-orm";
import type { Database } from "../../infrastructure/database/client.js";
import { preferences, session, user } from "./identity.table.js";
import type { Preferences } from "@168hours/contracts";
export function identityRepository(db: Database) {
  return {
    async isSuspendedEmail(email: string) {
      return Boolean(
        (
          await db
            .select({ suspendedAt: user.suspendedAt })
            .from(user)
            .where(eq(user.email, email))
        )[0]?.suspendedAt,
      );
    },
    async getAccess(userId: string, context?: TransactionContext) {
      const q = databaseFor(db, context)
        .select({
          accountType: user.accountType,
          suspendedAt: user.suspendedAt,
        })
        .from(user)
        .where(eq(user.id, userId));
      return (await (context ? q.for("share") : q))[0];
    },
    async touchActivity(userId: string) {
      await db
        .update(user)
        .set({ lastActiveAt: new Date() })
        .where(
          and(
            eq(user.id, userId),
            sql`(${user.lastActiveAt} is null or ${user.lastActiveAt}<now()-interval '1 hour')`,
          ),
        );
    },
    async revokeSession(userId: string, token: string) {
      await db
        .delete(session)
        .where(and(eq(session.userId, userId), eq(session.token, token)));
    },
    async getPreferences(userId: string, context?: TransactionContext) {
      const tx = databaseFor(db, context);
      await tx.insert(preferences).values({ userId }).onConflictDoNothing();
      const q = tx
        .select()
        .from(preferences)
        .where(eq(preferences.userId, userId));
      return (await (context ? q.for("share") : q))[0]!;
    },
    async savePreferences(
      userId: string,
      input: Preferences,
      version: number,
      context?: TransactionContext,
    ) {
      const tx = databaseFor(db, context);
      const row = (
        await tx
          .update(preferences)
          .set(input)
          .where(
            and(
              eq(preferences.userId, userId),
              eq(preferences.version, version),
            ),
          )
          .returning()
      )[0];
      return changed(
        row,
        async () =>
          (
            await tx
              .select()
              .from(preferences)
              .where(eq(preferences.userId, userId))
          )[0],
      );
    },
  };
}
