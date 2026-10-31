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

const valid = {
  DATABASE_URL: "postgresql://localhost/hours_test",
  BETTER_AUTH_SECRET: "synthetic-config-secret-at-least-32-characters",
  WEB_ORIGIN: "http://localhost:3000",
  BETTER_AUTH_URL: "http://localhost:3000",
};
it("requires exact matching web/auth origins and HTTPS in production", () => {
  for (const value of [
    "not-a-url",
    "ftp://hours.example",
    "http://hours.example/",
    "http://u:p@hours.example",
    "http://hours.example?token=secret",
    "http://hours.example/#fragment",
  ])
    expect(() => readConfig({ ...valid, WEB_ORIGIN: value })).toThrow(
      "WEB_ORIGIN",
    );
  expect(() =>
    readConfig({ ...valid, BETTER_AUTH_URL: "http://localhost:3001" }),
  ).toThrow("share an origin");
  expect(() => readConfig({ ...valid, NODE_ENV: "production" })).toThrow(
    "HTTPS",
  );
});
it("rejects disabled deadlines, unsafe proxy shortcuts, and mismatched migration databases", () => {
  expect(() => readConfig({ ...valid, DB_CONNECT_TIMEOUT_MS: "0" })).toThrow(
    "DB_CONNECT_TIMEOUT_MS",
  );
  expect(() => readConfig({ ...valid, DB_QUERY_TIMEOUT_MS: "5000" })).toThrow(
    "must exceed",
  );
  for (const value of ["true", "1", "loopback", "not-a-network"])
    expect(() => readConfig({ ...valid, TRUSTED_PROXY_CIDRS: value })).toThrow(
      "TRUSTED_PROXY_CIDRS",
    );
  expect(() =>
    readConfig({
      ...valid,
      MIGRATION_DATABASE_URL: "postgresql://localhost/another_db",
    }),
  ).toThrow("same database");
});
it("defaults to no proxy trust and accepts explicit address ranges", () => {
  expect(readConfig(valid).TRUSTED_PROXY_CIDRS).toEqual([]);
  expect(
    readConfig({ ...valid, TRUSTED_PROXY_CIDRS: "127.0.0.1/32, ::1/128" })
      .TRUSTED_PROXY_CIDRS,
  ).toEqual(["127.0.0.1/32", "::1/128"]);
});

it("defaults to first-release scope and requires an explicit preview opt-in", () => {
  expect(readConfig(valid).RELEASE_SCOPE).toBe("core");
  expect(readConfig({ ...valid, RELEASE_SCOPE: "preview" }).RELEASE_SCOPE).toBe(
    "preview",
  );
  expect(() => readConfig({ ...valid, RELEASE_SCOPE: "true" })).toThrow(
    "RELEASE_SCOPE",
  );
});

it("requires a configured sender and provider key for production account recovery", () => {
  const production = {
    ...valid,
    NODE_ENV: "production",
    WEB_ORIGIN: "https://hours.example",
    BETTER_AUTH_URL: "https://hours.example",
  };
  expect(() => readConfig(production)).toThrow("email delivery configuration");
  expect(() =>
    readConfig({ ...production, EMAIL_FROM: "member@example.com" }),
  ).toThrow("email delivery configuration");
  expect(
    readConfig({
      ...production,
      EMAIL_FROM: "member@example.com",
      EMAIL_API_KEY: "synthetic-provider-test-key",
    }).EMAIL_FROM,
  ).toBe("member@example.com");
});
