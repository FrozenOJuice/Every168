import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
for (const [example, target] of [
  ["apps/api/.env.example", "apps/api/.env"],
  ["apps/web/.env.example", "apps/web/.env.local"],
]) {
  if (existsSync(target)) {
    console.log(`${target} already exists; kept unchanged.`);
    continue;
  }
  const content = readFileSync(example, "utf8").replace(
    "replace-with-at-least-32-random-characters",
    randomBytes(48).toString("base64url"),
  );
  writeFileSync(target, content, { mode: 0o600 });
  console.log(`Created ${target}.`);
}
