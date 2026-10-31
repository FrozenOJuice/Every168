import { expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { and, eq, like } from "drizzle-orm";
import { origin, testApp } from "./helpers.js";
import { user, verification } from "../src/modules/identity/identity.table.js";
const { app, deps, signUp, mail } = testApp("core");
const password = "Synthetic-account-password-123";
const post = (path: string, body: object, cookie?: string) =>
  request(app)
    .post(`/api/auth/${path}`)
    .set("Origin", origin)
    .set("Cookie", cookie ?? "")
    .send(body);
const last = (email: string, kind: "verify" | "reset") =>
  [...mail].reverse().find((m) => m.to === email && m.kind === kind)!;
const cookieOf = (res: request.Response) =>
  (res.headers["set-cookie"] as unknown as string[])
    .map((v) => v.split(";")[0])
    .join("; ");
it("requires mailbox verification, keeps signup generic and consumes verification once", async () => {
  const email = `lifecycle-${randomUUID()}@example.com`;
  const input = { name: "Public beta", email, password };
  try {
    const response = await post("sign-up/email", input).expect(200);
    expect(response.body).toEqual({ status: true, verificationRequired: true });
    expect(response.headers["set-cookie"]).toBeUndefined();
    await post("sign-in/email", { email, password }).expect(403);
    const message = last(email, "verify");
    expect(message.token).toHaveLength(43);
    const rows = await deps.db
      .select()
      .from(verification)
      .where(like(verification.identifier, "account-security:verify:%"));
    expect(JSON.stringify(rows)).not.toContain(message.token);
    await post("verify-email", { token: message.token }).expect(200);
    await post("verify-email", { token: message.token }).expect(422);
    await post("sign-in/email", { email, password }).expect(200);
    expect((await post("sign-up/email", input).expect(200)).body).toEqual(
      response.body,
    );
    expect(
      (
        await post("send-verification-email", {
          email: `missing-${randomUUID()}@example.com`,
        }).expect(200)
      ).body,
    ).toEqual({ status: true });
  } finally {
    await deps.db.delete(user).where(eq(user.email, email));
  }
});
it("expires reset links, accepts exactly one concurrent reset and revokes all sessions", async () => {
  const member = await signUp();
  const second = await post("sign-in/email", {
    email: member.email,
    password: "Synthetic-test-password-123",
  }).expect(200);
  const missing = await post("request-password-reset", {
    email: `absent-${randomUUID()}@example.com`,
  }).expect(200);
  const requested = await post("request-password-reset", {
    email: member.email,
  }).expect(200);
  expect(requested.body).toEqual(missing.body);
  const expired = last(member.email, "reset");
  await deps.db
    .update(verification)
    .set({
      expiresAt: new Date(Date.now() - 1),
      createdAt: new Date(Date.now() - 61000),
    })
    .where(
      and(
        eq(verification.value, member.id),
        like(verification.identifier, "account-security:reset:%"),
      ),
    );
  await post("reset-password", {
    token: expired.token,
    newPassword: password,
  }).expect(422);
  await post("request-password-reset", { email: member.email }).expect(200);
  const token = last(member.email, "reset").token;
  const outcomes = await Promise.all([
    post("reset-password", { token, newPassword: password }),
    post("reset-password", { token, newPassword: password }),
  ]);
  expect(outcomes.map((r) => r.status).sort()).toEqual([200, 422]);
  for (const cookie of [member.cookie, cookieOf(second)])
    await request(app).get("/api/v1/me").set("Cookie", cookie).expect(401);
  await post("sign-in/email", {
    email: member.email,
    password: "Synthetic-test-password-123",
  }).expect(401);
  await post("sign-in/email", { email: member.email, password }).expect(200);
});
it("changes only the authenticated account with its current password and invalidates reset links", async () => {
  const member = await signUp();
  await post("request-password-reset", { email: member.email }).expect(200);
  const token = last(member.email, "reset").token;
  await post(
    "change-password",
    { currentPassword: "wrong-password", newPassword: password },
    member.cookie,
  ).expect(400);
  await request(app).get("/api/v1/me").set("Cookie", member.cookie).expect(200);
  await post(
    "change-password",
    { currentPassword: "Synthetic-test-password-123", newPassword: password },
    member.cookie,
  ).expect(200);
  await request(app).get("/api/v1/me").set("Cookie", member.cookie).expect(401);
  await post("reset-password", {
    token,
    newPassword: "Another-password-123",
  }).expect(422);
  await post("sign-in/email", { email: member.email, password }).expect(200);
  await post("change-password", {
    currentPassword: password,
    newPassword: password,
  }).expect(401);
});
it("rejects caller-owned callback redirects and cross-origin lifecycle requests", async () => {
  for (const path of ["request-password-reset", "send-verification-email"]) {
    await post(path, {
      email: "nobody@example.com",
      callbackURL: "https://foreign.example",
    }).expect(422);
    await request(app)
      .post(`/api/auth/${path}`)
      .set("Origin", "https://foreign.example")
      .send({ email: "nobody@example.com" })
      .expect(403);
  }
  await request(app).get("/api/auth/verify-email?token=secret").expect(404);
});
