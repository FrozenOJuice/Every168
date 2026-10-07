import "dotenv/config";
import { createInterface } from "node:readline/promises";
import { compose } from "../../composition.js";
import { readConfig } from "../config/env.js";

const config = readConfig();
if (config.NODE_ENV === "production")
  throw new Error("This command is restricted to local setup.");
const location = new URL(config.DATABASE_URL);
if (
  !["localhost", "127.0.0.1"].includes(location.hostname) ||
  !["/hours_dev", "/hours_test"].includes(location.pathname)
)
  throw new Error("Admin creation requires a local development/test database.");
if (!process.stdin.isTTY || !process.stdout.isTTY)
  throw new Error("Run admin:create in an interactive terminal.");
const terminal = createInterface({
  input: process.stdin,
  output: process.stdout,
});
const name = await terminal.question("Admin name: ");
const email = await terminal.question("Admin email: ");
terminal.close();
// Disable terminal echo while reading; no credential in shell history, arguments or logs.
async function secret(prompt: string) {
  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  let value = "";
  try {
    return await new Promise<string>((resolve, reject) => {
      const read = (chunk: Buffer) => {
        for (const char of chunk.toString("utf8")) {
          if (char === "\u0003") {
            process.stdin.off("data", read);
            reject(new Error("Cancelled"));
            return;
          }
          if (char === "\r" || char === "\n") {
            process.stdin.off("data", read);
            resolve(value);
            return;
          }
          if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
          else if (char >= " ") value += char;
        }
      };
      process.stdin.on("data", read);
    });
  } finally {
    process.stdin.setRawMode(false);
    process.stdin.pause();
    process.stdout.write("\n");
  }
}
const password = await secret("Password (12–128 characters, hidden): ");
const confirmation = await secret("Confirm password: ");
if (password !== confirmation) throw new Error("Passwords do not match.");
const deps = compose(config);
try {
  await deps.databaseHealth.startup();
  await deps.admin.createAdministrator({ name, email, password });
  process.stdout.write(
    "Admin account created. Sign in at http://localhost:3000 and open Account menu → Admin.\n",
  );
} catch {
  process.stderr.write(
    "Admin creation failed. Check input, database readiness and whether the email already exists. No existing account was converted.\n",
  );
  process.exitCode = 1;
} finally {
  await deps.pool.end();
}
