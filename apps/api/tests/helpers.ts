import "dotenv/config";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
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
  const app = createServer(createApp(deps));
  const servers = [app];
  async function listen(server: Server) {
    // Supertest connects to IPv4; a default IPv6 listener can share a port
    // with an unrelated IPv4 service on macOS. Bind the same address we use.
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        server.off("error", reject);
        resolve();
      });
    });
    return server;
  }
  async function serve(
    overrides: Partial<Parameters<typeof createApp>[0]> = {},
  ) {
    const server = createServer(createApp({ ...deps, ...overrides }));
    servers.push(server);
    return listen(server);
  }
  const users: string[] = [];
  beforeAll(async () => {
    await migrate(deps.db, { migrationsFolder: "./drizzle" });
    await listen(app);
  });
  afterAll(async () => {
    for (const server of servers) {
      if (server.listening)
        await new Promise<void>((resolve) => {
          server.close(() => resolve());
          server.closeAllConnections();
        });
    }
    for (const id of users) await deps.db.delete(user).where(eq(user.id, id));
    await deps.pool.end();
  });
  async function signUp(
    input: { name?: string; email?: string; password?: string } = {},
  ) {
    const email = input.email ?? "test-" + randomUUID() + "@example.com";
    const response = await request(app)
      .post("/api/auth/sign-up/email")
      .set("Origin", origin)
      .send({
        name: "Test member",
        email,
        password: "Synthetic-test-password-123",
        ...input,
      })
      .expect((r) => {
        if (r.status !== 200)
          throw new Error("Sign up failed: " + JSON.stringify(r.body));
      });
    const raw = response.headers["set-cookie"];
    const cookies = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const cookie = cookies.map((v) => v.split(";")[0]).join("; ");
    users.push(response.body.user.id as string);
    return {
      id: response.body.user.id as string,
      email: response.body.user.email as string,
      cookie,
      response,
    };
  }
  return { app, deps, signUp, serve };
}

/** Ordinary fixtures start at revision 1; tests advancing a record pass its returned revision explicitly. */
export function commandHeaders(version = 1) {
  return { "Idempotency-Key": randomUUID(), "If-Match": `"${version}"` };
}
