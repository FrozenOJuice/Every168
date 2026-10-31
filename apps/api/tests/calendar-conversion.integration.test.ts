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
    put: (path: string, data: object, version: number) =>
      request(app)
        .put("/api/v1/" + path)
        .set("Cookie", cookie)
        .set("Origin", origin)
        .set(commandHeaders(version))
        .send(data),
  };
}
const timed = {
  title: "Trip",
  notes: "Original notes",
  startsAt: "2026-09-07T09:00:00Z",
  endsAt: "2026-09-09T17:00:00Z",
};
const allDay = {
  title: "Trip",
  notes: "Original notes",
  kind: "all_day",
  date: "2026-09-07",
  endDate: "2026-09-09",
};
it("converts one continuous plan with its identity, details and reversible recorded links, and rejects stale/foreign commands", async () => {
  const a = api((await signUp()).cookie),
    b = api((await signUp()).cookie);
  const source = (await a.post("time-blocks", timed).expect(201)).body;
  const actual = (
    await a
      .post("time-entries", {
        title: "Recorded",
        startsAt: "2026-09-07T09:00:00Z",
        endsAt: "2026-09-07T10:00:00Z",
        timeBlockId: source.id,
      })
      .expect(201)
  ).body;
  const input = {
    source: { kind: "block", id: source.id, version: source.version },
    target: { kind: "all_day", input: allDay },
    timezone: "UTC",
  };
  await b.post("calendar/plans/convert", input).expect(404);
  await a
    .post("calendar/plans/convert", {
      ...input,
      source: { ...input.source, version: 999 },
    })
    .expect(409);
  const key = randomUUID();
  const converted = (
    await a.post("calendar/plans/convert", input, 1, key).expect(200)
  ).body;
  expect(
    (await a.post("calendar/plans/convert", input, 1, key).expect(200)).body,
  ).toEqual(converted);
  await a.get("time-blocks/" + source.id).expect(404);
  const item = (await a.get("calendar/items/" + source.id)).body;
  expect(item).toMatchObject({
    id: source.id,
    title: source.title,
    notes: source.notes,
    date: allDay.date,
    endDate: allDay.endDate,
    createdAt: source.createdAt,
  });
  expect((await a.get("time-entries/" + actual.id)).body).toMatchObject({
    startsAt: actual.startsAt,
    endsAt: actual.endsAt,
  });
  const undo = (await a.post("calendar/series/undo", converted).expect(200))
    .body;
  expect((await a.get("time-blocks/" + source.id)).body).toMatchObject({
    startsAt: source.startsAt,
    endsAt: source.endsAt,
    notes: source.notes,
  });
  expect((await a.get("time-entries/" + actual.id)).body.timeBlockId).toBe(
    source.id,
  );
  const redo = (await a.post("calendar/series/undo", undo).expect(200)).body;
  expect((await a.get("calendar/items/" + source.id)).body.date).toBe(
    allDay.date,
  );
  const current = (await a.get("calendar/items/" + source.id)).body;
  const back = (
    await a
      .post("calendar/plans/convert", {
        source: { kind: "item", id: current.id, version: current.version },
        target: { kind: "timed", input: timed },
        timezone: "UTC",
      })
      .expect(200)
  ).body;
  expect((await a.get("time-blocks/" + source.id)).body).toMatchObject({
    startsAt: source.startsAt,
    endsAt: source.endsAt,
    createdAt: source.createdAt,
  });
  expect(back.blocks).toHaveLength(1);
  await a.post("calendar/series/undo", redo).expect(409);
});

it("keeps converted occurrences as mixed-mode exceptions and preserves/replaces them during rule changes", async () => {
  const a = api((await signUp()).cookie);
  const rule = {
    title: "Daily",
    notes: "Rule notes",
    timezone: "UTC",
    startDate: "2026-09-07",
    untilDate: "2026-09-09",
    startMinute: 540,
    durationMinutes: 60,
    frequency: "daily",
    interval: 1,
    weekdays: [1],
  };
  const created = (await a.post("calendar/series", rule).expect(201)).body;
  const source = (await a.get("time-blocks/" + created.blocks[0].id)).body;
  const conversion = (
    await a
      .post("calendar/plans/convert", {
        source: { kind: "block", id: source.id, version: source.version },
        target: {
          kind: "all_day",
          input: {
            ...allDay,
            title: source.title,
            date: source.occurrenceDate,
            endDate: source.occurrenceDate,
          },
        },
        timezone: "UTC",
      })
      .expect(200)
  ).body;
  expect((await a.get("calendar/items/" + source.id)).body).toMatchObject({
    seriesId: source.seriesId,
    occurrenceDate: source.occurrenceDate,
    isException: true,
  });
  const parent = (await a.get("calendar/series/" + source.seriesId)).body;
  await a
    .put(
      "calendar/series/" + parent.id,
      { ...rule, title: "Revised" },
      parent.version,
    )
    .expect(200);
  expect((await a.get("calendar/items/" + source.id)).body.title).toBe(
    source.title,
  );
  await a.get("time-blocks/" + source.id).expect(404);
  const latest = (await a.get("calendar/series/" + source.seriesId)).body;
  const replaced = (
    await a
      .put(
        "calendar/series/" + latest.id,
        { ...rule, preserveExceptions: false },
        latest.version,
      )
      .expect(200)
  ).body;
  await a.get("calendar/items/" + source.id).expect(404);
  expect((await a.get("time-blocks/" + source.id)).body.isException).toBe(
    false,
  );
  await a
    .post("calendar/series/undo", {
      undoId: replaced.undoId,
      blocks: replaced.blocks,
      items: replaced.items,
    })
    .expect(200);
  expect((await a.get("calendar/items/" + source.id)).body.isException).toBe(
    true,
  );
  await a.post("calendar/series/undo", conversion).expect(409);
  // An opposite-mode exception can also apply its own mode through the normal
  // occurrence edit endpoint, without frontend-specific conversion rules.
  const exception = (await a.get("calendar/items/" + source.id)).body;
  const currentParent = (await a.get("calendar/series/" + source.seriesId))
    .body;
  const scoped = (
    await a
      .post(
        "calendar/series/" + source.seriesId + "/change",
        {
          scope: "all",
          fromDate: exception.occurrenceDate,
          operation: "edit",
          preserveExceptions: true,
          occurrence: {
            kind: "item",
            id: exception.id,
            version: exception.version,
            item: {
              ...allDay,
              title: "Individual title",
              date: exception.date,
              endDate: exception.endDate,
            },
          },
        },
        currentParent.version,
      )
      .expect(200)
  ).body;
  expect(scoped.blocks).toHaveLength(0);
  expect(scoped.items).toHaveLength(3);
  expect((await a.get("calendar/items/" + source.id)).body).toMatchObject({
    title: "Individual title",
    isException: true,
  });
  await a
    .post("calendar/series/undo", {
      undoId: scoped.undoId,
      blocks: scoped.blocks,
      items: scoped.items,
    })
    .expect(200);
  expect((await a.get("calendar/series/" + source.seriesId)).body.kind).toBe(
    "timed",
  );
});

it("rejects conversion that would drop clock-gap occurrences or use another account's references, without partial changes", async () => {
  const a = api((await signUp()).cookie),
    b = api((await signUp()).cookie);
  const rule = {
    title: "Clock change",
    kind: "all_day",
    timezone: "America/Edmonton",
    startDate: "2027-03-13",
    untilDate: "2027-03-15",
    startMinute: 0,
    durationMinutes: 60,
    frequency: "daily",
    interval: 1,
    weekdays: [1],
  };
  const created = (await a.post("calendar/series", rule).expect(201)).body;
  const occurrences = (
    await a.get("calendar/items?from=2027-03-13&to=2027-03-16")
  ).body;
  const first = occurrences.find(
    (item: { date: string }) => item.date === "2027-03-13",
  );
  expect(first).toBeDefined();
  const source = (await a.get("calendar/items/" + first.id)).body;
  const input = {
    source: { kind: "item", id: source.id, version: source.version },
    scope: "all",
    seriesVersion: created.series.version,
    timezone: "UTC",
    target: {
      kind: "timed",
      input: {
        title: source.title,
        startsAt: "2027-03-13T09:30:00Z",
        endsAt: "2027-03-13T10:30:00Z",
      },
    },
  };
  const rejected = await a.post("calendar/plans/convert", input).expect(422);
  expect(rejected.body.error.code).toBe("CONVERSION_TIME");
  await a
    .post("calendar/plans/convert", { ...input, timezone: "America/Edmonton" })
    .expect(409);
  const foreign = (await b.post("categories", { name: "Private" }).expect(201))
    .body;
  await a
    .post("calendar/plans/convert", {
      ...input,
      scope: "this",
      target: {
        ...input.target,
        input: { ...input.target.input, categoryId: foreign.id },
      },
    })
    .expect(404);
  expect(
    (await a.get("calendar/items?from=2027-03-13&to=2027-03-15")).body,
  ).toHaveLength(3);
  expect((await a.get("calendar/items/" + source.id)).body.version).toBe(
    source.version,
  );
  expect(
    (await a.get("calendar/series/" + created.series.id)).body.version,
  ).toBe(created.series.version);
});

it("converts following/all occurrences as one change and reverses splits and preserved overrides", async () => {
  const a = api((await signUp()).cookie);
  const rule = {
    title: "Daily",
    kind: "all_day",
    dateSpan: 2,
    timezone: "America/Edmonton",
    startDate: "2026-10-30",
    untilDate: "2026-11-02",
    startMinute: 0,
    durationMinutes: 60,
    frequency: "daily",
    interval: 1,
    weekdays: [1],
  };
  const created = (await a.post("calendar/series", rule).expect(201)).body;
  const read = async () =>
    (await a.get("calendar/items?from=2026-10-30&to=2026-11-04")).body;
  const items = await read();
  const source = items[1],
    exception = items[3];
  await a
    .put(
      "calendar/items/" + exception.id,
      {
        ...allDay,
        title: "Individual",
        date: exception.date,
        endDate: exception.endDate,
      },
      exception.version,
    )
    .expect(200);
  const parent = (await a.get("calendar/series/" + created.series.id)).body;
  const input = {
    source: { kind: "item", id: source.id, version: source.version },
    target: {
      kind: "timed",
      input: {
        ...timed,
        title: "Daily",
        startsAt: "2026-10-31T15:00:00Z",
        endsAt: "2026-11-01T18:00:00Z",
      },
    },
    scope: "following",
    seriesVersion: parent.version,
    timezone: "UTC",
  };
  await a
    .post("calendar/plans/convert", { ...input, seriesVersion: 1 })
    .expect(409);
  const converted = (await a.post("calendar/plans/convert", input).expect(200))
    .body;
  const block = (await a.get("time-blocks/" + source.id)).body;
  expect(block).toMatchObject({
    startsAt: input.target.input.startsAt.replace("Z", ".000Z"),
    endsAt: input.target.input.endsAt.replace("Z", ".000Z"),
  });
  expect(block.seriesId).not.toBe(parent.id);
  expect((await a.get("calendar/items/" + exception.id)).body).toMatchObject({
    title: "Individual",
    seriesId: block.seriesId,
    isException: true,
  });
  expect((await a.get("calendar/items/" + items[0].id)).body.seriesId).toBe(
    parent.id,
  );
  const undone = (await a.post("calendar/series/undo", converted).expect(200))
    .body;
  expect(await read()).toHaveLength(4);
  await a.get("calendar/series/" + block.seriesId).expect(404);
  const redone = (await a.post("calendar/series/undo", undone).expect(200))
    .body;
  expect(redone.blocks).toHaveLength(2);
  expect(redone.items).toHaveLength(2);
  const now = (await a.get("time-blocks/" + source.id)).body;
  const currentParent = (await a.get("calendar/series/" + now.seriesId)).body;
  const whole = (
    await a
      .post("calendar/plans/convert", {
        source: { kind: "block", id: now.id, version: now.version },
        target: {
          kind: "all_day",
          input: {
            ...allDay,
            title: now.title,
            date: now.occurrenceDate,
            endDate: now.occurrenceDate,
          },
        },
        scope: "all",
        preserveExceptions: false,
        seriesVersion: currentParent.version,
        timezone: "UTC",
      })
      .expect(200)
  ).body;
  expect(whole.blocks).toEqual([]);
  expect(whole.items).toHaveLength(3);
});
