import "dotenv/config";
import { defineConfig } from "drizzle-kit";
export default defineConfig({
  schema: [
    "./src/modules/**/*.table.ts",
    "./src/infrastructure/writes/*.table.ts",
  ],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
