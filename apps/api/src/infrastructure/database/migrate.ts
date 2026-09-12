import { migrate } from "drizzle-orm/node-postgres/migrator";
import { readConfig } from "../config/env.js";
import { createDatabase } from "./client.js";
import { grantRuntimeAccess } from "./permissions.js";
const config = readConfig();
const migrationUrl = config.MIGRATION_DATABASE_URL ?? config.DATABASE_URL;
const { db, pool } = createDatabase(migrationUrl, {
  ...config,
  DB_STATEMENT_TIMEOUT_MS: 60000,
  DB_QUERY_TIMEOUT_MS: 65000,
});
try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  if (new URL(migrationUrl).username !== new URL(config.DATABASE_URL).username)
    await grantRuntimeAccess(pool, config.DATABASE_URL);
  console.log("Migrations applied.");
} finally {
  await pool.end();
}
