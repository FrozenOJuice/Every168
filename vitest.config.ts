import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    // Bound startup/memory pressure so CPU-heavy password checks get predictable resources.
    maxWorkers: 4,
    include: [
      "packages/**/*.test.ts",
      "apps/api/src/**/*.test.ts",
      "apps/web/src/**/*.test.ts",
    ],
  },
});
