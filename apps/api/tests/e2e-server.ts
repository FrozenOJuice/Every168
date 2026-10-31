import express from "express";
import { authInput, authUserSchema } from "@168hours/contracts";
import { createApp } from "../src/app.js";
import type { AccountEmail } from "../src/infrastructure/email/delivery.js";
import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { compose } from "../src/composition.js";
import { startServer } from "../src/infrastructure/lifecycle.js";
const url =
  process.env.TEST_DATABASE_URL ??
  "postgresql://hours:hours_test_only@localhost:54321/hours_test";
if (
  !new URL(url).pathname.endsWith("_test") ||
  url === process.env.DATABASE_URL
)
  throw new Error("E2E requires an isolated database ending in _test");
const mail: AccountEmail[] = [];
const deps = compose(
  {
    NODE_ENV: "test",
    RELEASE_SCOPE: process.env.RELEASE_SCOPE === "preview" ? "preview" : "core",
    PORT: 3101,
    DATABASE_URL: url,
    BETTER_AUTH_SECRET: "synthetic-e2e-local-secret-at-least-32-characters",
    BETTER_AUTH_URL: "http://localhost:3100",
    WEB_ORIGIN: "http://localhost:3100",
    LOG_LEVEL: "silent",
    API_RATE_LIMIT: 10000,
  },
  {
    sendEmail: async (message) => {
      mail.push(message);
    },
  },
);
await migrate(deps.db, { migrationsFolder: "./drizzle" });
// Fixture provisioning is part of the isolated test executable only, never createApp.
const app = express();
app.use("/api/__test", express.json({ limit: "256kb", inflate: false }));
app.use("/api/__test", (req, res, next) => {
  if (req.get("Origin") !== deps.config.WEB_ORIGIN && req.path !== "/mail")
    return res.sendStatus(403);
  next();
});
app.get("/api/__test/mail", (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(mail.filter((m) => m.to === req.query.email));
});
app.post("/api/__test/register", async (req, res) => {
  const input = authInput.parse(req.body);
  const post = (path: string, data: unknown) =>
    fetch(`http://127.0.0.1:3101/api/auth/${path}`, {
      method: "POST",
      headers: {
        Origin: deps.config.WEB_ORIGIN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
  const registered = await post("sign-up/email", input);
  if (!registered.ok)
    return res.status(registered.status).json(await registered.json());
  const message = [...mail]
    .reverse()
    .find((m) => m.to === input.email && m.kind === "verify");
  if (!message)
    return res.status(500).json({
      error: {
        code: "FIXTURE_EMAIL_MISSING",
        message: "Verification fixture missing",
      },
    });
  const verified = await post("verify-email", { token: message.token });
  if (!verified.ok)
    return res.status(verified.status).json(await verified.json());
  const login = await deps.auth.api.signInEmail({
    body: { email: input.email, password: input.password },
    headers: new Headers({ Origin: deps.config.WEB_ORIGIN }),
    asResponse: true,
  });
  for (const cookie of login.headers.getSetCookie())
    res.append("Set-Cookie", cookie);
  const data = await login.json();
  res.setHeader("Cache-Control", "no-store");
  return res
    .status(login.status)
    .json(login.ok ? { user: authUserSchema.parse(data.user) } : data);
});
app.use(createApp(deps));
const running = await startServer(deps, app);
let exiting = false;
for (const signal of ["SIGTERM", "SIGINT"] as const)
  process.on(signal, () => {
    if (exiting) return;
    exiting = true;
    void running.shutdown(signal).then((code) => process.exit(code));
  });
