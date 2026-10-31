import pg from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Config } from "../config/env.js";
import { createLogger } from "../logging/logger.js";
import { errorDiagnostics } from "../logging/diagnostics.js";
type Options = Pick<
  Config,
  | "DB_POOL_MAX"
  | "DB_CONNECT_TIMEOUT_MS"
  | "DB_STATEMENT_TIMEOUT_MS"
  | "DB_LOCK_TIMEOUT_MS"
  | "DB_IDLE_TRANSACTION_TIMEOUT_MS"
  | "DB_QUERY_TIMEOUT_MS"
>;
export function createDatabase(
  url: string,
  options?: Options,
  logger = createLogger("error"),
) {
  const pool = new pg.Pool({
    connectionString: url,
    application_name: "every168-api",
    max: options?.DB_POOL_MAX ?? 10,
    connectionTimeoutMillis: options?.DB_CONNECT_TIMEOUT_MS ?? 3000,
    statement_timeout: options?.DB_STATEMENT_TIMEOUT_MS ?? 5000,
    lock_timeout: options?.DB_LOCK_TIMEOUT_MS ?? 2000,
    idle_in_transaction_session_timeout:
      options?.DB_IDLE_TRANSACTION_TIMEOUT_MS ?? 10000,
    query_timeout: options?.DB_QUERY_TIMEOUT_MS ?? 7000,
    idleTimeoutMillis: 30000,
  });
  // Checked-out clients can fail between queries (e.g. idle transaction expiry).
  // Their error events must not become uncaught process exceptions.
  pool.on("connect", (client) =>
    client.on("error", (error) =>
      logger.error(
        { diagnostic: errorDiagnostics(error) },
        "Database connection failed",
      ),
    ),
  );
  pool.on("error", (error) =>
    logger.error(
      { diagnostic: errorDiagnostics(error) },
      "Database pool error",
    ),
  );
  const db = drizzle(pool);
  return { db, pool };
}
export type Database = NodePgDatabase;
export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type Db = Database | Transaction;
