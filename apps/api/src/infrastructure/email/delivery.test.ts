import { afterEach, expect, it, vi } from "vitest";
import { readConfig } from "../config/env.js";
import { emailDelivery } from "./delivery.js";

afterEach(() => vi.restoreAllMocks());

it.each([
  ["verify", "Verify your Every168 email", "verify-email", "24 hours"],
  ["reset", "Reset your Every168 password", "reset-password", "30 minutes"],
] as const)(
  "brands %s email without changing its sender or credential link",
  async (kind, subject, route, expiry) => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));
    const config = readConfig({
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://hours:local_only@localhost/hours_test",
      BETTER_AUTH_SECRET: "synthetic-brand-test-secret-long-enough",
      EMAIL_API_KEY: "synthetic-provider-key",
      EMAIL_FROM: "sender@example.com",
      WEB_ORIGIN: "http://localhost:3000",
      BETTER_AUTH_URL: "http://localhost:3000",
    });
    await emailDelivery(config)({
      to: "member@example.com",
      kind,
      token: "synthetic-token",
    });
    const body = JSON.parse(fetch.mock.calls[0]![1]!.body as string);
    expect(body.from).toBe("Every168 <sender@example.com>");
    expect(body.to).toEqual(["member@example.com"]);
    expect(body.subject).toBe(subject);
    expect(body.text).toContain(
      `http://localhost:3000/${route}#token=synthetic-token`,
    );
    expect(body.text).toContain(expiry);
    expect(body.text).not.toMatch(/168\s*Hours/i);
  },
);
