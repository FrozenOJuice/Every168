import "dotenv/config";
import { createDatabase } from "./client.js";
import { readConfig } from "../config/env.js";
import {
  importCnf,
  readCnfDataset,
} from "../../modules/nutrition/catalogue-import.repository.js";
const config = readConfig();
const url = config.MIGRATION_DATABASE_URL ?? config.DATABASE_URL;
const target = new URL(url);
if (
  config.NODE_ENV === "production" ||
  !["localhost", "127.0.0.1"].includes(target.hostname) ||
  !/_(dev|test)$/.test(target.pathname)
)
  throw new Error(
    "This explicit import command requires a local development/test database.",
  );
const data = await readCnfDataset(process.argv[2]);
const { db, pool } = createDatabase(url, {
  ...config,
  DB_STATEMENT_TIMEOUT_MS: 60000,
  DB_QUERY_TIMEOUT_MS: 65000,
});
try {
  console.log(JSON.stringify(await importCnf(db, data), null, 2));
} finally {
  await pool.end();
}
