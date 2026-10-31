import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
/** Build first with API_URL=http://127.0.0.1:3101 RELEASE_SCOPE=core pnpm build. */
export default defineConfig({
  ...base,
  testDir: "./tests",
  metadata: { releaseScope: "core" },
  testMatch:
    /(?:e2e\/(?:account-lifecycle|fitness-complete-journey)|production\/headers)\.spec\.ts$/,
  projects: base.projects?.filter((project) => project.name === "desktop"),
  webServer: (Array.isArray(base.webServer)
    ? base.webServer
    : [base.webServer!]
  ).map((server, index) => ({
    ...server,
    env: {
      ...server.env,
      RELEASE_SCOPE: "core",
      ...(index === 1 ? { NEXT_DIST_DIR: ".next" } : {}),
    },
    ...(index === 1
      ? {
          command:
            "pnpm --filter @168hours/web exec next start --hostname 127.0.0.1 --port 3100",
          timeout: 30000,
        }
      : {}),
  })),
});
