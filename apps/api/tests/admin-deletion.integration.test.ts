import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { adminAudit } from "../src/modules/identity/identity.table.js";
import { adminAuditSchema } from "@168hours/contracts";
import { origin, testApp, commandHeaders } from "./helpers.js";
const { app, deps, signUp, createAdmin } = testApp();
const get = (path: string, cookie: string) =>
  request(app)
    .get("/api/v1/admin/" + path)
    .set("Cookie", cookie);

it("confirms and atomically deletes a regular account's private data while retaining audit and safe retries", async () => {
  const member = await signUp(),
    other = await signUp(),
    admin = await createAdmin();
  const post = (path: string, input: object, cookie = member.cookie) =>
    request(app)
      .post("/api/v1/" + path)
      .set("Cookie", cookie)
      .set("Origin", origin)
      .set(commandHeaders())
      .send(input);
  const goal = (
    await post("goals", { title: "Private goal", status: "active" }).expect(201)
  ).body;
  const otherGoal = (
    await post(
      "goals",
      { title: "Unaffected goal", status: "active" },
      other.cookie,
    ).expect(201)
  ).body;
  await post("calendar/series", {
    title: "Repeating plan",
    goalId: goal.id,
    timezone: "UTC",
    startDate: "2026-09-07",
    untilDate: "2026-09-08",
    startMinute: 540,
    durationMinutes: 60,
    frequency: "daily",
    interval: 1,
    weekdays: [1],
  }).expect(201);
  await post("calendar/templates", {
    name: "Routine",
    sourceDate: "2026-09-07",
    span: "week",
  }).expect(201);
  const food = (
    await post("foods", {
      name: "Meal",
      servingAmount: 1,
      servingUnit: "item",
      calories: 100,
    }).expect(201)
  ).body;
  await post("food-entries", {
    foodId: food.id,
    consumedAt: "2026-09-07T12:00:00Z",
    quantity: 1,
  }).expect(201);
  const exercise = (await post("exercises", { name: "Squat" }).expect(201))
    .body;
  const start = { title: "Strength", startedAt: "2026-09-07T09:00:00Z" };
  const workout = (await post("strength-workouts", start).expect(201)).body;
  await request(app)
    .put("/api/v1/strength-workouts/" + workout.id)
    .set("Cookie", member.cookie)
    .set("Origin", origin)
    .set(commandHeaders(workout.version))
    .send({
      ...start,
      endedAt: "2026-09-07T10:00:00Z",
      exercises: [
        { exerciseId: exercise.id, sets: [{ reps: 5, completed: true }] },
      ],
    })
    .expect(200);
  const headers = commandHeaders();
  const remove = (
    cookie = admin.cookie,
    id = member.id,
    email = member.email,
    revision = headers,
  ) =>
    request(app)
      .delete("/api/v1/admin/users/" + id)
      .set("Cookie", cookie)
      .set("Origin", origin)
      .set(revision)
      .send({ confirmationEmail: email });
  await remove("").expect(401);
  await remove(member.cookie).expect(403);
  await remove(admin.cookie, admin.id, admin.email).expect(403);
  const secondAdmin = await createAdmin();
  await remove(admin.cookie, secondAdmin.id, secondAdmin.email).expect(403);
  await remove(admin.cookie, member.id, other.email).expect(422);
  await remove(admin.cookie, member.id, member.email, commandHeaders(2)).expect(
    409,
  );
  await request(app)
    .delete("/api/v1/admin/users/" + member.id)
    .set("Cookie", admin.cookie)
    .set("Origin", origin)
    .set(headers)
    .send({})
    .expect(422);
  const tables = [
    "users",
    "accounts",
    "sessions",
    "preferences",
    "goals",
    "calendar_series",
    "time_blocks",
    "calendar_templates",
    "calendar_template_entries",
    "foods",
    "food_entries",
    "exercises",
    "strength_workouts",
    "strength_workout_exercises",
    "strength_sets",
    "time_entries",
    "write_receipts",
  ];
  const count = async (table: string) =>
    (
      await deps.pool.query(
        `select count(*)::int as n from ${table} where ${table === "users" ? "id" : "user_id"}=$1`,
        [member.id],
      )
    ).rows[0].n;
  for (const table of tables)
    expect(await count(table), table).toBeGreaterThan(0);
  expect((await remove().expect(200)).body).toEqual({ ok: true });
  expect((await remove().expect(200)).body).toEqual({ ok: true });
  for (const table of tables) expect(await count(table), table).toBe(0);
  await remove(admin.cookie, member.id, member.email, commandHeaders()).expect(
    404,
  );
  await remove(admin.cookie, member.id, other.email).expect(409);
  await request(app).get("/api/v1/me").set("Cookie", member.cookie).expect(401);
  await request(app)
    .post("/api/auth/sign-in/email")
    .set("Origin", origin)
    .send({ email: member.email, password: "Synthetic-test-password-123" })
    .expect(401);
  await expect(
    deps.writes.execute(member.id, randomUUID(), {}, async () => ({
      ok: true,
    })),
  ).rejects.toMatchObject({ status: 401 });
  await request(app)
    .get("/api/v1/goals/" + otherGoal.id)
    .set("Cookie", other.cookie)
    .expect(200);
  const history = adminAuditSchema.parse(
    (await get("audit", admin.cookie).expect(200)).body,
  );
  expect(
    history.items.filter(
      (entry) =>
        entry.targetId === member.id && entry.action === "account_deleted",
    ),
  ).toHaveLength(1);
  const auditRows = await deps.db
    .select()
    .from(adminAudit)
    .where(eq(adminAudit.targetId, member.id));
  expect(auditRows[0]!.actorId).toBe(admin.id);
  await expect(
    deps.pool.query("delete from admin_audit where target_id=$1", [member.id]),
  ).rejects.toMatchObject({ code: "23514" });
});

it("rolls back account deletion and cascades if its audit cannot be persisted", async () => {
  const member = await signUp(),
    admin = await createAdmin();
  const goal = (
    await request(app)
      .post("/api/v1/goals")
      .set("Cookie", member.cookie)
      .set("Origin", origin)
      .set(commandHeaders())
      .send({ title: "Kept after rollback", status: "active" })
      .expect(201)
  ).body;
  const headers = commandHeaders();
  const remove = () =>
    request(app)
      .delete("/api/v1/admin/users/" + member.id)
      .set("Cookie", admin.cookie)
      .set("Origin", origin)
      .set(headers)
      .send({ confirmationEmail: member.email });
  await deps.pool.query(
    `CREATE FUNCTION admin_delete_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.target_id='${member.id}' AND NEW.action='account_deleted' THEN RAISE EXCEPTION 'Synthetic audit failure' USING ERRCODE='57P03'; END IF; RETURN NEW; END $$`,
  );
  await deps.pool.query(
    "CREATE TRIGGER admin_delete_test_failure BEFORE INSERT ON admin_audit FOR EACH ROW EXECUTE FUNCTION admin_delete_test_failure()",
  );
  try {
    await remove().expect(503);
    await request(app)
      .get("/api/v1/me")
      .set("Cookie", member.cookie)
      .expect(200);
    await request(app)
      .get("/api/v1/goals/" + goal.id)
      .set("Cookie", member.cookie)
      .expect(200);
  } finally {
    await deps.pool.query(
      "DROP TRIGGER admin_delete_test_failure ON admin_audit",
    );
    await deps.pool.query("DROP FUNCTION admin_delete_test_failure()");
  }
  await remove().expect(200);
  await request(app).get("/api/v1/me").set("Cookie", member.cookie).expect(401);
});
