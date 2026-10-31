import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

const database =
  process.env.TEST_DATABASE_URL ??
  "postgresql://hours:hours_test_only@localhost:54321/hours_test";
const location = new URL(database);
if (
  !["localhost", "127.0.0.1"].includes(location.hostname) ||
  !location.pathname.endsWith("_test") ||
  database === process.env.DATABASE_URL
)
  throw new Error(
    "Portfolio captures require an isolated local database ending in _test.",
  );

export default defineConfig({
  ...base,
  testDir: "./tests/portfolio",
  testMatch: "capture.spec.ts",
  timeout: 180000,
  reporter: "list",
  metadata: { releaseScope: "core", purpose: "synthetic portfolio captures" },
  use: {
    ...base.use,
    locale: "en-US",
    timezoneId: "America/Edmonton",
    reducedMotion: "reduce",
  },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1000 },
        deviceScaleFactor: 1,
      },
    },
  ],
  webServer: (Array.isArray(base.webServer)
    ? base.webServer
    : [base.webServer!]
  ).map((server, index) => ({
    ...server,
    ...(index === 1
      ? {
          command:
            "pnpm --filter @168hours/web exec next dev --hostname 127.0.0.1 --port 3100",
        }
      : {}),
    env: {
      ...server.env,
      RELEASE_SCOPE: "core",
      TEST_DATABASE_URL: database,
      NEXT_DIST_DIR: ".next-e2e",
    },
  })),
});
