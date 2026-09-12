import { eq } from "drizzle-orm";
import type { Database } from "../../infrastructure/database/client.js";
import { preferences } from "./identity.table.js";
import type { Preferences } from "@168hours/contracts";
export function identityRepository(db: Database) {
  return {
    async getPreferences(userId: string) {
      await db.insert(preferences).values({ userId }).onConflictDoNothing();
      return (
        await db
          .select()
          .from(preferences)
          .where(eq(preferences.userId, userId))
      )[0]!;
    },
    async savePreferences(userId: string, input: Preferences) {
      return (
        await db
          .insert(preferences)
          .values({ userId, ...input })
          .onConflictDoUpdate({
            target: preferences.userId,
            set: { ...input, updatedAt: new Date() },
          })
          .returning()
      )[0]!;
    },
  };
}
