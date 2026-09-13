import type { TransactionContext } from "../../shared/transactions.js";
import { meSchema, type Preferences } from "@168hours/contracts";
import type { identityRepository } from "./identity.repository.js";
export function identityService(repo: ReturnType<typeof identityRepository>) {
  return {
    revokeSession: (userId: string, token: string) =>
      repo.revokeSession(userId, token),
    async getPreferences(userId: string, context?: TransactionContext) {
      return meSchema.shape.preferences
        .strip()
        .parse(await repo.getPreferences(userId, context));
    },
    async savePreferences(
      userId: string,
      input: Preferences,
      version: number,
      context?: TransactionContext,
    ) {
      return meSchema.shape.preferences
        .strip()
        .parse(await repo.savePreferences(userId, input, version, context));
    },
  };
}
export type IdentityService = ReturnType<typeof identityService>;
