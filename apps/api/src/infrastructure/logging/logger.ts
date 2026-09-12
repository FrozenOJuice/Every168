import pino, { type DestinationStream } from "pino";
import { errorDiagnostics } from "./diagnostics.js";
export function createLogger(level: string, destination?: DestinationStream) {
  const options = {
    level,
    base: { service: "168hours-api" },
    redact: [
      "password",
      "token",
      "cookie",
      "authorization",
      "DATABASE_URL",
      "MIGRATION_DATABASE_URL",
      "BETTER_AUTH_SECRET",
      "*.password",
      "*.token",
      "req.headers.cookie",
      "req.headers.authorization",
    ],
    serializers: { err: errorDiagnostics, error: errorDiagnostics },
  };
  return destination ? pino(options, destination) : pino(options);
}
