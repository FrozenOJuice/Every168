import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { adminAudit, session } from "../src/modules/identity/identity.table.js";
import {
  adminUsersSchema,
  adminAuditSchema,
  adminStatisticsSchema,
  adminHealthSchema,
} from "@168hours/contracts";
import { origin, testApp, commandHeaders } from "./helpers.js";
const { app, deps, signUp, createAdmin } = testApp();
const get = (path: string, cookie: string) =>
  request(app)
    .get("/api/v1/admin/" + path)
    .set("Cookie", cookie);
it("permits only fixed operator-created admin accounts and keeps personal records isolated", async () => {
  const member = await signUp(),
    admin = await createAdmin();
  for (const path of ["users", "audit", "statistics", "health"]) {
    await get(path, "").expect(401);
    await get(path, member.cookie).expect(403);
    await get(path, admin.cookie).expect(200);
  }
  await request(app)
    .post("/api/auth/sign-up/email")
    .set("Origin", origin)
    .send({
      name: "Escalation",
      email: randomUUID() + "@example.com",
      password: "Synthetic-test-password-123",
      accountType: "admin",
    })
    .expect(422);
  await expect(
    deps.pool.query("update users set account_type='admin' where id=$1", [
      member.id,
    ]),
  ).rejects.toMatchObject({ code: "23514" });
  await expect(
    deps.pool.query("update users set account_type='user' where id=$1", [
      admin.id,
    ]),
  ).rejects.toMatchObject({ code: "23514" });
  await expect(
    deps.admin.createAdministrator({
      name: "Duplicate",
      email: member.email,
      password: "Synthetic-test-password-123",
    }),
  ).rejects.toThrow();
  expect(
    (
      await request(app)
        .get("/api/v1/me")
        .set("Cookie", member.cookie)
        .expect(200)
    ).body.user.accountType,
  ).toBe("user");
  const me = await request(app)
    .get("/api/v1/me")
    .set("Cookie", admin.cookie)
    .expect(200);
  expect(me.body.user.accountType).toBe("admin");
  const goal = await request(app)
    .post("/api/v1/goals")
    .set("Cookie", member.cookie)
    .set("Origin", origin)
    .set(commandHeaders())
    .send({ title: "Private goal", status: "active" })
    .expect(201);
  await request(app)
    .get("/api/v1/goals/" + goal.body.id)
    .set("Cookie", admin.cookie)
    .expect(404);
  await request(app)
    .put("/api/v1/admin/users/" + admin.id + "/status")
    .set("Cookie", admin.cookie)
    .set("Origin", origin)
    .set(commandHeaders())
    .send({ suspended: true })
    .expect(403);
  await request(app)
    .put("/api/v1/admin/users/" + member.id + "/status")
    .set("Cookie", member.cookie)
    .set("Origin", origin)
    .set(commandHeaders())
    .send({ suspended: true })
    .expect(403);
  const listed = adminUsersSchema.parse(
    (
      await get(
        "users?search=" + encodeURIComponent(member.email),
        admin.cookie,
      )
    ).body,
  );
  expect(listed.items).toHaveLength(1);
  expect(listed.items[0]!.lastActiveAt).not.toBeNull();
});
it("suspends, invalidates sessions, blocks login and reactivates without restoring old cookies", async () => {
  const member = await signUp(),
    admin = await createAdmin();
  const headers = commandHeaders();
  const change = () =>
    request(app)
      .put("/api/v1/admin/users/" + member.id + "/status")
      .set("Cookie", admin.cookie)
      .set("Origin", origin)
      .set(headers)
      .send({ suspended: true });
  const result = await change().expect(200);
  expect(result.body.version).toBe(2);
  expect(result.body.suspendedAt).not.toBeNull();
  expect((await change().expect(200)).body).toEqual(result.body);
  expect(
    await deps.db.select().from(session).where(eq(session.userId, member.id)),
  ).toHaveLength(0);
  await request(app).get("/api/v1/me").set("Cookie", member.cookie).expect(401);
  const login = () =>
    request(app)
      .post("/api/auth/sign-in/email")
      .set("Origin", origin)
      .send({ email: member.email, password: "Synthetic-test-password-123" });
  const rejected = await login().expect(401);
  const missing = await request(app)
    .post("/api/auth/sign-in/email")
    .set("Origin", origin)
    .send({
      email: randomUUID() + "@example.com",
      password: "Synthetic-test-password-123",
    })
    .expect(401);
  expect(rejected.body.error.code).toBe(missing.body.error.code);
  expect(rejected.body.error.message).toBe(missing.body.error.message);
  await request(app)
    .put("/api/v1/admin/users/" + member.id + "/status")
    .set("Cookie", admin.cookie)
    .set("Origin", origin)
    .set(commandHeaders())
    .send({ suspended: false })
    .expect(409);
  const audits = await deps.db
    .select()
    .from(adminAudit)
    .where(eq(adminAudit.targetId, member.id));
  expect(audits).toHaveLength(1);
  await request(app)
    .put("/api/v1/admin/users/" + member.id + "/status")
    .set("Cookie", admin.cookie)
    .set("Origin", origin)
    .set(commandHeaders(2))
    .send({ suspended: false })
    .expect(200);
  await request(app).get("/api/v1/me").set("Cookie", member.cookie).expect(401);
  await login().expect(200);
  await expect(
    deps.pool.query(
      "update admin_audit set action='reactivated' where target_id=$1",
      [member.id],
    ),
  ).rejects.toMatchObject({ code: "23514" });
  await expect(
    deps.pool.query("delete from admin_audit where target_id=$1", [member.id]),
  ).rejects.toMatchObject({ code: "23514" });
});
it("revokes all sessions atomically and rolls back management if audit persistence fails", async () => {
  const member = await signUp(),
    admin = await createAdmin();
  await request(app)
    .post("/api/auth/sign-in/email")
    .set("Origin", origin)
    .send({ email: member.email, password: "Synthetic-test-password-123" })
    .expect(200);
  await deps.pool.query(
    `CREATE FUNCTION admin_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.target_id='${member.id}' THEN RAISE EXCEPTION 'Synthetic failure' USING ERRCODE='57P03'; END IF; RETURN NEW; END $$`,
  );
  await deps.pool.query(
    "CREATE TRIGGER admin_test_failure BEFORE INSERT ON admin_audit FOR EACH ROW EXECUTE FUNCTION admin_test_failure()",
  );
  const headers = commandHeaders();
  const revoke = () =>
    request(app)
      .post("/api/v1/admin/users/" + member.id + "/revoke-sessions")
      .set("Cookie", admin.cookie)
      .set("Origin", origin)
      .set(headers)
      .send({});
  try {
    await revoke().expect(503);
    expect(
      await deps.db.select().from(session).where(eq(session.userId, member.id)),
    ).toHaveLength(2);
    await request(app)
      .get("/api/v1/me")
      .set("Cookie", member.cookie)
      .expect(200);
  } finally {
    await deps.pool.query("DROP TRIGGER admin_test_failure ON admin_audit");
    await deps.pool.query("DROP FUNCTION admin_test_failure()");
  }
  const result = await revoke().expect(200);
  expect(result.body.version).toBe(2);
  expect((await revoke().expect(200)).body).toEqual(result.body);
  await request(app).get("/api/v1/me").set("Cookie", member.cookie).expect(401);
  expect(
    await deps.db.select().from(session).where(eq(session.userId, member.id)),
  ).toHaveLength(0);
});
it("returns real aggregate counts, bounded literal user search, audit pagination and safe operational health", async () => {
  const admin = await createAdmin();
  const member = await signUp({ name: "Literal%_\\" + randomUUID() });
  const listing = adminUsersSchema.parse(
    (
      await get(
        "users?search=" + encodeURIComponent("Literal%_\\"),
        admin.cookie,
      )
    ).body,
  );
  expect(listing.items.some((item) => item.id === member.id)).toBe(true);
  const first = adminUsersSchema.parse(
    (await get("users?limit=1", admin.cookie)).body,
  );
  expect(first.items).toHaveLength(1);
  expect(first.nextCursor).not.toBeNull();
  const next = adminUsersSchema.parse(
    (await get("users?limit=1&cursor=" + first.nextCursor, admin.cookie)).body,
  );
  expect(next.items[0]!.id).not.toBe(first.items[0]!.id);
  await get("users?cursor=invalid", admin.cookie).expect(422);
  const stats = adminStatisticsSchema.parse(
    (await get("statistics", admin.cookie)).body,
  );
  expect(stats.users.total).toBe(
    (await deps.pool.query("select count(*)::int as n from users")).rows[0].n,
  );
  for (const [key, table] of Object.entries({
    plannedBlocks: "time_blocks",
    foodEntries: "food_entries",
    strengthWorkouts: "strength_workouts",
    cardioActivities: "cardio_activities",
    goals: "goals",
  }))
    expect(stats.usage[key as keyof typeof stats.usage]).toBe(
      (await deps.pool.query(`select count(*)::int as n from ${table}`)).rows[0]
        .n,
    );
  const audit = adminAuditSchema.parse(
    (await get("audit?limit=1", admin.cookie)).body,
  );
  expect(audit.items).toHaveLength(1);
  expect(audit.nextCursor).not.toBeNull();
  const health = adminHealthSchema.parse(
    (await get("health", admin.cookie)).body,
  );
  expect(health.database).toBe("ready");
  expect(health.requests.total).toBeGreaterThan(0);
});
it("serializes session insertion with suspension and rechecks suspension inside write transactions", async () => {
  const member = await signUp(),
    admin = await createAdmin();
  await request(app)
    .put("/api/v1/admin/users/" + member.id + "/status")
    .set("Cookie", admin.cookie)
    .set("Origin", origin)
    .set(commandHeaders())
    .send({ suspended: true })
    .expect(200);
  await expect(
    deps.db.insert(session).values({
      userId: member.id,
      token: randomUUID(),
      expiresAt: new Date(Date.now() + 86400000),
    }),
  ).rejects.toThrow();
  await expect(
    deps.writes.execute(member.id, randomUUID(), {}, async () => ({
      ok: true,
    })),
  ).rejects.toMatchObject({ status: 401 });
});
