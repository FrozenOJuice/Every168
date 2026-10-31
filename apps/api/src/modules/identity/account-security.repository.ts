import { and, eq, gt, like } from "drizzle-orm";
import type { Database } from "../../infrastructure/database/client.js";
import { databaseFor } from "../../infrastructure/database/transactions.js";
import type { TransactionContext } from "../../shared/transactions.js";
import { AppError } from "../../shared/errors/app-error.js";
import { account, session, user, verification } from "./identity.table.js";
export type AccountTokenKind = "verify" | "reset";
const prefix = (kind: AccountTokenKind) => `account-security:${kind}:`;
const invalid = () =>
  new AppError(
    422,
    "INVALID_TOKEN",
    "This link is invalid or has expired. Request a new email.",
  );
export function accountSecurityRepository(db: Database) {
  return {
    async issue(
      email: string,
      kind: AccountTokenKind,
      digest: string,
      expiresAt: Date,
      context: TransactionContext,
    ) {
      const tx = databaseFor(db, context);
      const [owner] = await tx
        .select()
        .from(user)
        .where(eq(user.email, email))
        .for("update");
      if (
        !owner ||
        owner.suspendedAt ||
        (kind === "verify" && owner.emailVerified)
      )
        return null;
      const [recent] = await tx
        .select({ id: verification.id })
        .from(verification)
        .where(
          and(
            eq(verification.value, owner.id),
            like(verification.identifier, prefix(kind) + "%"),
            gt(verification.createdAt, new Date(Date.now() - 60000)),
          ),
        );
      if (recent) return null;
      await tx
        .delete(verification)
        .where(
          and(
            eq(verification.value, owner.id),
            like(verification.identifier, prefix(kind) + "%"),
          ),
        );
      await tx.insert(verification).values({
        identifier: prefix(kind) + digest,
        value: owner.id,
        expiresAt,
      });
      return { email: owner.email };
    },
    async consume(
      kind: AccountTokenKind,
      digest: string,
      nextHash: string | undefined,
      context: TransactionContext,
    ) {
      const tx = databaseFor(db, context);
      const identifier = prefix(kind) + digest;
      const [candidate] = await tx
        .select()
        .from(verification)
        .where(eq(verification.identifier, identifier));
      if (!candidate) throw invalid();
      // Always lock user before tokens/credentials, matching issuance and credential changes.
      const [owner] = await tx
        .select()
        .from(user)
        .where(eq(user.id, candidate.value))
        .for("update");
      if (!owner || owner.suspendedAt) throw invalid();
      const [token] = await tx
        .select()
        .from(verification)
        .where(
          and(
            eq(verification.id, candidate.id),
            gt(verification.expiresAt, new Date()),
          ),
        )
        .for("update");
      if (!token) throw invalid();
      if (kind === "reset") {
        const updated = await tx
          .update(account)
          .set({ password: nextHash!, updatedAt: new Date() })
          .where(
            and(
              eq(account.userId, owner.id),
              eq(account.providerId, "credential"),
            ),
          )
          .returning({ id: account.id });
        if (updated.length !== 1) throw invalid();
        await tx.delete(session).where(eq(session.userId, owner.id));
      }
      // Both links establish mailbox control. Reset also invalidates all outstanding links.
      await tx
        .update(user)
        .set({ emailVerified: true, updatedAt: new Date() })
        .where(eq(user.id, owner.id));
      await tx
        .delete(verification)
        .where(
          and(
            eq(verification.value, owner.id),
            like(
              verification.identifier,
              kind === "reset" ? "account-security:%" : prefix(kind) + "%",
            ),
          ),
        );
    },
    async credential(userId: string) {
      const [row] = await db
        .select({ password: account.password })
        .from(account)
        .innerJoin(user, eq(user.id, account.userId))
        .where(and(eq(user.id, userId), eq(account.providerId, "credential")));
      return row?.password;
    },
    async change(
      userId: string,
      previous: string,
      next: string,
      context: TransactionContext,
      requireVerifiedEmail = true,
    ) {
      const tx = databaseFor(db, context);
      const [owner] = await tx
        .select()
        .from(user)
        .where(eq(user.id, userId))
        .for("update");
      if (
        !owner ||
        owner.suspendedAt ||
        (requireVerifiedEmail && !owner.emailVerified)
      )
        throw new AppError(401, "UNAUTHORIZED", "Please sign in to continue.");
      const updated = await tx
        .update(account)
        .set({ password: next, updatedAt: new Date() })
        .where(
          and(
            eq(account.userId, userId),
            eq(account.providerId, "credential"),
            eq(account.password, previous),
          ),
        )
        .returning({ id: account.id });
      if (updated.length !== 1)
        throw new AppError(
          409,
          "CREDENTIAL_CHANGED",
          "Your password changed elsewhere. Sign in again.",
        );
      await tx.delete(session).where(eq(session.userId, userId));
      await tx
        .delete(verification)
        .where(
          and(
            eq(verification.value, userId),
            like(verification.identifier, "account-security:%"),
          ),
        );
    },
  };
}
