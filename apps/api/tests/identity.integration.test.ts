import { eq } from "drizzle-orm";
import { session } from "../src/modules/identity/identity.table.js";
import { describe, it, expect } from "vitest";
import request from "supertest";
import { testApp, origin } from "./helpers.js";
const { app, signUp, deps } = testApp();
describe("identity and request boundary", () => {
  it("protects routes and rejects invalid sessions", async () => {
    await request(app).get("/api/v1/me").expect(401);
    await request(app)
      .get("/api/v1/me")
      .set("Cookie", "better-auth.session_token=invalid")
      .expect(401);
  });
  it("creates independent accounts, persists preferences and revokes sessions", async () => {
    const a = await signUp(),
      b = await signUp();
    const result = await request(app)
      .put("/api/v1/preferences")
      .set("Cookie", a.cookie)
      .set("Origin", origin)
      .send({
        timezone: "America/Edmonton",
        weekStartsOn: 0,
        weightUnit: "lb",
        distanceUnit: "mi",
      })
      .expect(200);
    expect(result.body.weightUnit).toBe("lb");
    const second = await request(app)
      .get("/api/v1/me")
      .set("Cookie", b.cookie)
      .expect(200);
    expect(second.body.preferences.timezone).toBe("UTC");
    expect(second.body.user.id).toBe(b.id);
    await request(app)
      .post("/api/auth/sign-out")
      .set("Cookie", a.cookie)
      .set("Origin", origin)
      .send({})
      .expect(200);
    await request(app).get("/api/v1/me").set("Cookie", a.cookie).expect(401);
    await request(app)
      .post("/api/auth/sign-in/email")
      .set("Origin", origin)
      .send({ email: a.email, password: "Synthetic-test-password-123" })
      .expect(200);
  });
  it("checks origins and returns sanitized validation errors", async () => {
    const a = await signUp();
    await request(app)
      .put("/api/v1/preferences")
      .set("Cookie", a.cookie)
      .set("Origin", "https://untrusted.example")
      .send({})
      .expect(403);
    const r = await request(app)
      .put("/api/v1/preferences")
      .set("Cookie", a.cookie)
      .set("Origin", origin)
      .send({ timezone: "invalid" })
      .expect(422);
    expect(r.body.error.code).toBe("VALIDATION_ERROR");
    expect(r.body.error.requestId).toBeTruthy();
    expect(r.headers["x-content-type-options"]).toBe("nosniff");
  });
  it("reports live database readiness", async () => {
    await request(app).get("/api/health").expect(200);
    await request(app).get("/api/ready").expect(200);
  });
});

it("rejects expired sessions and enforces bounded request/error handling", async () => {
  const a = await signUp();
  await deps.db
    .update(session)
    .set({ expiresAt: new Date(0) })
    .where(eq(session.userId, a.id));
  await request(app).get("/api/v1/me").set("Cookie", a.cookie).expect(401);
  const bad = await request(app)
    .post("/api/v1/categories")
    .set("Content-Type", "application/json")
    .send("{invalid")
    .expect(400);
  expect(bad.body.error.code).toBe("INVALID_JSON");
  for (const path of ["/api/v1/categories", "/api/auth/sign-up/email"]) {
    const response = await request(app)
      .post(path)
      .set("Origin", origin)
      .send({ name: "x".repeat(270000) })
      .expect(413);
    expect(response.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  }
  const failed = await request(app)
    .post("/api/auth/sign-in/email")
    .set("Origin", origin)
    .send({
      email: "missing@example.com",
      password: "Wrong-synthetic-password",
    })
    .expect(401);
  expect(failed.body.error.requestId).toBeTruthy();
});
