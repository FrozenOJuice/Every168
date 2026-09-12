import { describe, it, expect } from "vitest";
import { readConfig } from "./env.js";
describe("configuration", () => {
  it("rejects missing configuration without disclosing values", () => {
    expect(() => readConfig({})).toThrow("DATABASE_URL");
  });
  it("rejects placeholder secrets", () => {
    expect(() =>
      readConfig({
        DATABASE_URL: "postgresql://localhost/test",
        BETTER_AUTH_SECRET: "replace-with-at-least-32-random-characters",
        WEB_ORIGIN: "http://localhost:3000",
        BETTER_AUTH_URL: "http://localhost:3000",
      }),
    ).toThrow("Generate a random secret");
  });
});
