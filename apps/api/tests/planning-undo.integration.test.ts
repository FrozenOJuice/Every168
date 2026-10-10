import { expect, it } from "vitest";
import request from "supertest";
import { commandHeaders, origin, testApp } from "./helpers.js";

const { app, signUp } = testApp();
const plan = {
  title: "Undo plan",
  startsAt: "2026-09-07T15:00:00Z",
  endsAt: "2026-09-07T16:00:00Z",
};

it("undo restores original identity, details and manual/exercise links with safe ownership and retries", async () => {
  const a = await signUp(),
    b = await signUp();
  const post = (
    path: string,
    data: object,
    cookie = a.cookie,
    headers = commandHeaders(),
  ) =>
    request(app)
      .post("/api/v1/" + path)
      .set("Cookie", cookie)
      .set("Origin", origin)
      .set(headers)
      .send(data);
  const block = (await post("time-blocks", plan).expect(201)).body;
  const manual = (
    await post("time-entries", { ...plan, timeBlockId: block.id }).expect(201)
  ).body;
  const cardio = (
    await post("cardio-activities", {
      title: "Undo walk",
      activityType: "walk",
      startedAt: plan.startsAt,
      durationSeconds: 600,
      linkedTimeBlockId: block.id,
    }).expect(201)
  ).body;
  const draft = (
    await post("strength-workouts", {
      title: "Undo workout",
      startedAt: plan.startsAt,
      linkedTimeBlockId: block.id,
    }).expect(201)
  ).body;
  const deletion = await request(app)
    .delete("/api/v1/time-blocks/" + block.id)
    .set("Cookie", a.cookie)
    .set("Origin", origin)
    .set(commandHeaders(block.version))
    .expect(200);
  await request(app)
    .get("/api/v1/time-blocks/" + block.id)
    .set("Cookie", a.cookie)
    .expect(404);
  const undoPath = "time-block-deletions/" + deletion.body.undoId + "/undo";
  await post(undoPath, {}, b.cookie).expect(404);
  const key = commandHeaders();
  const restored = await post(undoPath, {}, a.cookie, key).expect(200);
  expect(restored.body).toMatchObject({
    id: block.id,
    title: block.title,
    startsAt: block.startsAt,
    endsAt: block.endsAt,
    version: block.version + 1,
  });
  expect((await post(undoPath, {}, a.cookie, key).expect(200)).body).toEqual(
    restored.body,
  );
  await post(undoPath, {}).expect(404);
  const read = (path: string) =>
    request(app)
      .get("/api/v1/" + path)
      .set("Cookie", a.cookie);
  expect((await read("time-entries/" + manual.id)).body.timeBlockId).toBe(
    block.id,
  );
  expect(
    (await read("cardio-activities/" + cardio.id)).body.linkedTimeBlockId,
  ).toBe(block.id);
  expect(
    (await read("strength-workouts/" + draft.id)).body.linkedTimeBlockId,
  ).toBe(block.id);
  expect((await read("weeks/2026-09-07")).body.entries).toHaveLength(2);
});

it("undo restores a repeating occurrence and rejects stale linked-record changes atomically", async () => {
  const a = await signUp();
  const post = (path: string, data: object) =>
    request(app)
      .post("/api/v1/" + path)
      .set("Cookie", a.cookie)
      .set("Origin", origin)
      .set(commandHeaders())
      .send(data);
  const series = await post("calendar/series", {
    title: "Undo routine",
    timezone: "America/Edmonton",
    startDate: "2026-09-07",
    untilDate: "2026-09-08",
    startMinute: 540,
    durationMinutes: 60,
    frequency: "daily",
    interval: 1,
    weekdays: [1],
  }).expect(201);
  const readWeek = () =>
    request(app).get("/api/v1/weeks/2026-09-07").set("Cookie", a.cookie);
  const block = (await readWeek()).body.blocks[0];
  const deletion = await request(app)
    .delete("/api/v1/time-blocks/" + block.id)
    .set("Cookie", a.cookie)
    .set("Origin", origin)
    .set(commandHeaders(block.version))
    .expect(200);
  const restored = await post(
    "time-block-deletions/" + deletion.body.undoId + "/undo",
    {},
  ).expect(200);
  expect(restored.body).toMatchObject({
    id: block.id,
    seriesId: block.seriesId,
    occurrenceDate: block.occurrenceDate,
    isException: false,
  });
  expect((await readWeek()).body.blocks).toHaveLength(2);
  expect(series.body).toBeDefined();
  const entry = (
    await post("time-entries", { ...plan, timeBlockId: block.id }).expect(201)
  ).body;
  const again = await request(app)
    .delete("/api/v1/time-blocks/" + block.id)
    .set("Cookie", a.cookie)
    .set("Origin", origin)
    .set(commandHeaders(restored.body.version))
    .expect(200);
  const current = (
    await request(app)
      .get("/api/v1/time-entries/" + entry.id)
      .set("Cookie", a.cookie)
  ).body;
  await request(app)
    .put("/api/v1/time-entries/" + entry.id)
    .set("Cookie", a.cookie)
    .set("Origin", origin)
    .set(commandHeaders(current.version))
    .send({ ...plan, title: "Corrected after deletion", timeBlockId: null })
    .expect(200);
  const conflict = await post(
    "time-block-deletions/" + again.body.undoId + "/undo",
    {},
  ).expect(409);
  expect(conflict.body.error.code).toBe("UNDO_CONFLICT");
  await request(app)
    .get("/api/v1/time-blocks/" + block.id)
    .set("Cookie", a.cookie)
    .expect(404);
});

it("undoes several edits and deletion of the same block, preserving exact recurrence state", async () => {
  const a = await signUp(),
    b = await signUp();
  const write = (
    method: "post" | "put" | "delete",
    path: string,
    data = {},
    version = 1,
    cookie = a.cookie,
    headers = commandHeaders(version),
  ) =>
    request(app)
      [method]("/api/v1/" + path)
      .set("Cookie", cookie)
      .set("Origin", origin)
      .set(headers)
      .send(data);
  await write("post", "calendar/series", {
    title: "Routine",
    timezone: "America/Edmonton",
    startDate: "2026-09-07",
    untilDate: "2026-09-08",
    startMinute: 540,
    durationMinutes: 60,
    frequency: "daily",
    interval: 1,
    weekdays: [1],
  }).expect(201);
  const week = () =>
    request(app).get("/api/v1/weeks/2026-09-07").set("Cookie", a.cookie);
  const [original, second] = (await week()).body.blocks;
  const input = {
    title: "Renamed",
    categoryId: null,
    goalId: null,
    notes: "Remember this",
    startsAt: original.startsAt,
    endsAt: original.endsAt,
  };
  const renamed = (
    await write(
      "put",
      "time-blocks/" + original.id,
      input,
      original.version,
    ).expect(200)
  ).body;
  const moved = (
    await write(
      "put",
      "time-blocks/" + original.id,
      {
        ...input,
        startsAt: "2026-09-07T17:00:00Z",
        endsAt: "2026-09-07T18:00:00Z",
      },
      renamed.version,
    ).expect(200)
  ).body;
  const removed = (
    await write(
      "delete",
      "time-blocks/" + original.id,
      {},
      moved.version,
    ).expect(200)
  ).body;
  const removedSecond = (
    await write(
      "delete",
      "time-blocks/" + second.id,
      {},
      second.version,
    ).expect(200)
  ).body;
  // Parent revisions advance throughout; independent occurrence undo remains safe.
  await write(
    "post",
    `time-block-deletions/${removedSecond.undoId}/undo`,
  ).expect(200);
  const restored = (
    await write("post", `time-block-deletions/${removed.undoId}/undo`).expect(
      200,
    )
  ).body;
  const undoMove = `time-block-edits/${moved.undoId}/undo`;
  await write("post", undoMove, {}, restored.version, b.cookie).expect(404);
  await write("post", undoMove, {}, moved.version).expect(409);
  const key = commandHeaders(restored.version);
  const unmoved = (
    await write("post", undoMove, {}, restored.version, a.cookie, key).expect(
      200,
    )
  ).body;
  expect(unmoved).toMatchObject({
    title: "Renamed",
    startsAt: original.startsAt,
    isException: true,
  });
  expect(
    (
      await write("post", undoMove, {}, restored.version, a.cookie, key).expect(
        200,
      )
    ).body,
  ).toEqual(unmoved);
  await write("post", undoMove, {}, unmoved.version).expect(404);
  const unrenamed = (
    await write(
      "post",
      `time-block-edits/${renamed.undoId}/undo`,
      {},
      unmoved.version,
    ).expect(200)
  ).body;
  expect(unrenamed).toMatchObject({
    title: original.title,
    notes: original.notes,
    startsAt: original.startsAt,
    endsAt: original.endsAt,
    isException: false,
  });
  expect((await week()).body.blocks).toHaveLength(2);
});

it("rejects undo after another edit without overwriting it", async () => {
  const a = await signUp();
  const write = (
    method: "post" | "put",
    path: string,
    data: object,
    version = 1,
  ) =>
    request(app)
      [method]("/api/v1/" + path)
      .set("Cookie", a.cookie)
      .set("Origin", origin)
      .set(commandHeaders(version))
      .send(data);
  const block = (await write("post", "time-blocks", plan).expect(201)).body;
  const edit = (
    await write(
      "put",
      "time-blocks/" + block.id,
      { ...plan, title: "My edit" },
      block.version,
    ).expect(200)
  ).body;
  const external = (
    await write(
      "put",
      "time-blocks/" + block.id,
      { ...plan, title: "Other tab" },
      edit.version,
    ).expect(200)
  ).body;
  await write(
    "post",
    `time-block-edits/${edit.undoId}/undo`,
    {},
    edit.version,
  ).expect(409);
  const conflict = await write(
    "post",
    `time-block-edits/${edit.undoId}/undo`,
    {},
    external.version,
  ).expect(409);
  expect(conflict.body.error.code).toBe("UNDO_CONFLICT");
  const current = await request(app)
    .get("/api/v1/time-blocks/" + block.id)
    .set("Cookie", a.cookie)
    .expect(200);
  expect(current.body.title).toBe("Other tab");
});

it("rejects edit/deletion undo after the recurring plan's rule changes", async () => {
  const a = await signUp();
  const write = (
    method: "post" | "put" | "delete",
    path: string,
    data: object,
    version = 1,
  ) =>
    request(app)
      [method]("/api/v1/" + path)
      .set("Cookie", a.cookie)
      .set("Origin", origin)
      .set(commandHeaders(version))
      .send(data);
  const rule = {
    title: "Routine",
    timezone: "America/Edmonton",
    startDate: "2026-09-07",
    untilDate: "2026-09-08",
    startMinute: 540,
    durationMinutes: 60,
    frequency: "daily",
    interval: 1,
    weekdays: [1],
  };
  const series = (await write("post", "calendar/series", rule).expect(201)).body
    .series;
  const [first, second] = (
    await request(app).get("/api/v1/weeks/2026-09-07").set("Cookie", a.cookie)
  ).body.blocks;
  const edited = (
    await write(
      "put",
      "time-blocks/" + first.id,
      { ...plan, title: "Exception" },
      first.version,
    ).expect(200)
  ).body;
  const deleted = (
    await write(
      "delete",
      "time-blocks/" + second.id,
      {},
      second.version,
    ).expect(200)
  ).body;
  const current = (
    await request(app)
      .get("/api/v1/calendar/series/" + series.id)
      .set("Cookie", a.cookie)
  ).body;
  await write(
    "put",
    "calendar/series/" + series.id,
    { ...rule, startMinute: 600 },
    current.version,
  ).expect(200);
  const changed = (
    await request(app)
      .get("/api/v1/time-blocks/" + first.id)
      .set("Cookie", a.cookie)
  ).body;
  expect(
    (
      await write(
        "post",
        `time-block-edits/${edited.undoId}/undo`,
        {},
        changed.version,
      ).expect(409)
    ).body.error.code,
  ).toBe("UNDO_CONFLICT");
  expect(
    (
      await write(
        "post",
        `time-block-deletions/${deleted.undoId}/undo`,
        {},
      ).expect(409)
    ).body.error.code,
  ).toBe("UNDO_CONFLICT");
});
