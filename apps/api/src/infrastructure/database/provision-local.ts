import { readFileSync, writeFileSync } from "node:fs";
import { readConfig } from "../config/env.js";
import { createDatabase } from "./client.js";
import { grantRuntimeAccess } from "./permissions.js";

const config = readConfig();
const migrationUrl = config.MIGRATION_DATABASE_URL ?? config.DATABASE_URL;
const location = new URL(migrationUrl);
if (
  config.NODE_ENV !== "development" ||
  !["localhost", "127.0.0.1"].includes(location.hostname) ||
  location.pathname !== "/hours_dev"
)
  throw new Error(
    "Local provisioning requires development and local hours_dev.",
  );
const runtime = new URL(migrationUrl);
runtime.username = "hours_app";
runtime.password = "hours_app_local_only";
const { pool } = createDatabase(migrationUrl, config);
try {
  const exists = await pool.query(
    "select rolsuper, rolcreaterole, rolcreatedb, rolbypassrls from pg_roles where rolname='hours_app'",
  );
  if (!exists.rows.length)
    await pool.query(
      "CREATE ROLE hours_app LOGIN PASSWORD 'hours_app_local_only' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS",
    );
  else if (Object.values(exists.rows[0]).some(Boolean))
    throw new Error(
      "Existing hours_app role has elevated privileges; refusing to reuse it.",
    );
  await grantRuntimeAccess(pool, runtime.toString());
  const check = createDatabase(runtime.toString(), config);
  try {
    await check.pool.query("select 1");
  } finally {
    await check.pool.end();
  }
  let env = readFileSync(".env", "utf8");
  for (const [key, value] of [
    ["DATABASE_URL", runtime.toString()],
    ["MIGRATION_DATABASE_URL", migrationUrl],
  ]) {
    const pattern = new RegExp(`^${key}=.*$`, "m");
    env = pattern.test(env)
      ? env.replace(pattern, () => `${key}=${value}`)
      : env + `\n${key}=${value}\n`;
  }
  writeFileSync(".env", env, { mode: 0o600 });
  console.log(
    "Restricted local runtime role provisioned; apps/api/.env updated. Restart the API to use it.",
  );
} finally {
  await pool.end();
}
