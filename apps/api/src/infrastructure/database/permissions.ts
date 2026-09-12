import type { Pool } from "pg";
const identifier = (value: string) => '"' + value.replaceAll('"', '""') + '"';

/** Run with the migration role after migrations; runtime never receives DDL rights. */
export async function grantRuntimeAccess(pool: Pool, runtimeUrl: string) {
  const url = new URL(runtimeUrl);
  const role = identifier(decodeURIComponent(url.username));
  const database = identifier(decodeURIComponent(url.pathname.slice(1)));
  await pool.query(`REVOKE CREATE ON SCHEMA public FROM PUBLIC`);
  await pool.query(`GRANT CONNECT ON DATABASE ${database} TO ${role}`);
  await pool.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
  await pool.query(
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${role}`,
  );
  await pool.query(
    `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${role}`,
  );
  await pool.query(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${role}`,
  );
  await pool.query(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${role}`,
  );
}
