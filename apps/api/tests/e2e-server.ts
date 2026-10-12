import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { compose } from "../src/composition.js";
import { startServer } from "../src/infrastructure/lifecycle.js";
const url =
  process.env.TEST_DATABASE_URL ??
  "postgresql://hours:hours_test_only@localhost:54321/hours_test";
if (
  !new URL(url).pathname.endsWith("_test") ||
  url === process.env.DATABASE_URL
)
  throw new Error("E2E requires an isolated database ending in _test");
const deps = compose({
  NODE_ENV: "test",
  PORT: 3101,
  DATABASE_URL: url,
  BETTER_AUTH_SECRET: "synthetic-e2e-local-secret-at-least-32-characters",
  BETTER_AUTH_URL: "http://localhost:3100",
  WEB_ORIGIN: "http://localhost:3100",
  LOG_LEVEL: "silent",
  API_RATE_LIMIT: 10000,
});
await migrate(deps.db, { migrationsFolder: "./drizzle" });
const running = await startServer(deps);
let exiting = false;
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, () => {
    if (exiting) return;
    exiting = true;
    void running.shutdown(signal).then((code) => process.exit(code));
  });
