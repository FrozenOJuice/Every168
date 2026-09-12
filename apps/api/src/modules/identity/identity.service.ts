import { preferencesInput, type Preferences } from "@168hours/contracts";
import type { identityRepository } from "./identity.repository.js";
export function identityService(repo: ReturnType<typeof identityRepository>) {
  return {
    async getPreferences(userId: string) {
      return preferencesInput.strip().parse(await repo.getPreferences(userId));
    },
    async savePreferences(userId: string, input: Preferences) {
      return preferencesInput
        .strip()
        .parse(await repo.savePreferences(userId, input));
    },
  };
}
export type IdentityService = ReturnType<typeof identityService>;
