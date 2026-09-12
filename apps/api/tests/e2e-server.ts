import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { compose } from "../src/composition.js";
import { createApp } from "../src/app.js";
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
});
await migrate(deps.db, { migrationsFolder: "./drizzle" });
const server = createApp(deps).listen(3101, "127.0.0.1");
for (const signal of ["SIGTERM", "SIGINT"])
  process.once(signal, () =>
    server.close(() => {
      void deps.pool.end().then(() => process.exit(0));
    }),
  );
