import { expect, it } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { testApp, commandHeaders, origin } from "./helpers.js";
const { app, signUp } = testApp();
function api(cookie: string) {
  return {
    get: (path: string) =>
      request(app)
        .get("/api/v1/" + path)
        .set("Cookie", cookie),
    post: (path: string, data: object, version = 1, key = randomUUID()) =>
      request(app)
        .post("/api/v1/" + path)
        .set("Cookie", cookie)
        .set("Origin", origin)
        .set({ ...commandHeaders(version), "Idempotency-Key": key })
        .send(data),
    put: (path: string, data: object, version = 1) =>
      request(app)
        .put("/api/v1/" + path)
        .set("Cookie", cookie)
        .set("Origin", origin)
        .set(commandHeaders(version))
        .send(data),
  };
}
const timed = {
  title: "First",
  startsAt: "2026-09-07T09:00:00Z",
  endsAt: "2026-09-07T10:00:00Z",
};
const allDay = {
  title: "Trip",
  kind: "all_day",
  date: "2026-09-07",
  endDate: "2026-09-09",
};

it("moves mixed selections atomically, retains identities/activity, and reverses the whole group with safe retries", async () => {
  const a = api((await signUp()).cookie),
    b = api((await signUp()).cookie);
  const first = (await a.post("time-blocks", timed).expect(201)).body;
  const second = (
    await a
      .post("time-blocks", {
        ...timed,
        title: "Second",
        startsAt: "2026-09-08T13:00:00Z",
        endsAt: "2026-09-08T14:30:00Z",
      })
      .expect(201)
  ).body;
  const item = (await a.post("calendar/items", allDay).expect(201)).body;
  const actual = (
    await a
      .post("time-entries", { ...timed, timeBlockId: first.id })
      .expect(201)
  ).body;
  const input = {
    timezone: "UTC",
    dayDelta: 1,
    minuteDelta: 30,
    plans: [
      { kind: "block", id: first.id, version: first.version },
      { kind: "block", id: second.id, version: second.version },
      { kind: "item", id: item.id, version: item.version },
    ],
  };
  await b.post("calendar/selection/move", input).expect(404);
  const key = randomUUID();
  const moved = (
    await a.post("calendar/selection/move", input, 1, key).expect(200)
  ).body;
  expect(
    (await a.post("calendar/selection/move", input, 1, key).expect(200)).body,
  ).toEqual(moved);
  expect((await a.get("time-blocks/" + first.id)).body.startsAt).toBe(
    "2026-09-08T09:30:00.000Z",
  );
  expect((await a.get("time-blocks/" + second.id)).body.endsAt).toBe(
    "2026-09-09T15:00:00.000Z",
  );
  expect((await a.get("calendar/items/" + item.id)).body).toMatchObject({
    date: "2026-09-08",
    endDate: "2026-09-10",
  });
  expect((await a.get("time-entries/" + actual.id)).body).toMatchObject({
    startsAt: actual.startsAt,
    endsAt: actual.endsAt,
    timeBlockId: first.id,
  });
  await b.post("calendar/selection/move/undo", moved).expect(404);
  const undone = (
    await a.post("calendar/selection/move/undo", moved).expect(200)
  ).body;
  expect((await a.get("time-blocks/" + first.id)).body).toMatchObject({
    startsAt: first.startsAt,
    endsAt: first.endsAt,
  });
  expect((await a.get("calendar/items/" + item.id)).body).toMatchObject({
    date: item.date,
    endDate: item.endDate,
  });
  const redone = (
    await a.post("calendar/selection/move/undo", undone).expect(200)
  ).body;
  expect(redone.blocks.map((p: { id: string }) => p.id).sort()).toEqual(
    [first.id, second.id].sort(),
  );
  expect((await a.get("time-blocks/" + first.id)).body.startsAt).toBe(
    "2026-09-08T09:30:00.000Z",
  );
  const changed = (await a.get("calendar/items/" + item.id)).body;
  await a
    .put(
      "calendar/items/" + item.id,
      {
        ...allDay,
        title: "External change",
        date: changed.date,
        endDate: changed.endDate,
      },
      changed.version,
    )
    .expect(200);
  await a.post("calendar/selection/move/undo", redone).expect(409);
  expect((await a.get("time-blocks/" + first.id)).body.startsAt).toBe(
    "2026-09-08T09:30:00.000Z",
  );
});

it("rolls back stale/missing-clock selections and respects timezone and recurrence changes", async () => {
  const a = api((await signUp()).cookie);
  const first = (
    await a
      .post("time-blocks", {
        ...timed,
        startsAt: "2026-03-07T08:00:00Z",
        endsAt: "2026-03-07T09:00:00Z",
      })
      .expect(201)
  ).body;
  const item = (await a.post("calendar/items", allDay).expect(201)).body;
  const me = (await a.get("me")).body;
  await a
    .put(
      "preferences",
      {
        timezone: "America/Edmonton",
        weekStartsOn: me.preferences.weekStartsOn,
        weightUnit: me.preferences.weightUnit,
        distanceUnit: me.preferences.distanceUnit,
      },
      me.preferences.version,
    )
    .expect(200);
  const missing = (
    await a
      .post("time-blocks", {
        ...timed,
        startsAt: "2026-03-07T09:30:00Z",
        endsAt: "2026-03-07T10:00:00Z",
      })
      .expect(201)
  ).body;
  const v = {
    timezone: "America/Edmonton",
    dayDelta: 1,
    minuteDelta: 0,
    plans: [
      { kind: "block", id: first.id, version: first.version },
      { kind: "block", id: missing.id, version: missing.version },
      { kind: "item", id: item.id, version: item.version },
    ],
  };
  await a
    .post("calendar/selection/move", { ...v, timezone: "UTC" })
    .expect(409);
  await a.post("calendar/selection/move", v).expect(422);
  expect((await a.get("time-blocks/" + first.id)).body.version).toBe(
    first.version,
  );
  await a
    .post("calendar/selection/move", {
      ...v,
      dayDelta: 2,
      plans: [...v.plans.slice(0, 2), { ...v.plans[2], version: 999 }],
    })
    .expect(409);
  expect((await a.get("time-blocks/" + first.id)).body.version).toBe(
    first.version,
  );
  const rule = {
    title: "Repeat",
    kind: "all_day",
    timezone: "America/Edmonton",
    startDate: "2026-09-07",
    untilDate: "2026-09-09",
    startMinute: 0,
    durationMinutes: 60,
    frequency: "daily",
    interval: 1,
    weekdays: [1],
  };
  const series = (await a.post("calendar/series", rule).expect(201)).body;
  const occurrence = (await a.get("calendar/items/" + series.items[0].id)).body;
  const moved = (
    await a
      .post("calendar/selection/move", {
        timezone: v.timezone,
        dayDelta: 1,
        minuteDelta: 0,
        plans: [
          { kind: "item", id: occurrence.id, version: occurrence.version },
        ],
      })
      .expect(200)
  ).body;
  expect((await a.get("calendar/items/" + occurrence.id)).body).toMatchObject({
    isException: true,
    occurrenceDate: occurrence.occurrenceDate,
  });
  const undone = (
    await a.post("calendar/selection/move/undo", moved).expect(200)
  ).body;
  expect((await a.get("calendar/items/" + occurrence.id)).body).toMatchObject({
    isException: false,
    date: occurrence.date,
  });
  const parent = (await a.get("calendar/series/" + series.series.id)).body;
  await a
    .put(
      "calendar/series/" + parent.id,
      { ...rule, title: "Different rule" },
      parent.version,
    )
    .expect(200);
  await a.post("calendar/selection/move/undo", undone).expect(409);
});
