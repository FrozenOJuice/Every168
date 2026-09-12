import { migrate } from "drizzle-orm/node-postgres/migrator";
import { readConfig } from "../config/env.js";
import { createDatabase } from "./client.js";
const { db, pool } = createDatabase(readConfig().DATABASE_URL);
try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied.");
} finally {
  await pool.end();
}
