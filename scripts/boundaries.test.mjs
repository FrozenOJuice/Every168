import { test } from "node:test";
import assert from "node:assert/strict";
import { checkImports } from "./boundaries.mjs";
const base = "apps/api/src/modules/planning/";
test("services cannot access database via direct imports, re-exports, or dynamic imports", () => {
  for (const source of [
    'import { sql } from "drizzle-orm";',
    'export { createDatabase } from "../../infrastructure/database/client.js";',
    'const pg = await import("pg");',
    'const db = require("../../infrastructure/database/client");',
    'import "./planning.table.js";',
  ])
    assert.ok(checkImports(base + "planning.service.ts", source).length);
});
test("routes cannot bypass services", () =>
  assert.ok(
    checkImports(
      base + "planning.routes.ts",
      'import { planningRepository } from "./planning.repository.js";',
    ).length,
  ));
test("private domain helpers cannot bypass public services", () =>
  assert.ok(
    checkImports(
      base + "planning.service.ts",
      'import { helper } from "../exercise/private-helper.js";',
    ).length,
  ));
test("repositories cannot depend on services", () =>
  assert.ok(
    checkImports(
      base + "planning.repository.ts",
      'import { planningService } from "./planning.service.js";',
    ).length,
  ));
test("web and shared packages cannot import persistence", () => {
  for (const file of [
    "apps/web/src/lib/leak.ts",
    "packages/domain-utils/src/leak.ts",
  ])
    assert.ok(checkImports(file, 'import { sql } from "drizzle-orm";').length);
});
test("legitimate repository, service, opaque scope, and foreign-key imports pass", () => {
  for (const [file, source] of [
    ["planning.repository.ts", 'import { sql } from "drizzle-orm";'],
    [
      "planning.service.ts",
      'import type { TransactionContext } from "../../shared/transactions.js";',
    ],
    [
      "planning.service.ts",
      'import type { GoalsService } from "../goals/goals.service.js";',
    ],
    [
      "planning.table.ts",
      'import { user } from "../identity/identity.table.js";',
    ],
  ])
    assert.deepEqual(checkImports(base + file, source), []);
});
