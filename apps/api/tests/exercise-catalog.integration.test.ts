import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import { exerciseCatalogSchema, exerciseSchema } from "@168hours/contracts";
import {
  exercises,
  exercisePreferences,
} from "../src/modules/exercise/exercise.table.js";
import { testApp, origin, commandHeaders } from "./helpers.js";
const { app, deps, signUp } = testApp();
function client(cookie: string) {
  return {
    get: (path: string) =>
      request(app).get(`/api/v1/${path}`).set("Cookie", cookie),
    write: (
      method: "post" | "put" | "delete",
      path: string,
      data: object = {},
      version = 1,
      key = randomUUID(),
    ) =>
      request(app)
        [method](`/api/v1/${path}`)
        .set("Cookie", cookie)
        .set("Origin", origin)
        .set({ ...commandHeaders(version), "Idempotency-Key": key })
        .send(data),
  };
}
it("browses without writes, creates owner-scoped immutable references once and rejects built-in definition edits", async () => {
  const a = client((await signUp()).cookie),
    b = client((await signUp()).cookie);
  const catalog = exerciseCatalogSchema.parse(
    (await a.get("exercise-catalog").expect(200)).body,
  );
  expect(catalog).toHaveLength(16);
  expect(catalog.every((entry) => entry.exercise === null)).toBe(true);
  expect((await a.get("exercises")).body.items).toHaveLength(0);
  const key = randomUUID();
  const first = exerciseSchema.parse(
    (
      await a
        .write(
          "post",
          "exercises/from-catalog",
          { key: "barbell-bench-press" },
          1,
          key,
        )
        .expect(201)
    ).body,
  );
  expect(first).toMatchObject({
    source: "system",
    name: "Bench press",
    equipment: ["Barbell"],
    favourite: false,
    hidden: false,
    canDelete: false,
  });
  expect(
    (
      await a
        .write(
          "post",
          "exercises/from-catalog",
          { key: "barbell-bench-press" },
          1,
          key,
        )
        .expect(201)
    ).body.id,
  ).toBe(first.id);
  const concurrent = await Promise.all([
    a.write("post", "exercises/from-catalog", { key: "leg-extension" }),
    a.write("post", "exercises/from-catalog", { key: "leg-extension" }),
  ]);
  expect(concurrent.map((response) => response.status)).toEqual([201, 201]);
  expect(concurrent[0]!.body.id).toBe(concurrent[1]!.body.id);
  await a
    .write(
      "put",
      `exercises/${first.id}`,
      { name: "Changed", equipment: [], muscles: [] },
      first.version,
    )
    .expect(403);
  await a
    .write("post", `exercises/${first.id}/archive`, {}, first.version)
    .expect(403);
  await a
    .write("post", `exercises/${first.id}/restore`, {}, first.version)
    .expect(403);
  await a
    .write("delete", `exercises/${first.id}`, {}, first.version)
    .expect(403);
  await b.get(`exercises/${first.id}`).expect(404);
  await b
    .write(
      "put",
      `exercises/${first.id}/hidden`,
      { hidden: true },
      first.version,
    )
    .expect(404);
  const other = (
    await b
      .write("post", "exercises/from-catalog", { key: "barbell-bench-press" })
      .expect(201)
  ).body;
  expect(other.id).not.toBe(first.id);
  await a
    .write("post", "exercises/from-catalog", { key: "missing" })
    .expect(422);
  await a
    .write("post", "exercises", {
      name: "Forged",
      catalogKey: "barbell-bench-press",
      source: "system",
    })
    .expect(422);
  await expect(
    deps.db
      .update(exercises)
      .set({ name: "Forbidden direct edit" })
      .where(eq(exercises.id, first.id)),
  ).rejects.toThrow();
});
it("stores private favourites and hiding separately, retries safely, and hidden built-ins still work in workouts", async () => {
  const owner = await signUp(),
    a = client(owner.cookie),
    b = client((await signUp()).cookie);
  let row = (
    await a
      .write("post", "exercises/from-catalog", { key: "barbell-bench-press" })
      .expect(201)
  ).body;
  const key = randomUUID(),
    old = row.version;
  row = (
    await a
      .write(
        "put",
        `exercises/${row.id}/favourite`,
        { favourite: true },
        old,
        key,
      )
      .expect(200)
  ).body;
  expect(
    (
      await a
        .write(
          "put",
          `exercises/${row.id}/favourite`,
          { favourite: true },
          old,
          key,
        )
        .expect(200)
    ).body,
  ).toEqual(row);
  await a
    .write("put", `exercises/${row.id}/favourite`, { favourite: false }, old)
    .expect(409);
  row = (
    await a
      .write("put", `exercises/${row.id}/hidden`, { hidden: true }, row.version)
      .expect(200)
  ).body;
  expect(row).toMatchObject({
    favourite: true,
    hidden: true,
    archivedAt: null,
    source: "system",
  });
  expect((await a.get("exercises")).body.items).toHaveLength(0);
  expect(
    (
      await a.get(
        "exercises?archived=true&favourites=true&equipment=Barbell&muscle=Chest",
      )
    ).body.items.map((entry: { id: string }) => entry.id),
  ).toEqual([row.id]);
  expect(
    (
      await a
        .write("post", "exercises/from-catalog", { key: "barbell-bench-press" })
        .expect(201)
    ).body.hidden,
  ).toBe(true);
  expect(
    (await b.get("exercise-catalog")).body.every(
      (entry: { exercise: unknown }) => entry.exercise === null,
    ),
  ).toBe(true);
  const prefs = await deps.db
    .select()
    .from(exercisePreferences)
    .where(eq(exercisePreferences.userId, owner.id));
  expect(prefs).toHaveLength(1);
  expect(prefs[0]).toMatchObject({
    favourite: true,
    hidden: true,
    exerciseId: row.id,
  });
  const plan = (
    await a
      .write("post", "strength-plans", {
        title: "Hidden exercise still works",
        exercises: [{ exerciseId: row.id, sets: [{ targetReps: 8 }] }],
      })
      .expect(201)
  ).body;
  const session = (
    await a
      .write(
        "post",
        `strength-plans/${plan.id}/begin`,
        { startedAt: "2026-10-14T15:00:00Z" },
        plan.version,
      )
      .expect(201)
  ).body;
  expect(session.exercises[0].exerciseNameSnapshot).toBe("Bench press");
  row = (
    await a
      .write(
        "put",
        `exercises/${row.id}/hidden`,
        { hidden: false },
        row.version,
      )
      .expect(200)
  ).body;
  expect(row.favourite).toBe(true);
  expect((await a.get("exercises?favourites=true")).body.items).toHaveLength(1);
});
it("duplicates built-in and custom definitions into independent custom exercises without preferences or history", async () => {
  const a = client((await signUp()).cookie),
    b = client((await signUp()).cookie);
  const key = randomUUID();
  let copy = (
    await a
      .write(
        "post",
        "exercises/duplicate",
        { catalogKey: "barbell-bench-press" },
        1,
        key,
      )
      .expect(201)
  ).body;
  expect(copy).toMatchObject({
    source: "custom",
    catalogKey: null,
    name: "Bench press (copy)",
    equipment: ["Barbell"],
    muscles: ["Chest", "Shoulders", "Arms"],
    favourite: false,
    hidden: false,
    canDelete: true,
  });
  expect(
    (
      await a
        .write(
          "post",
          "exercises/duplicate",
          { catalogKey: "barbell-bench-press" },
          1,
          key,
        )
        .expect(201)
    ).body.id,
  ).toBe(copy.id);
  expect(
    (await a.get("exercise-catalog")).body.find(
      (entry: { key: string }) => entry.key === "barbell-bench-press",
    ).exercise,
  ).toBeNull();
  const version = copy.version;
  copy = (
    await a
      .write(
        "put",
        `exercises/${copy.id}`,
        {
          name: "My press",
          notes: "My setup",
          equipment: ["Dumbbells", "Bench"],
          muscles: ["Chest"],
          favourite: true,
        },
        copy.version,
      )
      .expect(200)
  ).body;
  await a
    .write("post", "exercises/duplicate", { exerciseId: copy.id, version })
    .expect(409);
  await b
    .write("post", "exercises/duplicate", {
      exerciseId: copy.id,
      version: copy.version,
    })
    .expect(404);
  const second = (
    await a
      .write("post", "exercises/duplicate", {
        exerciseId: copy.id,
        version: copy.version,
      })
      .expect(201)
  ).body;
  expect(second).toMatchObject({
    name: "My press (copy)",
    notes: "My setup",
    equipment: ["Dumbbells", "Bench"],
    muscles: ["Chest"],
    favourite: false,
    canDelete: true,
  });
  expect(
    (await a.get(`strength-progress/${second.id}`)).body.history.items,
  ).toHaveLength(0);
  expect((await a.get("exercise-catalog")).body[0].name).toBe("Bench press");
});
it("custom metadata and preferences save atomically, archive preserves favourites and unused deletion removes preferences", async () => {
  const owner = await signUp(),
    a = client(owner.cookie),
    b = client((await signUp()).cookie);
  let row = (
    await a
      .write("post", "exercises", {
        name: "Custom row",
        notes: null,
        equipment: ["Dumbbells", "Bench"],
        muscles: ["Back", "Arms"],
        favourite: true,
      })
      .expect(201)
  ).body;
  expect(row).toMatchObject({
    source: "custom",
    favourite: true,
    canDelete: true,
  });
  expect(
    (await a.get("exercises?equipment=Bench&muscle=Back&favourites=true")).body
      .items,
  ).toHaveLength(1);
  expect(
    (
      await a
        .get(
          "exercises?equipment=Cable,Bench&muscle=Chest,Back&favourites=true",
        )
        .expect(200)
    ).body.items.map((item: { id: string }) => item.id),
  ).toEqual([row.id]);
  expect(
    (await a.get("exercises?equipment=Cable&muscle=Chest,Back").expect(200))
      .body.items,
  ).toHaveLength(0);
  expect(
    (await a.get("exercises?equipment=Cable,Bench&muscle=Chest").expect(200))
      .body.items,
  ).toHaveLength(0);
  await a.get("exercises?muscle=Chest,Invalid").expect(422);
  expect(
    (
      await b
        .get("exercises?equipment=Cable,Bench&muscle=Chest,Back")
        .expect(200)
    ).body.items,
  ).toHaveLength(0);
  expect((await b.get("exercises?favourites=true")).body.items).toHaveLength(0);
  await a
    .write("put", `exercises/${row.id}/hidden`, { hidden: true }, row.version)
    .expect(422);
  row = (
    await a
      .write("post", `exercises/${row.id}/archive`, {}, row.version)
      .expect(200)
  ).body;
  expect(row.favourite).toBe(true);
  row = (
    await a
      .write("post", `exercises/${row.id}/restore`, {}, row.version)
      .expect(200)
  ).body;
  expect(row.favourite).toBe(true);
  row = (
    await a
      .write(
        "put",
        `exercises/${row.id}`,
        { name: row.name, equipment: [], muscles: [] },
        row.version,
      )
      .expect(200)
  ).body;
  expect(row).toMatchObject({ equipment: [], muscles: [], favourite: true });
  await a
    .write("post", "exercises", { name: "Bad", equipment: ["Invalid"] })
    .expect(422);
  await a
    .write("post", "exercises", { name: "Bad", muscles: ["Back", "Back"] })
    .expect(422);
  await b.write("delete", `exercises/${row.id}`, {}, row.version).expect(404);
  await a.write("delete", `exercises/${row.id}`, {}, row.version).expect(200);
  await a.get(`exercises/${row.id}`).expect(404);
  expect(
    await deps.db
      .select()
      .from(exercisePreferences)
      .where(eq(exercisePreferences.userId, owner.id)),
  ).toHaveLength(0);
});
it("rejects deletion of custom definitions referenced by saved workouts or history, preserving snapshots", async () => {
  const a = client((await signUp()).cookie);
  let row = (
    await a.write("post", "exercises", { name: "Historical row" }).expect(201)
  ).body;
  const plan = (
    await a
      .write("post", "strength-plans", {
        title: "Saved",
        exercises: [{ exerciseId: row.id, sets: [{ targetReps: 8 }] }],
      })
      .expect(201)
  ).body;
  expect((await a.get(`exercises/${row.id}`)).body.canDelete).toBe(false);
  await a.write("delete", `exercises/${row.id}`, {}, row.version).expect(422);
  await a
    .write("delete", `strength-plans/${plan.id}`, {}, plan.version)
    .expect(200);
  expect((await a.get(`exercises/${row.id}`)).body.canDelete).toBe(true);
  const started = (
    await a
      .write("post", "strength-workouts", {
        title: "Recorded",
        startedAt: "2026-10-14T15:00:00Z",
      })
      .expect(201)
  ).body;
  const session = (
    await a
      .write(
        "put",
        `strength-workouts/${started.id}`,
        {
          title: "Recorded",
          startedAt: started.startedAt,
          endedAt: "2026-10-14T15:30:00Z",
          linkedTimeBlockId: null,
          exercises: [
            {
              exerciseId: row.id,
              sets: [{ reps: 8, weightKg: 20, completed: true }],
            },
          ],
        },
        started.version,
      )
      .expect(200)
  ).body;
  await a.write("delete", `exercises/${row.id}`, {}, row.version).expect(422);
  row = (
    await a
      .write("put", `exercises/${row.id}`, { name: "Renamed row" }, row.version)
      .expect(200)
  ).body;
  expect(
    (await a.get(`strength-workouts/${session.id}`)).body.exercises[0]
      .exerciseNameSnapshot,
  ).toBe("Historical row");
  row = (
    await a
      .write("post", `exercises/${row.id}/archive`, {}, row.version)
      .expect(200)
  ).body;
  expect(row.canDelete).toBe(false);
  expect(
    (await a.get(`strength-progress/${row.id}`)).body.history.items,
  ).toHaveLength(1);
});

it("sorts before pagination with stable duplicate-name cursors and owner isolation", async () => {
  const a = client((await signUp()).cookie);
  const b = client((await signUp()).cookie);
  for (const name of ["Zebra", "alpha", "Alpha", "Middle", "Beta"])
    await a.write("post", "exercises", { name }).expect(201);
  await b.write("post", "exercises", { name: "AAA private" }).expect(201);
  for (const sort of ["name_asc", "name_desc"]) {
    const names: string[] = [],
      ids: string[] = [];
    let cursor: string | null = null;
    do {
      const result: {
        body: {
          items: { id: string; name: string }[];
          nextCursor: string | null;
        };
      } = await a
        .get(
          `exercises?sort=${sort}&limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
        )
        .expect(200);
      names.push(
        ...result.body.items.map((x: { name: string }) => x.name.toLowerCase()),
      );
      ids.push(...result.body.items.map((x: { id: string }) => x.id));
      cursor = result.body.nextCursor;
    } while (cursor);
    expect(names).toEqual(
      sort === "name_asc"
        ? ["alpha", "alpha", "beta", "middle", "zebra"]
        : ["zebra", "middle", "beta", "alpha", "alpha"],
    );
    expect(new Set(ids).size).toBe(5);
  }
  const first = await a.get("exercises?sort=name_asc&limit=2").expect(200);
  await a
    .get(
      `exercises?sort=name_desc&cursor=${encodeURIComponent(first.body.nextCursor)}`,
    )
    .expect(422);
  await a.get("exercises?sort=name_asc&cursor=invalid").expect(422);
  expect(
    (await a.get("exercises?sort=recent&limit=1").expect(200)).body.items[0]
      .name,
  ).toBe("Beta");
});
