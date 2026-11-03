import { defineConfig } from "@playwright/test";
import base from "./playwright.beta.config";
export default defineConfig({
  ...base,
  testMatch:
    /(?:everyday-food|food-day-panel|food-reliability|food-navigation|food-organisation|food-today-design|food-catalogue|workspace-navigation)\.spec\.ts$/,
  projects: base.projects?.filter((p) => p.name !== "tablet"),
});
