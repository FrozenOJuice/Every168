import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  expect: { timeout: 10000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "phone",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
    {
      name: "tablet",
      use: { ...devices["iPad Mini"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @168hours/api exec tsx tests/e2e-server.ts",
      url: "http://127.0.0.1:3101/api/ready",
      reuseExistingServer: false,
      timeout: 30000,
    },
    {
      command: "pnpm --filter @168hours/web exec next dev --port 3100",
      url: "http://localhost:3100/login",
      reuseExistingServer: false,
      timeout: 90000,
      env: { API_URL: "http://127.0.0.1:3101", NEXT_DIST_DIR: ".next-e2e" },
    },
  ],
});
