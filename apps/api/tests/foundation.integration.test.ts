import { commandHeaders } from "./helpers.js";
import { request as httpRequest } from "node:http";
import { describe, expect, it } from "vitest";
import request from "supertest";
import pino from "pino";
import { testApp, origin } from "./helpers.js";
import { AppError } from "../src/shared/errors/app-error.js";
const { app, deps, serve } = testApp();

describe("foundation HTTP boundaries", () => {
  it("rejects oversized chunked bodies and malformed JSON consistently", async () => {
    const server = await serve();
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Missing test address");
    try {
      for (const path of ["/api/auth/sign-up/email", "/api/v1/categories"]) {
        const result = await new Promise<{
          status: number | undefined;
          body: string;
        }>((resolve, reject) => {
          const req = httpRequest(
            {
              hostname: "127.0.0.1",
              port: address.port,
              path,
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Transfer-Encoding": "chunked",
                Connection: "close",
                Origin: origin,
              },
            },
            (res) => {
              let body = "";
              res.on("data", (chunk) => {
                body += chunk;
              });
              res.on("end", () => resolve({ status: res.statusCode, body }));
            },
          );
          req.on("error", reject);
          req.write('{"name":"');
          req.write("x".repeat(270000));
          req.end('"}');
        });
        expect(result.status).toBe(413);
        expect(JSON.parse(result.body).error.code).toBe("PAYLOAD_TOO_LARGE");
        const bad = await request(app)
          .post(path)
          .set("Content-Type", "application/json")
          .send("{invalid")
          .expect(400);
        expect(bad.body.error.code).toBe("INVALID_JSON");
      }
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("returns matching request IDs and JSON 404s including empty auth failures", async () => {
    for (const path of ["/api/missing", "/api/auth/missing"]) {
      const r = await request(app).get(path).expect(404);
      expect(r.body.error.code).toBe("NOT_FOUND");
      expect(r.body.error.requestId).toBe(r.headers["x-request-id"]);
      expect(r.headers["cache-control"]).toBe("no-store");
    }
  });
  it("returns bounded readiness failures and rejects work while draining", async () => {
    const unavailable = await serve({
      ...deps,
      databaseHealth: {
        ...deps.databaseHealth,
        ready: async () => {
          throw new AppError(
            503,
            "NOT_READY",
            "Database is temporarily unavailable.",
          );
        },
      },
    });
    await request(unavailable).get("/api/ready").expect(503);
    const draining = await serve({ lifecycle: { draining: true } });
    await request(draining).get("/api/health").expect(200);
    await request(draining).get("/api/ready").expect(503);
    await request(draining).get("/api/v1/me").expect(503);
  });
  it("limits ordinary API requests before session/database work despite spoofed IP headers", async () => {
    const limited = await serve({
      ...deps,
      config: { ...deps.config, API_RATE_LIMIT: 2 },
    });
    for (let i = 0; i < 3; i++) {
      const r = await request(limited)
        .get("/api/v1/me")
        .set("X-Forwarded-For", `192.0.2.${i + 1}`)
        .set("X-168hours-Client-IP", `198.51.100.${i + 1}`);
      expect(r.status).toBe(i < 2 ? 401 : 429);
      if (i === 2) {
        expect(r.body.error.code).toBe("RATE_LIMITED");
        expect(Number(r.headers["retry-after"])).toBeGreaterThan(0);
      }
    }
    await request(limited).get("/api/health").expect(200);
  });
  it("prevents auth rate-limit bypass and retains retry guidance", async () => {
    for (let i = 0; i < 11; i++) {
      const r = await request(app)
        .post("/api/auth/sign-in/email")
        .set("Origin", origin)
        .set(commandHeaders())
        .set("X-Forwarded-For", `192.0.2.${i + 1}`)
        .set("X-168hours-Client-IP", `198.51.100.${i + 1}`)
        .send({ email: "invalid", password: "short" });
      expect(r.status).toBe(i < 10 ? 422 : 429);
      if (i === 10) {
        expect(r.body.error.code).toBe("RATE_LIMITED");
        expect(Number(r.headers["retry-after"])).toBeGreaterThan(0);
      }
    }
  });
  it("uses an explicitly trusted proxy's rightmost untrusted address", async () => {
    const trusted = await serve({
      ...deps,
      config: {
        ...deps.config,
        API_RATE_LIMIT: 1,
        TRUSTED_PROXY_CIDRS: ["127.0.0.1/32", "::1/128"],
      },
    });
    await request(trusted)
      .get("/api/missing")
      .set("X-Forwarded-For", "192.0.2.1, 198.51.100.10")
      .expect(404);
    await request(trusted)
      .get("/api/missing")
      .set("X-Forwarded-For", "192.0.2.2, 198.51.100.10")
      .expect(429);
    await request(trusted)
      .get("/api/missing")
      .set("X-Forwarded-For", "198.51.100.11")
      .expect(404);
  });
  it("keeps private messages/values out of error logs and responses", async () => {
    const logs: string[] = [];
    const logger = pino(
      { level: "info" },
      {
        write: (line: string) => {
          logs.push(line);
        },
      },
    );
    const driver = Object.assign(
      new Error("secret-credential private-health-value"),
      { code: "ECONNREFUSED" },
    );
    const failing = await serve({
      ...deps,
      logger,
      databaseHealth: {
        ...deps.databaseHealth,
        ready: async () => {
          throw new Error("select private-health-value", { cause: driver });
        },
      },
    });
    const r = await request(failing)
      .get("/api/ready?token=secret-credential")
      .set("Authorization", "secret-credential")
      .expect(503);
    const output = JSON.stringify(r.body) + logs.join("");
    expect(output).not.toContain("secret-credential");
    expect(output).not.toContain("private-health-value");
    const failure = logs
      .map((line) => JSON.parse(line))
      .find((line) => line.msg === "Request failed");
    expect(failure.diagnostic.cause.code).toBe("ECONNREFUSED");
    expect(failure.diagnostic.locations.length).toBeGreaterThan(0);
    expect(failure.requestId).toBe(r.headers["x-request-id"]);
  });
});
