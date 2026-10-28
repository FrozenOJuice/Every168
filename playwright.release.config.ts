import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  testMatch: "release-scope.spec.ts",
  metadata: { releaseScope: "core" },
  webServer: (Array.isArray(base.webServer)
    ? base.webServer
    : [base.webServer!]
  ).map((server) => ({
    ...server,
    env: { ...server.env, RELEASE_SCOPE: "core" },
  })),
});
