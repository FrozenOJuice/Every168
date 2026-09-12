import { beforeAll, expect, it, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import type { QueryConfig } from "pg";
import { testApp, origin, commandHeaders } from "./helpers.js";
import { strengthRepository } from "../src/modules/exercise/strength.repository.js";

const { app, deps, signUp, serve } = testApp();
let a: Awaited<ReturnType<typeof signUp>>;
let b: typeof a;
beforeAll(async () => {
  a = await signUp();
  b = await signUp();
});
const instant = "2026-09-07T09:00:00Z";
const blockInput = {
  title: "Integrity plan",
  startsAt: instant,
  endsAt: "2026-09-07T10:00:00Z",
};
const cardioInput = {
  title: "Integrity run",
  activityType: "run",
  startedAt: instant,
  durationSeconds: 600,
};
const foodInput = {
  name: "Integrity oats",
  servingAmount: 100,
  servingUnit: "g",
  calories: 300,
};
function write(
  method: "post" | "put" | "delete",
  path: string,
  input: object = {},
  version = 1,
  key: string = randomUUID(),
  cookie = a.cookie,
) {
  return request(app)
    [method]("/api/v1/" + path)
    .set("Cookie", cookie)
    .set("Origin", origin)
    .set({ ...commandHeaders(version), "Idempotency-Key": key })
    .send(input);
}
function read(path: string) {
  return request(app)
    .get("/api/v1/" + path)
    .set("Cookie", a.cookie);
}

it("requires revisions and rejects stale writes across every mutable resource family", async () => {
  const food = await write("post", "foods", foodInput).expect(201);
  const cases: [string, object, object][] = [
    ["categories", { name: "Category" }, { name: "Changed" }],
    ["goals", { title: "Goal" }, { title: "Changed" }],
    ["time-blocks", blockInput, { ...blockInput, title: "Changed" }],
    ["time-entries", blockInput, { ...blockInput, title: "Changed" }],
    ["foods", foodInput, { ...foodInput, name: "Changed" }],
    [
      "food-entries",
      { foodId: food.body.id, quantity: 1, consumedAt: instant },
      { quantity: 2, consumedAt: instant },
    ],
    ["exercises", { name: "Squat" }, { name: "Changed" }],
    [
      "strength-workouts",
      { title: "Workout", startedAt: instant },
      { title: "Changed", startedAt: instant, endedAt: null, exercises: [] },
    ],
    [
      "cardio-activities",
      cardioInput,
      { ...cardioInput, durationSeconds: 1200 },
    ],
    [
      "water-entries",
      { amountMl: 250, consumedAt: instant },
      { amountMl: 500, consumedAt: instant },
    ],
    [
      "weight-entries",
      { weightKg: 70, measuredAt: instant },
      { weightKg: 71, measuredAt: instant },
    ],
  ];
  for (const [family, create, update] of cases) {
    const created = await write("post", family, create).expect(201);
    const path = family + "/" + created.body.id;
    expect(created.body.version).toBe(1);
    await request(app)
      .put("/api/v1/" + path)
      .set("Cookie", a.cookie)
      .set("Origin", origin)
      .set("Idempotency-Key", randomUUID())
      .send(update)
      .expect(428);
    const first = await write("put", path, update, created.body.version).expect(
      200,
    );
    expect(first.body.version).toBe(2);
    const stale = await write("put", path, update, created.body.version).expect(
      409,
    );
    expect(stale.body.error.code).toBe("STALE_REVISION");
    await write("put", path, update, 1, randomUUID(), b.cookie).expect(404);
    if (["categories", "foods", "exercises"].includes(family)) {
      await write("post", path + "/archive", {}, 1).expect(409);
      await write("post", path + "/archive", {}, first.body.version).expect(
        200,
      );
    } else if (family !== "goals") {
      await write("delete", path, {}, 1).expect(409);
      await write("delete", path, {}, first.body.version).expect(200);
    }
  }
  const me = await read("me").expect(200);
  const prefs = {
    timezone: "UTC",
    weekStartsOn: 1,
    weightUnit: "lb",
    distanceUnit: "km",
  };
  const saved = await write(
    "put",
    "preferences",
    prefs,
    me.body.preferences.version,
  ).expect(200);
  expect(saved.body.version).toBe(me.body.preferences.version + 1);
  await write("put", "preferences", prefs, me.body.preferences.version).expect(
    409,
  );
});

it("allows only one of two concurrent edits or an edit/delete from the same revision", async () => {
  const created = await write("post", "water-entries", {
    amountMl: 250,
    consumedAt: instant,
  }).expect(201);
  const path = "water-entries/" + created.body.id;
  const saves = await Promise.all(
    [500, 750].map((amountMl) =>
      write("put", path, { amountMl, consumedAt: instant }, 1),
    ),
  );
  expect(saves.map((r) => r.status).sort()).toEqual([200, 409]);
  const winner = saves.find((r) => r.status === 200)!;
  expect((await read(path)).body).toEqual(winner.body);
  const race = await Promise.all([
    write(
      "put",
      path,
      { amountMl: 1000, consumedAt: instant },
      winner.body.version,
    ),
    write("delete", path, {}, winner.body.version),
  ]);
  expect(race.filter((r) => r.status === 200)).toHaveLength(1);
  expect([404, 409]).toContain(race.find((r) => r.status !== 200)!.status);
});

it("replays concurrent creates and deletes, scopes receipts by user, and rejects key reuse for another request", async () => {
  const key = randomUUID();
  const input = { amountMl: 250, consumedAt: instant };
  const results = await Promise.all([
    write("post", "water-entries", input, 1, key),
    write(
      "post",
      "water-entries",
      { consumedAt: instant, amountMl: 250 },
      1,
      key.toUpperCase(),
    ),
  ]);
  expect(results.map((r) => r.status)).toEqual([201, 201]);
  expect(results[0]!.body).toEqual(results[1]!.body);
  const distinct = await write("post", "water-entries", input).expect(201);
  expect(distinct.body.id).not.toBe(results[0]!.body.id);
  const foreign = await write(
    "post",
    "water-entries",
    input,
    1,
    key,
    b.cookie,
  ).expect(201);
  expect(foreign.body.id).not.toBe(results[0]!.body.id);
  const conflict = await write(
    "post",
    "water-entries",
    { ...input, amountMl: 500 },
    1,
    key,
  ).expect(409);
  expect(conflict.body.error.code).toBe("IDEMPOTENCY_CONFLICT");
  await write("post", "categories", { name: "Another command" }, 1, key).expect(
    409,
  );
  const deleteKey = randomUUID();
  const path = "water-entries/" + distinct.body.id;
  await write("delete", path, {}, 1, deleteKey).expect(200);
  await write("delete", path, {}, 1, deleteKey).expect(200);
  await read(path).expect(404);
  await request(app)
    .post("/api/v1/water-entries")
    .set("Cookie", a.cookie)
    .set("Origin", origin)
    .send(input)
    .expect(400);
});

it("recovers a committed command after a lost response and a new server instance", async () => {
  const key = randomUUID();
  const broken = await serve({
    writes: {
      execute: async (...args) => {
        await deps.writes.execute(...args);
        throw new Error("Simulated transport failure after commit");
      },
    },
  });
  await request(broken)
    .post("/api/v1/cardio-activities")
    .set("Cookie", a.cookie)
    .set("Origin", origin)
    .set("Idempotency-Key", key)
    .send(cardioInput)
    .expect(500);
  const restarted = await serve();
  const retried = await request(restarted)
    .post("/api/v1/cardio-activities")
    .set("Cookie", a.cookie)
    .set("Origin", origin)
    .set("Idempotency-Key", key)
    .send(cardioInput)
    .expect(201);
  const receipt = await deps.pool.query(
    "select response from write_receipts where user_id=$1 and key=$2",
    [a.id, key],
  );
  expect(receipt.rows[0].response).toEqual(retried.body);
  const sources = await deps.pool.query(
    "select count(*)::int as count from time_entries where user_id=$1 and source_id=$2",
    [a.id, retried.body.id],
  );
  expect(sources.rows[0].count).toBe(1);
});

it("rolls back the activity and time ledger when storing its receipt fails; the same key can retry", async () => {
  const key = randomUUID();
  await deps.pool
    .query(`CREATE FUNCTION integrity_receipt_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.key = '${key}'::uuid THEN RAISE EXCEPTION 'Synthetic receipt failure'; END IF; RETURN NEW; END $$`);
  await deps.pool.query(
    "CREATE TRIGGER integrity_receipt_failure BEFORE INSERT ON write_receipts FOR EACH ROW EXECUTE FUNCTION integrity_receipt_failure()",
  );
  const count = async () =>
    (
      await deps.pool.query(
        "select (select count(*) from cardio_activities where user_id=$1) as activities, (select count(*) from time_entries where user_id=$1) as entries",
        [a.id],
      )
    ).rows[0];
  try {
    const before = await count();
    await write("post", "cardio-activities", cardioInput, 1, key).expect(500);
    expect(await count()).toEqual(before);
  } finally {
    await deps.pool.query(
      "DROP TRIGGER integrity_receipt_failure ON write_receipts",
    );
    await deps.pool.query("DROP FUNCTION integrity_receipt_failure()");
  }
  await write("post", "cardio-activities", cardioInput, 1, key).expect(201);
});

it("enforces numeric/enumeration/source/snapshot/ownership rules even when SQL bypasses request validation", async () => {
  const food = await write("post", "foods", foodInput).expect(201);
  const log = await write("post", "food-entries", {
    foodId: food.body.id,
    quantity: 1,
    consumedAt: instant,
  }).expect(201);
  const block = await write("post", "time-blocks", blockInput).expect(201);
  const weight = await write("post", "weight-entries", {
    weightKg: 70,
    measuredAt: instant,
  }).expect(201);
  const category = await write("post", "categories", {
    name: "Immutable owner",
  }).expect(201);
  const invalid: [string, unknown[]][] = [
    [
      "update weight_entries set weight_kg='NaN' where user_id=$1 and id=$2",
      [a.id, weight.body.id],
    ],
    [
      "update weight_entries set weight_kg='Infinity' where user_id=$1 and id=$2",
      [a.id, weight.body.id],
    ],
    [
      "insert into water_entries(user_id,amount_ml,consumed_at) values($1,10001,now())",
      [a.id],
    ],
    [
      "insert into goals(user_id,title,status) values($1,'Goal','unsupported')",
      [a.id],
    ],
    [
      "insert into goals(user_id,title,status) values($1,'Goal','completed')",
      [a.id],
    ],
    [
      "update foods set serving_unit='cups' where user_id=$1 and id=$2",
      [a.id, food.body.id],
    ],
    [
      "update food_entries set quantity='NaN' where user_id=$1 and id=$2",
      [a.id, log.body.id],
    ],
    [
      "update food_entries set calories_snapshot=1 where user_id=$1 and id=$2",
      [a.id, log.body.id],
    ],
    [
      "insert into time_entries(user_id,title,starts_at,ends_at,source_type,source_id) values($1,'Bad source',now(),now()+interval '1 hour','manual',$2)",
      [a.id, randomUUID()],
    ],
    [
      "insert into time_entries(user_id,title,starts_at,ends_at,source_type) values($1,'Missing source',now(),now()+interval '1 hour','cardio_activity')",
      [a.id],
    ],
    [
      "insert into cardio_activities(user_id,title,activity_type,started_at,duration_seconds) values($1,'Bad type','unsupported',now(),60)",
      [a.id],
    ],
    ["update categories set user_id=$1 where id=$2", [b.id, category.body.id]],
  ];
  for (const [query, params] of invalid)
    await expect(deps.pool.query(query, params)).rejects.toMatchObject({
      code: "23514",
    });
  for (const table of ["strength_workouts", "cardio_activities"]) {
    const fields =
      table === "cardio_activities" ? ",activity_type,duration_seconds" : "";
    const values = table === "cardio_activities" ? ",'run',60" : "";
    await expect(
      deps.pool.query(
        `insert into ${table}(user_id,title,started_at,linked_time_block_id${fields}) values($1,'Foreign link',now(),$2${values})`,
        [b.id, block.body.id],
      ),
    ).rejects.toMatchObject({ code: "23503" });
  }
  const retained = await read("food-entries/" + log.body.id).expect(200);
  expect(retained.body.caloriesSnapshot).toBe(300);
  expect(retained.body.proteinGSnapshot).toBeNull();
});

it("deleting a planned block detaches activity links and advances their revisions without losing history", async () => {
  const block = await write("post", "time-blocks", blockInput).expect(201);
  const workout = await write("post", "strength-workouts", {
    title: "Linked workout",
    startedAt: instant,
    linkedTimeBlockId: block.body.id,
  }).expect(201);
  const cardio = await write("post", "cardio-activities", {
    ...cardioInput,
    linkedTimeBlockId: block.body.id,
  }).expect(201);
  const entry = await write("post", "time-entries", {
    ...blockInput,
    timeBlockId: block.body.id,
  }).expect(201);
  await write("delete", "time-blocks/" + block.body.id).expect(200);
  for (const [family, row, field] of [
    ["strength-workouts", workout.body, "linkedTimeBlockId"],
    ["cardio-activities", cardio.body, "linkedTimeBlockId"],
    ["time-entries", entry.body, "timeBlockId"],
  ] as const) {
    const retained = await read(family + "/" + row.id).expect(200);
    expect(retained.body[field]).toBeNull();
    expect(retained.body.version).toBe(row.version + 1);
    await write("delete", family + "/" + row.id, {}, row.version).expect(409);
  }
});

it("reads a workout aggregate from one snapshot even if a save commits between its SQL reads", async () => {
  const exercise = await write("post", "exercises", {
    name: "Snapshot squat",
  }).expect(201);
  const workout = await write("post", "strength-workouts", {
    title: "Before",
    startedAt: instant,
  }).expect(201);
  const base = {
    title: "Before",
    startedAt: instant,
    endedAt: null,
    exercises: [
      { exerciseId: exercise.body.id, sets: [{ reps: 5, completed: true }] },
    ],
  };
  const first = await write(
    "put",
    "strength-workouts/" + workout.body.id,
    base,
    1,
  ).expect(200);
  const client = await deps.pool.connect();
  const original = client.query.bind(client);
  let release!: () => void;
  let reached!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const paused = new Promise<void>((resolve) => {
    reached = resolve;
  });
  let intercepted = false;
  const spy = vi.spyOn(client, "query").mockImplementation(((
    config: QueryConfig,
    values: unknown[],
  ) => {
    if (
      !intercepted &&
      config.text?.includes('from "strength_workout_exercises"')
    ) {
      intercepted = true;
      reached();
      return gate.then(() => original(config, values));
    }
    return original(config, values);
  }) as typeof client.query);
  const reading = strengthRepository(drizzle(client)).get(
    a.id,
    workout.body.id,
  );
  try {
    await paused;
    await write(
      "put",
      "strength-workouts/" + workout.body.id,
      { ...base, title: "After", exercises: [] },
      first.body.version,
    ).expect(200);
    release();
    const result = await reading;
    expect(result?.title).toBe("Before");
    expect(result?.exercises).toHaveLength(1);
    expect(result?.exercises[0]?.sets[0]?.reps).toBe(5);
    expect(
      (await read("strength-workouts/" + workout.body.id)).body.exercises,
    ).toEqual([]);
  } finally {
    release();
    await reading;
    spy.mockRestore();
    client.release();
  }
});

async function waitForBlocked(pid: number, count: number) {
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    const result = await deps.pool.query(
      "with recursive blocked(pid) as (values($1::int) union select a.pid from pg_stat_activity a join blocked b on b.pid=any(pg_blocking_pids(a.pid))) select (count(*)-1)::int as count from blocked",
      [pid],
    );
    if (result.rows[0].count >= count) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(
    "The competing commands did not reach the expected database lock",
  );
}

it("serializes archive versus food logging so a newly archived definition cannot be logged", async () => {
  const food = await write("post", "foods", foodInput).expect(201);
  const blocker = await deps.pool.connect();
  await blocker.query("begin");
  await blocker.query(
    "select id from foods where user_id=$1 and id=$2 for update",
    [a.id, food.body.id],
  );
  const pid = (await blocker.query("select pg_backend_pid() as pid")).rows[0]
    .pid as number;
  const archive = write("post", "foods/" + food.body.id + "/archive").then(
    (r) => r,
  );
  let logging: Promise<request.Response> | undefined;
  try {
    await waitForBlocked(pid, 1);
    logging = write("post", "food-entries", {
      foodId: food.body.id,
      consumedAt: instant,
      quantity: 1,
    }).then((r) => r);
    await waitForBlocked(pid, 2);
    await blocker.query("commit");
    expect((await archive).status).toBe(200);
    const rejected = await logging;
    expect(rejected.status).toBe(422);
    expect(rejected.body.error.code).toBe("BUSINESS_RULE");
    expect(
      (
        await deps.pool.query(
          "select count(*)::int as count from food_entries where user_id=$1 and food_id=$2",
          [a.id, food.body.id],
        )
      ).rows[0].count,
    ).toBe(0);
  } finally {
    await blocker.query("rollback");
    blocker.release();
    await Promise.allSettled([archive, logging]);
  }
});

it("serializes deletion of a planned block against linking a new activity", async () => {
  const block = await write("post", "time-blocks", blockInput).expect(201);
  const blocker = await deps.pool.connect();
  await blocker.query("begin");
  await blocker.query(
    "select id from time_blocks where user_id=$1 and id=$2 for update",
    [a.id, block.body.id],
  );
  const pid = (await blocker.query("select pg_backend_pid() as pid")).rows[0]
    .pid as number;
  const deleting = write("delete", "time-blocks/" + block.body.id).then(
    (r) => r,
  );
  let linking: Promise<request.Response> | undefined;
  try {
    await waitForBlocked(pid, 1);
    linking = write("post", "cardio-activities", {
      ...cardioInput,
      linkedTimeBlockId: block.body.id,
    }).then((r) => r);
    await waitForBlocked(pid, 2);
    await blocker.query("commit");
    expect((await deleting).status).toBe(200);
    expect((await linking).status).toBe(404);
    expect(
      (
        await deps.pool.query(
          "select count(*)::int as count from cardio_activities where user_id=$1 and linked_time_block_id=$2",
          [a.id, block.body.id],
        )
      ).rows[0].count,
    ).toBe(0);
  } finally {
    await blocker.query("rollback");
    blocker.release();
    await Promise.allSettled([deleting, linking]);
  }
});
