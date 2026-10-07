import { authInput } from "@168hours/contracts";
import type { AdminUsersQuery, PageQuery } from "@168hours/contracts";
import type {
  TransactionContext,
  RunInTransaction,
} from "../../shared/transactions.js";
import { AppError } from "../../shared/errors/app-error.js";
import { assertRevision } from "../../shared/errors/revision.js";
import { hashPassword } from "../../shared/auth/password.js";
import type { adminRepository } from "./admin.repository.js";
export function adminService(
  repo: ReturnType<typeof adminRepository>,
  run: RunInTransaction,
  usage: () => Promise<{
    plannedBlocks: number;
    foodEntries: number;
    strengthWorkouts: number;
    cardioActivities: number;
    goals: number;
  }>,
  health: () => Promise<unknown>,
) {
  async function authorize(actorId: string, context?: TransactionContext) {
    const actor = await repo.actor(actorId, context);
    if (!actor || actor.accountType !== "admin" || actor.suspendedAt)
      throw new AppError(403, "FORBIDDEN", "Administrator access required.");
  }
  return {
    authorize,
    async users(actorId: string, query: AdminUsersQuery) {
      await authorize(actorId);
      return repo.users(query);
    },
    async audits(actorId: string, query: PageQuery) {
      await authorize(actorId);
      return repo.audits(query);
    },
    async statistics(actorId: string) {
      await authorize(actorId);
      const [users, counts] = await Promise.all([repo.statistics(), usage()]);
      return { asOf: new Date().toISOString(), users, usage: counts };
    },
    async health(actorId: string) {
      await authorize(actorId);
      return health();
    },
    async manage(
      actorId: string,
      targetId: string,
      action: "suspended" | "reactivated" | "sessions_revoked",
      version: number,
      context: TransactionContext,
    ) {
      await authorize(actorId, context);
      const target = assertRevision(
        await repo.target(targetId, context),
        version,
      );
      if (target.accountType === "admin")
        throw new AppError(
          403,
          "FORBIDDEN",
          "Admin accounts cannot be managed here.",
        );
      const suspendedAt =
        action === "suspended"
          ? new Date()
          : action === "reactivated"
            ? null
            : target.suspendedAt;
      const result = await repo.change(targetId, suspendedAt, context);
      if (action !== "reactivated") await repo.revoke(targetId, context);
      await repo.audit(actorId, targetId, action, context);
      return result;
    },
    async deleteAccount(
      actorId: string,
      targetId: string,
      confirmationEmail: string,
      version: number,
      context: TransactionContext,
    ) {
      await authorize(actorId, context);
      const target = assertRevision(
        await repo.target(targetId, context),
        version,
      );
      if (target.accountType === "admin")
        throw new AppError(
          403,
          "FORBIDDEN",
          "Admin accounts cannot be deleted here.",
        );
      if (confirmationEmail !== target.email)
        throw new AppError(
          422,
          "VALIDATION_ERROR",
          "Confirmation email does not match this account.",
        );
      await repo.deleteAccount(targetId, context);
      await repo.audit(actorId, targetId, "account_deleted", context);
      return { ok: true as const };
    },
    // Operator-only entry point: never mounted on HTTP, never converts an existing account.
    async createAdministrator(input: unknown) {
      const { password, ...profile } = authInput.parse(input);
      const hash = await hashPassword(password);
      return run((context) => repo.createAdministrator(profile, hash, context));
    },
  };
}
export type AdminService = ReturnType<typeof adminService>;
