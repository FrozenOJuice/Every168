import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { checkImports } from "./boundaries.mjs";
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}
const problems = [
  "apps/api/src",
  "apps/web/src",
  "packages/contracts/src",
  "packages/api-client/src",
  "packages/domain-utils/src",
].flatMap((root) =>
  walk(root)
    .filter((file) => /\.[cm]?tsx?$/.test(file) && !file.endsWith(".test.ts"))
    .flatMap((file) => checkImports(file, readFileSync(file, "utf8"))),
);
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("Workspace, domain, and persistence layer boundaries passed.");
