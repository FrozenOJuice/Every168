import { defineConfig } from "@playwright/test";
import base from "./playwright.config";
/** Public beta gate: actual core scope, including retained-preview restrictions. */
export default defineConfig({
  ...base,
  metadata: { releaseScope: "core" },
  testMatch:
    /(?:branding|account-lifecycle|release-scope|isolation|calendar-editor-polish|calendar-domain-scheduling|calendar-repeating|calendar-redo|calendar-context-menu|calendar-release-correctness|calendar-reliability|fitness-complete-journey|fitness-workout-recovery|fitness-secondary-actions|fitness-result-corrections|fitness-advanced-polish|fitness-history-foundation|fitness-history-recovery|fitness-summary-polish|fitness-context-navigation)\.spec\.ts$/,
  projects: base.projects?.map((project) =>
    project.name === "tablet"
      ? {
          ...project,
          testMatch:
            /(?:release-scope|calendar-release-correctness)\.spec\.ts$/,
        }
      : project,
  ),
  webServer: (Array.isArray(base.webServer)
    ? base.webServer
    : [base.webServer!]
  ).map((server) => ({
    ...server,
    env: { ...server.env, RELEASE_SCOPE: "core" },
  })),
});
