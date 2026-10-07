import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { compose } from "../src/composition.js";
import { user } from "../src/modules/identity/identity.table.js";

/** Operator fixture used only by Playwright against its isolated database. */
export async function adminBrowserFixture() {
  const url =
    process.env.TEST_DATABASE_URL ??
    "postgresql://hours:hours_test_only@localhost:54321/hours_test";
  if (
    !new URL(url).pathname.endsWith("_test") ||
    url === process.env.DATABASE_URL
  )
    throw new Error(
      "Admin browser fixtures require the isolated test database",
    );
  const deps = compose({
    NODE_ENV: "test",
    PORT: 3101,
    DATABASE_URL: url,
    BETTER_AUTH_SECRET: "synthetic-e2e-local-secret-at-least-32-characters",
    BETTER_AUTH_URL: "http://localhost:3100",
    WEB_ORIGIN: "http://localhost:3100",
    LOG_LEVEL: "silent",
  });
  const email = "admin-browser-" + randomUUID() + "@example.com";
  const password = "Synthetic-admin-browser-password-123";
  let id: string;
  try {
    id = await deps.admin.createAdministrator({
      name: "Browser admin",
      email,
      password,
    });
  } catch (error) {
    await deps.pool.end();
    throw error;
  }
  return {
    email,
    password,
    async cleanup(memberId?: string) {
      try {
        if (memberId) await deps.db.delete(user).where(eq(user.id, memberId));
        await deps.db.delete(user).where(eq(user.id, id));
      } finally {
        await deps.pool.end();
      }
    },
  };
}
