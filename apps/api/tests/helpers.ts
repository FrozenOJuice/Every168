import "dotenv/config";
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll } from "vitest";
import request from "supertest";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { eq } from "drizzle-orm";
import { compose } from "../src/composition.js";
import { createApp } from "../src/app.js";
import { user } from "../src/modules/identity/identity.table.js";
export const origin = "http://localhost:3000";
export function testApp() {
  const url =
    process.env.TEST_DATABASE_URL ??
    "postgresql://hours:hours_test_only@localhost:54321/hours_test";
  const parsed = new URL(url);
  if (!parsed.pathname.endsWith("_test") || url === process.env.DATABASE_URL)
    throw new Error(
      "Integration tests require a separate database ending in _test",
    );
  const deps = compose({
    NODE_ENV: "test",
    PORT: 3001,
    DATABASE_URL: url,
    BETTER_AUTH_SECRET: "synthetic-integration-test-secret-at-least-32",
    BETTER_AUTH_URL: origin,
    WEB_ORIGIN: origin,
    LOG_LEVEL: "silent",
  });
  const app = createApp(deps);
  const users: string[] = [];
  beforeAll(async () => {
    await migrate(deps.db, { migrationsFolder: "./drizzle" });
  });
  afterAll(async () => {
    for (const id of users) await deps.db.delete(user).where(eq(user.id, id));
    await deps.pool.end();
  });
  async function signUp() {
    const email = "test-" + randomUUID() + "@example.com";
    const response = await request(app)
      .post("/api/auth/sign-up/email")
      .set("Origin", origin)
      .send({
        name: "Test member",
        email,
        password: "Synthetic-test-password-123",
      })
      .expect((r) => {
        if (r.status !== 200)
          throw new Error("Sign up failed: " + JSON.stringify(r.body));
      });
    const raw = response.headers["set-cookie"];
    const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const cookie = cookies.map((v) => v.split(";")[0]).join("; ");
    users.push(response.body.user.id as string);
    return { id: response.body.user.id as string, email, cookie };
  }
  return { app, deps, signUp };
}
