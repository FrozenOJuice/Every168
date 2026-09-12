import { commandHeaders } from "./helpers.js";
import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import request from "supertest";
import { createAuth } from "../src/shared/auth/auth.js";
import { session } from "../src/modules/identity/identity.table.js";
import { origin, testApp } from "./helpers.js";

const { app, deps, signUp, serve } = testApp();
const day = 86400000;

it("renews the database and browser together, while SSR reads preserve renewal eligibility", async () => {
  const a = await signUp();
  const expiry = new Date(Date.now() + 5 * day);
  await deps.db
    .update(session)
    .set({ expiresAt: expiry })
    .where(eq(session.userId, a.id));
  const serverRead = await request(app)
    .get("/api/v1/me")
    .set("Cookie", a.cookie)
    .set("X-168hours-Session-Refresh", "skip")
    .expect(200);
  expect(serverRead.headers["set-cookie"]).toBeUndefined();
  expect(
    (await deps.db.select().from(session).where(eq(session.userId, a.id)))[0]!
      .expiresAt,
  ).toEqual(expiry);
  const browserRead = await request(app)
    .get("/api/v1/me")
    .set("Cookie", a.cookie)
    .expect(200);
  const cookies = (browserRead.headers["set-cookie"] ??
    []) as unknown as string[];
  expect(
    cookies.some(
      (cookie) => cookie.includes("Max-Age=604800") && /httponly/i.test(cookie),
    ),
  ).toBe(true);
  expect(
    (
      await deps.db.select().from(session).where(eq(session.userId, a.id))
    )[0]!.expiresAt.getTime(),
  ).toBeGreaterThan(Date.now() + 6.9 * day);
  const lookup = await request(app)
    .get("/api/auth/get-session")
    .set("Cookie", a.cookie)
    .expect(200);
  expect(lookup.body).toEqual({
    user: a.response.body.user,
    session: { expiresAt: expect.any(String) },
  });
  expect(lookup.headers["cache-control"]).toBe("no-store");
});

it("rotates sessions on login and rejects tampering, expiry and replay after logout", async () => {
  const a = await signUp();
  const login = await request(app)
    .post("/api/auth/sign-in/email")
    .set("Origin", origin)
    .set(commandHeaders())
    .send({ email: a.email, password: "Synthetic-test-password-123" })
    .expect(200);
  const secondCookie = (login.headers["set-cookie"] as unknown as string[])
    .map((v) => v.split(";")[0])
    .join("; ");
  expect(secondCookie).not.toBe(a.cookie);
  await request(app)
    .get("/api/v1/me")
    .set("Cookie", a.cookie + "tampered")
    .expect(401);
  await request(app)
    .post("/api/auth/sign-out")
    .set("Origin", origin)
    .set(commandHeaders())
    .set("Cookie", a.cookie)
    .send({})
    .expect(200);
  await request(app).get("/api/v1/me").set("Cookie", a.cookie).expect(401);
  const gone = await request(app)
    .get("/api/auth/get-session")
    .set("Cookie", a.cookie)
    .expect(200);
  expect(gone.body).toBeNull();
  await request(app).get("/api/v1/me").set("Cookie", secondCookie).expect(200);
  await deps.db
    .update(session)
    .set({ expiresAt: new Date(0) })
    .where(eq(session.userId, a.id));
  await request(app)
    .get("/api/v1/me")
    .set("Cookie", secondCookie)
    .set("X-168hours-Session-Refresh", "skip")
    .expect(401);
});

it("does not report logout success or discard the cookie when revocation fails", async () => {
  const a = await signUp();
  await deps.pool
    .query(`CREATE FUNCTION phase2_fail_logout() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF OLD.user_id = '${a.id}' THEN RAISE EXCEPTION 'Synthetic failure' USING ERRCODE = '57P03'; END IF;
    RETURN OLD; END $$`);
  try {
    await deps.pool.query(
      "CREATE TRIGGER phase2_fail_logout BEFORE DELETE ON sessions FOR EACH ROW EXECUTE FUNCTION phase2_fail_logout()",
    );
    const failed = await request(app)
      .post("/api/auth/sign-out")
      .set("Origin", origin)
      .set(commandHeaders())
      .set("Cookie", a.cookie)
      .send({})
      .expect(503);
    expect(failed.headers["set-cookie"]).toBeUndefined();
    expect(failed.body.error.code).toBe("TEMPORARILY_UNAVAILABLE");
    await request(app).get("/api/v1/me").set("Cookie", a.cookie).expect(200);
  } finally {
    await deps.pool.query(
      "DROP TRIGGER IF EXISTS phase2_fail_logout ON sessions",
    );
    await deps.pool.query("DROP FUNCTION phase2_fail_logout()");
  }
  const success = await request(app)
    .post("/api/auth/sign-out")
    .set("Origin", origin)
    .set(commandHeaders())
    .set("Cookie", a.cookie)
    .send({})
    .expect(200);
  expect(
    (success.headers["set-cookie"] as unknown as string[]).some((cookie) =>
      cookie.includes("Max-Age=0"),
    ),
  ).toBe(true);
  await request(app).get("/api/v1/me").set("Cookie", a.cookie).expect(401);
});

it("uses Secure, HttpOnly, host-only production cookies and ignores forged proxy identity", async () => {
  const a = await signUp();
  const config = {
    ...deps.config,
    NODE_ENV: "production" as const,
    WEB_ORIGIN: "https://hours.example",
    BETTER_AUTH_URL: "https://hours.example",
  };
  const production = await serve({
    ...deps,
    config,
    auth: createAuth(deps.db, config, deps.logger),
  });
  const login = await request(production)
    .post("/api/auth/sign-in/email")
    .set("Origin", config.WEB_ORIGIN)
    .set("X-168hours-Client-IP", "198.51.100.1")
    .send({ email: a.email, password: "Synthetic-test-password-123" })
    .expect(200);
  const cookies = login.headers["set-cookie"] as unknown as string[];
  const cookie = cookies.find((value) => value.startsWith("__Secure-"))!;
  expect(cookie).toMatch(/; Secure/i);
  expect(cookie).toMatch(/; HttpOnly/i);
  expect(cookie).toMatch(/; SameSite=Lax/i);
  expect(cookie).toMatch(/; Path=\//i);
  expect(cookie).not.toMatch(/; Domain=/i);
  expect(
    (
      await deps.db.select().from(session).where(eq(session.userId, a.id))
    ).every((record) => record.ipAddress !== "198.51.100.1"),
  ).toBe(true);
  const valid = cookie.split(";")[0]!;
  await request(production).get("/api/v1/me").set("Cookie", valid).expect(200);
  const rotated = await serve({
    ...deps,
    config,
    auth: createAuth(
      deps.db,
      {
        ...config,
        BETTER_AUTH_SECRET: "another-synthetic-secret-for-rotation-123",
      },
      deps.logger,
    ),
  });
  await request(rotated).get("/api/v1/me").set("Cookie", valid).expect(401);
});
