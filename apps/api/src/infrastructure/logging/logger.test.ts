import { expect, it } from "vitest";
import { createLogger } from "./logger.js";
it("redacts credentials and serializes errors without SQL, values, or messages", () => {
  const lines: string[] = [];
  const logger = createLogger("info", {
    write: (line: string) => {
      lines.push(line);
    },
  });
  const privateValue = "private-audit-sentinel";
  const err = Object.assign(new Error(`SQL contains ${privateValue}`), {
    code: "23505",
    detail: privateValue,
  });
  logger.error(
    {
      err,
      password: privateValue,
      MIGRATION_DATABASE_URL: privateValue,
      user: { token: privateValue },
      req: { headers: { cookie: privateValue, authorization: privateValue } },
    },
    "Operation failed",
  );
  expect(lines.join("")).not.toContain(privateValue);
  const record = JSON.parse(lines[0]!);
  expect(record.err.code).toBe("23505");
  expect(record.err.locations.length).toBeGreaterThan(0);
  expect(record.err.message).toBeUndefined();
});
