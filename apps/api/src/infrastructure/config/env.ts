import "dotenv/config";
import { z } from "zod";
export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    DATABASE_URL: z
      .url()
      .refine((v) => /^postgres(ql)?:/.test(v), "Use a PostgreSQL URL"),
    BETTER_AUTH_SECRET: z
      .string()
      .min(32)
      .refine((v) => !v.startsWith("replace-"), "Generate a random secret"),
    BETTER_AUTH_URL: z.url(),
    WEB_ORIGIN: z.url(),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
  })
  .superRefine((v, ctx) => {
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
export type Config = z.infer<typeof envSchema>;
export function readConfig(input: NodeJS.ProcessEnv = process.env): Config {
  const result = envSchema.safeParse(input);
  if (!result.success)
    throw new Error(
      "Invalid configuration: " +
        result.error.issues
          .map((i) => i.path.join(".") + ": " + i.message)
          .join("; "),
    );
  return result.data;
}
