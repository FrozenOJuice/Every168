import { readdirSync, readFileSync } from "node:fs";
import { join, resolve, relative } from "node:path";
const problems = [];
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}
for (const root of [
  "apps/api/src",
  "apps/web/src",
  "packages/contracts/src",
  "packages/api-client/src",
  "packages/domain-utils/src",
]) {
  for (const file of walk(root).filter((f) => /\.[cm]?tsx?$/.test(f))) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(
      /(?:from\s*|import\s*\()['"]([^'"]+)['"]/g,
    )) {
      const target = match[1];
      if (
        file.startsWith("apps/web/") &&
        /drizzle|^pg$|apps\/api|api\/src/.test(target)
      )
        problems.push(`${file}: web imports API persistence (${target})`);
      const ownModule = file.match(/apps\/api\/src\/modules\/([^/]+)\//)?.[1];
      if (ownModule && target.startsWith(".")) {
        const destination = relative(resolve("."), resolve(file, "..", target));
        const otherModule = destination.match(
          /apps\/api\/src\/modules\/([^/]+)\//,
        )?.[1];
        if (
          otherModule &&
          ownModule !== otherModule &&
          /\.repository\./.test(target)
        )
          problems.push(`${file}: imports private ${otherModule} repository`);
      }
      if (file.startsWith("packages/") && /apps\//.test(target))
        problems.push(`${file}: shared package imports an app`);
    }
  }
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("Workspace and domain import boundaries passed.");
