import { commandHeaders } from "./helpers.js";
import { it, expect } from "vitest";
import request from "supertest";
import { testApp, origin } from "./helpers.js";
const { app, signUp } = testApp();
const block = {
  title: "Focus",
  categoryId: null,
  goalId: null,
  notes: null,
  startsAt: "2026-09-07T09:00:00Z",
  endsAt: "2026-09-07T11:00:00Z",
};
it("persists plans and actuals, clips overlap coverage and isolates every planning resource", async () => {
  const a = await signUp(),
    b = await signUp();
  const post = (path: string, data: object, cookie = a.cookie) =>
    request(app)
      .post("/api/v1/" + path)
      .set("Cookie", cookie)
      .set("Origin", origin)
      .set(commandHeaders())
      .send(data);
  const cat = await post("categories", { name: "Learning" }).expect(201);
  const created = await post("time-blocks", {
    ...block,
    categoryId: cat.body.id,
  }).expect(201);
  await post("time-blocks", {
    ...block,
    startsAt: "2026-09-07T10:00:00Z",
    endsAt: "2026-09-07T12:00:00Z",
  }).expect(201);
  let week = await request(app)
    .get("/api/v1/weeks/2026-09-07")
    .set("Cookie", a.cookie)
    .expect(200);
  expect(week.body.plannedSeconds).toBe(14400);
  expect(week.body.coverageSeconds).toBe(10800);
  expect(week.body.overlapPairs).toHaveLength(1);
  expect(week.body.recordedSeconds).toBeNull();
  const actual = {
    title: "Focused work",
    categoryId: cat.body.id,
    timeBlockId: created.body.id,
    startsAt: block.startsAt,
    endsAt: "2026-09-07T10:30:00Z",
  };
  const entry = await post("time-entries", actual).expect(201);
  week = await request(app)
    .get("/api/v1/weeks/2026-09-07")
    .set("Cookie", a.cookie)
    .expect(200);
  expect(week.body.recordedSeconds).toBe(5400);
  for (const [family, id, input] of [
    ["categories", cat.body.id, { name: "Stolen" }],
    ["time-blocks", created.body.id, block],
    ["time-entries", entry.body.id, actual],
  ] as const) {
    await request(app)
      .get("/api/v1/" + family + "/" + id)
      .set("Cookie", b.cookie)
      .expect(404);
    await request(app)
      .put("/api/v1/" + family + "/" + id)
      .set("Cookie", b.cookie)
      .set("Origin", origin)
      .set(commandHeaders())
      .send(input)
      .expect(404);
    if (family === "categories")
      await post(family + "/" + id + "/archive", {}, b.cookie).expect(404);
    else
      await request(app)
        .delete("/api/v1/" + family + "/" + id)
        .set("Cookie", b.cookie)
        .set("Origin", origin)
        .set(commandHeaders())
        .expect(404);
  }
  await post(
    "time-blocks",
    { ...block, categoryId: cat.body.id },
    b.cookie,
  ).expect(404);
  await post("time-entries", actual, b.cookie).expect(404);
  await post("time-blocks", { ...block, endsAt: block.startsAt }).expect(422);
  const updated = await request(app)
    .put("/api/v1/time-blocks/" + created.body.id)
    .set("Cookie", a.cookie)
    .set("Origin", origin)
    .set(commandHeaders())
    .send({ ...block, title: "Updated", categoryId: cat.body.id })
    .expect(200);
  await post("categories/" + cat.body.id + "/archive", {}).expect(200);
  await request(app)
    .delete("/api/v1/time-blocks/" + created.body.id)
    .set("Cookie", a.cookie)
    .set("Origin", origin)
    .set(commandHeaders(updated.body.version))
    .expect(200);
  const surviving = await request(app)
    .get("/api/v1/time-entries/" + entry.body.id)
    .set("Cookie", a.cookie)
    .expect(200);
  expect(surviving.body.timeBlockId).toBeNull();
  await request(app)
    .delete("/api/v1/time-entries/" + entry.body.id)
    .set("Cookie", a.cookie)
    .set("Origin", origin)
    .set(commandHeaders(surviving.body.version))
    .expect(200);
  const other = await request(app)
    .get("/api/v1/weeks/2026-09-07")
    .set("Cookie", b.cookie)
    .expect(200);
  expect(other.body.blocks).toEqual([]);
});
