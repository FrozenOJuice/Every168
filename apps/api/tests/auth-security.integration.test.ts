import { commandHeaders } from "./helpers.js";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { expect, it } from "vitest";
import request from "supertest";
import { account, user } from "../src/modules/identity/identity.table.js";
import { origin, testApp } from "./helpers.js";

const { app, deps, signUp, serve } = testApp();
const password = "Synthetic-test-password-123";
const post = (path: string, input: object) =>
  request(app)
    .post("/api/auth/" + path)
    .set("Origin", origin)
    .set(commandHeaders())
    .send(input);

it("stores salted credentials and exposes only public user fields in auth responses", async () => {
  const a = await signUp({ email: ` Test-${randomUUID()}@EXAMPLE.COM ` }),
    b = await signUp();
  expect(a.email).toBe(a.email.trim().toLowerCase());
  for (const member of [a, b]) {
    expect(member.response.body).toEqual({
      user: { id: member.id, email: member.email, name: "Test member" },
    });
    expect(member.response.headers["cache-control"]).toBe("no-store");
  }
  const [first] = await deps.db
    .select()
    .from(account)
    .where(eq(account.userId, a.id));
  const [second] = await deps.db
    .select()
    .from(account)
    .where(eq(account.userId, b.id));
  expect(first!.password).toMatch(/^scrypt-v1\$/);
  expect(first!.password).not.toBe(second!.password);
  expect(first!.password).not.toContain(password);
  const [record] = await deps.db.select().from(user).where(eq(user.id, a.id));
  expect(record!.emailVerified).toBe(false);
  const login = await post("sign-in/email", {
    email: a.email.toUpperCase(),
    password,
  }).expect(200);
  expect(login.body).toEqual(a.response.body);
  expect(login.headers["cache-control"]).toBe("no-store");
  const wrong = await post("sign-in/email", {
    email: a.email,
    password: "incorrect-password-123",
  }).expect(401);
  const missing = await post("sign-in/email", {
    email: `missing-${randomUUID()}@example.com`,
    password,
  }).expect(401);
  expect(wrong.body.error.code).toBe(missing.body.error.code);
  expect(wrong.body.error.message).toBe(missing.body.error.message);
});

it.each(["accounts", "sessions"] as const)(
  "rolls back signup if inserting into %s fails, allowing a clean retry",
  async (table) => {
    const email = `rollback-${randomUUID()}@example.com`;
    // Fault injection is restricted to this synthetic email in the isolated DB.
    await deps.pool
      .query(`CREATE FUNCTION phase2_fail_account() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF EXISTS (SELECT 1 FROM users WHERE id = NEW.user_id AND email = '${email}') THEN
      RAISE EXCEPTION 'Synthetic failure' USING ERRCODE = '57P03';
    END IF; RETURN NEW; END $$`);
    try {
      await deps.pool.query(
        `CREATE TRIGGER phase2_fail_account BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION phase2_fail_account()`,
      );
      await post("sign-up/email", {
        name: "Test member",
        email,
        password,
      }).expect(503);
      expect(
        await deps.db.select().from(user).where(eq(user.email, email)),
      ).toEqual([]);
    } finally {
      await deps.pool.query(
        `DROP TRIGGER IF EXISTS phase2_fail_account ON ${table}`,
      );
      await deps.pool.query("DROP FUNCTION phase2_fail_account()");
      // Also remove an orphan if the regression assertion fails.
      await deps.db.delete(user).where(eq(user.email, email));
    }
    await signUp({ email });
  },
);

it("rejects unrequested auth capabilities, unknown fields, excessive inputs and non-JSON bodies", async () => {
  const fresh = await serve();
  for (const path of [
    "update-user",
    "change-password",
    "request-password-reset",
    "reset-password",
    "delete-user",
    "revoke-session",
    "sign-in/social",
    "list-sessions",
  ])
    await request(fresh)
      .post("/api/auth/" + path)
      .set("Origin", origin)
      .set(commandHeaders())
      .send({})
      .expect(404);
  await request(fresh).get("/api/auth/sign-out").expect(404);
  await request(fresh)
    .post("/api/auth/get-session")
    .set("Origin", origin)
    .set(commandHeaders())
    .send({})
    .expect(404);
  await request(fresh)
    .get("/api/auth/get-session?disableCookieCache=false")
    .expect(422);
  const base = { name: "Test", email: "unused@example.com", password };
  for (const extra of [
    { userId: randomUUID() },
    { emailVerified: true },
    { callbackURL: "https://evil.example" },
    { password: "x".repeat(129) },
    { name: "x".repeat(101) },
  ])
    await request(fresh)
      .post("/api/auth/sign-up/email")
      .set("Origin", origin)
      .set(commandHeaders())
      .send({ ...base, ...extra })
      .expect(422);
  await request(fresh)
    .post("/api/auth/sign-in/email")
    .set("Origin", origin)
    .set(commandHeaders())
    .send({ email: base.email, password: "x".repeat(129) })
    .expect(422);
  await request(fresh)
    .post("/api/auth/sign-in/email")
    .set("Origin", origin)
    .set(commandHeaders())
    .type("form")
    .send({ email: base.email, password })
    .expect(415);
});

it("rejects missing, foreign, null and cross-site origins even before a login cookie exists", async () => {
  const fresh = await serve();
  for (const path of [
    "/api/auth/sign-up/email",
    "/api/auth/sign-in/email",
    "/api/auth/sign-out",
    "/api/v1/preferences",
  ]) {
    for (const value of [undefined, "null", "https://evil.example"]) {
      const req = request(fresh).post(path);
      if (value) req.set("Origin", value);
      await req.send({}).expect(403);
    }
    await request(fresh)
      .post(path)
      .set("Origin", origin)
      .set(commandHeaders())
      .set("Sec-Fetch-Site", "cross-site")
      .send({})
      .expect(403);
  }
});
