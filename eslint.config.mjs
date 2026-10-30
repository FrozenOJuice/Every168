import ts from "typescript-eslint";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";
export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/.next-e2e/**",
      "**/dist/**",
      "**/next-env.d.ts",
      "**/drizzle/meta/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  ...ts.configs.recommended,
  ...nextVitals.map((c) => ({ ...c, files: ["apps/web/**/*.{ts,tsx}"] })),
  ...nextTs.map((c) => ({ ...c, files: ["apps/web/**/*.{ts,tsx}"] })),
  {
    settings: { next: { rootDir: "apps/web/" } },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  prettier,
  {
    files: ["apps/web/src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-globals": [
        "error",
        { name: "alert", message: "Use the shared styled dialog." },
        { name: "confirm", message: "Use useConfirm." },
        { name: "prompt", message: "Use useTextPrompt." },
      ],
      "no-restricted-properties": [
        "error",
        ...["window", "globalThis"].flatMap((object) =>
          ["alert", "confirm", "prompt"].map((property) => ({
            object,
            property,
            message: "Use the shared styled dialogs.",
          })),
        ),
      ],
    },
  },
];
