import { randomUUID } from "node:crypto";
import { and, eq, desc, sql, isNull, isNotNull } from "drizzle-orm";
import type { AdminUsersQuery, PageQuery } from "@168hours/contracts";
import type { Database } from "../../infrastructure/database/client.js";
import { databaseFor } from "../../infrastructure/database/transactions.js";
import {
  cursorCondition,
  pageResult,
} from "../../infrastructure/database/pagination.js";
import type { TransactionContext } from "../../shared/transactions.js";
import { user, account, session, adminAudit } from "./identity.table.js";
const fields = {
  id: user.id,
  name: user.name,
  email: user.email,
  accountType: user.accountType,
  suspendedAt: user.suspendedAt,
  lastActiveAt: user.lastActiveAt,
  createdAt: user.createdAt,
  version: user.version,
};
export function adminRepository(db: Database) {
  return {
    async actor(id: string, context?: TransactionContext) {
      const q = databaseFor(db, context)
        .select(fields)
        .from(user)
        .where(eq(user.id, id));
      return (await (context ? q.for("share") : q))[0];
    },
    async target(id: string, context: TransactionContext) {
      return (
        await databaseFor(db, context)
          .select(fields)
          .from(user)
          .where(eq(user.id, id))
          .for("update")
      )[0];
    },
    async users(q: AdminUsersQuery) {
      // Literal search, including %, _ and backslash. No journal columns are selected.
      const term = "%" + q.search.replace(/[\\%_]/g, "\\$&") + "%";
      const rows = await db
        .select(fields)
        .from(user)
        .where(
          and(
            q.search
              ? sql`(${user.name} ilike ${term} or ${user.email} ilike ${term} or ${user.id}::text = ${q.search.toLowerCase()})`
              : undefined,
            q.status === "active"
              ? isNull(user.suspendedAt)
              : q.status === "suspended"
                ? isNotNull(user.suspendedAt)
                : undefined,
            cursorCondition(q, user.createdAt, user.id),
          ),
        )
        .orderBy(desc(user.createdAt), desc(user.id))
        .limit(q.limit + 1);
      return pageResult(rows, q.limit);
    },
    async change(
      id: string,
      suspendedAt: Date | null,
      context: TransactionContext,
    ) {
      return (
        await databaseFor(db, context)
          .update(user)
          .set({ suspendedAt, version: sql`${user.version}+1` })
          .where(eq(user.id, id))
          .returning(fields)
      )[0]!;
    },
    async deleteAccount(id: string, context: TransactionContext) {
      await databaseFor(db, context).delete(user).where(eq(user.id, id));
    },
    async revoke(id: string, context: TransactionContext) {
      await databaseFor(db, context)
        .delete(session)
        .where(eq(session.userId, id));
    },
    async audit(
      actorId: string | null,
      targetId: string,
      action: typeof adminAudit.$inferInsert.action,
      context: TransactionContext,
    ) {
      await databaseFor(db, context)
        .insert(adminAudit)
        .values({ actorId, targetId, action });
    },
    async audits(q: PageQuery) {
      return pageResult(
        await db
          .select()
          .from(adminAudit)
          .where(cursorCondition(q, adminAudit.createdAt, adminAudit.id))
          .orderBy(desc(adminAudit.createdAt), desc(adminAudit.id))
          .limit(q.limit + 1),
        q.limit,
      );
    },
    async statistics() {
      return (
        await db
          .select({
            total: sql<number>`count(*)::integer`,
            admins: sql<number>`count(*) filter (where ${user.accountType}='admin')::integer`,
            suspended: sql<number>`count(*) filter (where ${user.suspendedAt} is not null)::integer`,
            new7Days: sql<number>`count(*) filter (where ${user.createdAt}>=now()-interval '7 days')::integer`,
            active7Days: sql<number>`count(*) filter (where ${user.lastActiveAt}>=now()-interval '7 days' and ${user.suspendedAt} is null)::integer`,
            active30Days: sql<number>`count(*) filter (where ${user.lastActiveAt}>=now()-interval '30 days' and ${user.suspendedAt} is null)::integer`,
          })
          .from(user)
      )[0]!;
    },
    async createAdministrator(
      input: { name: string; email: string },
      password: string,
      context: TransactionContext,
    ) {
      const tx = databaseFor(db, context);
      const id = randomUUID();
      await tx
        .insert(user)
        .values({ id, ...input, accountType: "admin", emailVerified: true });
      await tx.insert(account).values({
        userId: id,
        accountId: id,
        providerId: "credential",
        password,
      });
      await tx
        .insert(adminAudit)
        .values({ actorId: null, targetId: id, action: "admin_created" });
      return id;
    },
  };
}
