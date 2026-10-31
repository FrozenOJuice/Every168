import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Database } from "../../infrastructure/database/client.js";
import type { Config } from "../../infrastructure/config/env.js";
import * as schema from "../../modules/identity/identity.table.js";
import type { Logger } from "pino";
import { errorDiagnostics } from "../../infrastructure/logging/diagnostics.js";
import { hashPassword, verifyPassword } from "./password.js";
export function createAuth(db: Database, config: Config, logger: Logger) {
  return betterAuth({
    appName: "168Hours",
    database: drizzleAdapter(db, { provider: "pg", schema, transaction: true }),
    secret: config.BETTER_AUTH_SECRET,
    baseURL: config.BETTER_AUTH_URL,
    trustedOrigins: [config.WEB_ORIGIN],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      autoSignIn: false,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      password: { hash: hashPassword, verify: verifyPassword },
    },
    advanced: {
      ipAddress: { ipAddressHeaders: ["x-168hours-client-ip"] },
      database: { generateId: "uuid" },
      useSecureCookies: config.NODE_ENV === "production",
      defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    // Express limits all attempts before input validation and database work.
    rateLimit: { enabled: false },
    logger: {
      level: "warn",
      log(level, _message, ...args: unknown[]) {
        // Library messages/objects may contain credentials, SQL or user data.
        logger[level === "error" ? "error" : "warn"](
          {
            component: "auth",
            diagnostics: args
              .filter((value) => value instanceof Error)
              .map((error) => errorDiagnostics(error)),
          },
          "Authentication library diagnostic",
        );
      },
    },
  });
}
export type Auth = ReturnType<typeof createAuth>;
