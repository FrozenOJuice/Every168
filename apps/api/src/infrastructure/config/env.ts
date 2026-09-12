import "dotenv/config";
import { z } from "zod";
const positiveMs = (value: number) =>
  z.coerce.number().int().min(50).max(300000).default(value);
const postgresUrl = z
  .url()
  .refine((v) => /^postgres(ql)?:/.test(v), "Use a PostgreSQL URL");
const webOrigin = z.url().refine((value) => {
  const url = URL.parse(value);
  return (
    url !== null &&
    ["http:", "https:"].includes(url.protocol) &&
    value === url.origin
  );
}, "Use an HTTP(S) origin without credentials, path, query, or fragment");
export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    DATABASE_URL: postgresUrl,
    MIGRATION_DATABASE_URL: postgresUrl.optional(),
    DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
    DB_CONNECT_TIMEOUT_MS: positiveMs(3000),
    DB_STATEMENT_TIMEOUT_MS: positiveMs(5000),
    DB_LOCK_TIMEOUT_MS: positiveMs(2000),
    DB_IDLE_TRANSACTION_TIMEOUT_MS: positiveMs(10000),
    DB_QUERY_TIMEOUT_MS: positiveMs(7000),
    SHUTDOWN_TIMEOUT_MS: positiveMs(10000),
    API_RATE_LIMIT: z.coerce.number().int().min(1).max(10000).default(600),
    TRUSTED_PROXY_CIDRS: z
      .union([z.string(), z.array(z.string())])
      .default("")
      .transform((v) =>
        typeof v === "string"
          ? v
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : v,
      )
      .pipe(z.array(z.union([z.ipv4(), z.ipv6(), z.cidrv4(), z.cidrv6()]))),
    BETTER_AUTH_SECRET: z
      .string()
      .min(32)
      .refine((v) => !v.startsWith("replace-"), "Generate a random secret"),
    BETTER_AUTH_URL: webOrigin,
    WEB_ORIGIN: webOrigin,
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
  })
  .superRefine((v, ctx) => {
    if (v.BETTER_AUTH_URL !== v.WEB_ORIGIN)
      ctx.addIssue({
        code: "custom",
        path: ["BETTER_AUTH_URL"],
        message: "Auth and web must share an origin",
      });
    if (v.MIGRATION_DATABASE_URL) {
      const runtime = URL.parse(v.DATABASE_URL),
        migration = URL.parse(v.MIGRATION_DATABASE_URL);
      if (
        runtime &&
        migration &&
        (runtime.hostname !== migration.hostname ||
          runtime.port !== migration.port ||
          runtime.pathname !== migration.pathname)
      )
        ctx.addIssue({
          code: "custom",
          path: ["MIGRATION_DATABASE_URL"],
          message: "Migration and runtime URLs must target the same database",
        });
    }
    if (v.DB_QUERY_TIMEOUT_MS <= v.DB_STATEMENT_TIMEOUT_MS)
      ctx.addIssue({
        code: "custom",
        path: ["DB_QUERY_TIMEOUT_MS"],
        message: "Query timeout must exceed statement timeout",
      });
    if (v.DB_LOCK_TIMEOUT_MS > v.DB_STATEMENT_TIMEOUT_MS)
      ctx.addIssue({
        code: "custom",
        path: ["DB_LOCK_TIMEOUT_MS"],
        message: "Lock timeout must not exceed statement timeout",
      });
    if (
      v.NODE_ENV === "production" &&
      (!v.WEB_ORIGIN.startsWith("https://") ||
        !v.BETTER_AUTH_URL.startsWith("https://"))
    )
      ctx.addIssue({
        code: "custom",
        message: "Production requires HTTPS",
        path: ["WEB_ORIGIN"],
      });
  });
export type ConfigInput = z.input<typeof envSchema>;
export type Config = z.infer<typeof envSchema>;
export class ConfigurationError extends Error {
  readonly code = "INVALID_CONFIGURATION";
  constructor(
    public fields: string[],
    message: string,
  ) {
    super(message);
    this.name = "ConfigurationError";
  }
}
export function readConfig(input: NodeJS.ProcessEnv = process.env): Config {
  const result = envSchema.safeParse(input);
  if (!result.success)
    throw new ConfigurationError(
      result.error.issues.map((i) => i.path.join(".")),
      "Invalid configuration: " +
        result.error.issues
          .map((i) => i.path.join(".") + ": " + i.message)
          .join("; "),
    );
  return result.data;
}
