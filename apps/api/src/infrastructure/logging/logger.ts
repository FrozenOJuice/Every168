import pino from "pino";
export function createLogger(level: string) {
  return pino({
    level,
    base: { service: "168hours-api" },
    redact: ["password", "token", "cookie", "authorization", "DATABASE_URL"],
  });
}
