import type { Page, SearchRecord, Week } from "@168hours/contracts";
import { it, expect } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { localMinute } from "@168hours/domain-utils";
import { commandHeaders, testApp, origin } from "./helpers.js";
const { app, signUp, deps } = testApp();
const block = {
  title: "Focus",
  categoryId: null,
  goalId: null,
  notes: null,
  startsAt: "2026-09-07T09:00:00Z",
  endsAt: "2026-09-07T10:00:00Z",
};
const rule = {
  title: "Repeat",
  categoryId: null,
  goalId: null,
  notes: null,
  timezone: "America/Edmonton",
  startDate: "2026-03-07",
  untilDate: "2026-03-09",
  startMinute: 150,
  durationMinutes: 60,
  frequency: "daily",
  interval: 1,
  weekdays: [1],
};
function api(cookie: string) {
  return {
    get: (path: string) =>
      request(app)
        .get("/api/v1/" + path)
        .set("Cookie", cookie),
    post: (
      path: string,
      data: object,
      version = 1,
      headers = commandHeaders(version),
    ) =>
      request(app)
        .post("/api/v1/" + path)
        .set("Cookie", cookie)
        .set("Origin", origin)
        .set(headers)
        .send(data),
    put: (path: string, data: object, version = 1) =>
      request(app)
        .put("/api/v1/" + path)
        .set("Cookie", cookie)
        .set("Origin", origin)
        .set(commandHeaders(version))
        .send(data),
    del: (path: string, version = 1) =>
      request(app)
        .delete("/api/v1/" + path)
        .set("Cookie", cookie)
        .set("Origin", origin)
        .set(commandHeaders(version)),
  };
}
it("materializes local recurrence, protects series revisions, and preserves actuals and deleted exceptions", async () => {
  const a = api((await signUp()).cookie),
    b = api((await signUp()).cookie),
    headers = commandHeaders();
  const created = await a.post("calendar/series", rule, 1, headers).expect(201);
  expect(created.body.count).toBe(2);
  expect(created.body.skippedDates).toEqual(["2026-03-08"]);
  expect((await a.post("calendar/series", rule, 1, headers)).body).toEqual(
    created.body,
  );
  const id = created.body.series.id;
  await b.get("calendar/series/" + id).expect(404);
  await b.put("calendar/series/" + id, rule).expect(404);
  await b.del("calendar/series/" + id).expect(404);
  const all = (await a.get("calendar/search?q=Repeat").expect(200)).body.items;
  expect(all).toHaveLength(2);
  const first = all.find(
    (r: { item: { occurrenceDate: string } }) =>
      r.item.occurrenceDate === "2026-03-07",
  ).item;
  const second = all.find(
    (r: { item: { id: string } }) => r.item.id !== first.id,
  ).item;
  const actual = await a
    .post("time-entries", {
      title: "Actual",
      categoryId: null,
      timeBlockId: first.id,
      startsAt: first.startsAt,
      endsAt: first.endsAt,
    })
    .expect(201);
  const edited = await a
    .put(
      "time-blocks/" + first.id,
      { ...block, title: "Exception" },
      first.version,
    )
    .expect(200);
  expect(edited.body.isException).toBe(true);
  await a
    .put("calendar/series/" + id, rule, created.body.series.version)
    .expect(409);
  await a.del("time-blocks/" + second.id, second.version).expect(200);
  const latest = (await a.get("calendar/series/" + id)).body;
  expect(latest.excludedDates).toEqual(["2026-03-09"]);
  const updated = await a
    .put(
      "calendar/series/" + id,
      { ...rule, title: "Whole series", startMinute: 540 },
      latest.version,
    )
    .expect(200);
  expect(updated.body.count).toBe(2); // March 8 now has a valid local time; March 9 remains excluded.
  const restored = (await a.get("time-blocks/" + first.id)).body;
  expect(restored.title).toBe("Whole series");
  expect(restored.isException).toBe(false);
  expect((await a.get("time-entries/" + actual.body.id)).body.startsAt).toBe(
    first.startsAt,
  );
  await a.del("calendar/series/" + id, updated.body.series.version).expect(200);
  expect(
    (await a.get("time-entries/" + actual.body.id)).body.timeBlockId,
  ).toBeNull();
  expect(
    (await a.get("calendar/search?q=Whole%20series")).body.items,
  ).toHaveLength(0);
});
it("keeps date-only items outside time totals and schedules atomically with ownership and retry protection", async () => {
  const owner = await signUp(),
    other = await signUp(),
    a = api(owner.cookie),
    b = api(other.cookie);
  const v = {
    title: "Holiday",
    categoryId: null,
    goalId: null,
    notes: null,
    kind: "all_day",
    date: "2026-09-07",
    endDate: "2026-09-09",
  };
  const item = (await a.post("calendar/items", v).expect(201)).body;
  expect((await a.get("weeks/2026-09-07")).body.plannedSeconds).toBe(0);
  expect(
    (await a.get("calendar/items?from=2026-09-08&to=2026-09-08")).body,
  ).toHaveLength(1);
  await b.get("calendar/items/" + item.id).expect(404);
  await b.put("calendar/items/" + item.id, v).expect(404);
  await b.del("calendar/items/" + item.id).expect(404);
  await b.post("calendar/items/" + item.id + "/schedule", block).expect(404);
  await a.post("calendar/items", { ...v, endDate: null }).expect(422);
  await expect(
    deps.pool.query(
      "insert into calendar_items(user_id,title,kind,date,end_date) values($1,'Invalid','all_day','2026-09-10','2026-09-09')",
      [owner.id],
    ),
  ).rejects.toMatchObject({ code: "23514" });
  const foreignCat = (
    await b.post("categories", { name: "Private" }).expect(201)
  ).body;
  await a
    .post("calendar/items/" + item.id + "/schedule", {
      ...block,
      categoryId: foreignCat.id,
    })
    .expect(404);
  await a.get("calendar/items/" + item.id).expect(200);
  expect((await a.get("weeks/2026-09-07")).body.blocks).toHaveLength(0);
  const headers = commandHeaders(item.version);
  const scheduled = await a
    .post(
      "calendar/items/" + item.id + "/schedule",
      block,
      item.version,
      headers,
    )
    .expect(201);
  expect(
    (
      await a.post(
        "calendar/items/" + item.id + "/schedule",
        block,
        item.version,
        headers,
      )
    ).body,
  ).toEqual(scheduled.body);
  await a.get("calendar/items/" + item.id).expect(404);
  expect((await a.get("weeks/2026-09-07")).body.blocks).toHaveLength(1);
  const unscheduled = (
    await a.post("calendar/items", {
      ...v,
      title: "Later",
      kind: "unscheduled",
      date: null,
      endDate: null,
    })
  ).body;
  expect(
    (await a.get("calendar/backlog")).body.items.map(
      (x: { id: string }) => x.id,
    ),
  ).toContain(unscheduled.id);
  const changed = await a
    .put(
      "calendar/items/" + unscheduled.id,
      { ...v, title: "Dated", kind: "unscheduled", endDate: null },
      unscheduled.version,
    )
    .expect(200);
  await a
    .del("calendar/items/" + unscheduled.id, unscheduled.version)
    .expect(409);
  await a
    .del("calendar/items/" + unscheduled.id, changed.body.version)
    .expect(200);
});
it("copies reviewed plans, applies reusable templates, and paginates literal history searches without leaking owners", async () => {
  const a = api((await signUp()).cookie),
    b = api((await signUp()).cookie);
  const first = (
    await a.post("time-blocks", { ...block, title: "100% focus" }).expect(201)
  ).body;
  await a
    .post("calendar/items", {
      title: "Day plan",
      categoryId: null,
      goalId: null,
      notes: null,
      kind: "all_day",
      date: "2026-09-07",
      endDate: "2026-09-08",
    })
    .expect(201);
  await a
    .post("time-entries", {
      title: "Actual only",
      categoryId: null,
      timeBlockId: first.id,
      startsAt: block.startsAt,
      endsAt: block.endsAt,
    })
    .expect(201);
  const v = {
    sourceDate: "2026-09-07",
    targetDate: "2026-09-14",
    span: "week",
  };
  const preview = (
    await a.get("calendar/copy-preview?" + new URLSearchParams(v))
  ).body;
  expect(preview.blocks).toHaveLength(1);
  expect(preview.items).toHaveLength(1);
  await a
    .put(
      "time-blocks/" + first.id,
      { ...block, title: "Changed" },
      first.version,
    )
    .expect(200);
  await a.post("calendar/copy", { ...v, token: preview.token }).expect(409);
  const latest = (
    await a.get("calendar/copy-preview?" + new URLSearchParams(v))
  ).body;
  await b.post("calendar/copy", { ...v, token: latest.token }).expect(409);
  const headers = commandHeaders();
  const copy = await a
    .post("calendar/copy", { ...v, token: latest.token }, 1, headers)
    .expect(201);
  expect(copy.body.count).toBe(2);
  expect(
    (await a.post("calendar/copy", { ...v, token: latest.token }, 1, headers))
      .body,
  ).toEqual(copy.body);
  expect((await a.get("weeks/2026-09-14")).body.entries).toHaveLength(0);
  const template = (
    await a
      .post("calendar/templates", {
        name: "Routine",
        sourceDate: v.sourceDate,
        span: "week",
      })
      .expect(201)
  ).body;
  expect(template.entries).toHaveLength(2);
  expect(template.version).toBeGreaterThan(1);
  for (const path of [
    "calendar/templates/" + template.id,
    "calendar/templates/" + template.id + "/preview?targetDate=2026-09-21",
  ])
    await b.get(path).expect(404);
  await b
    .post(
      "calendar/templates/" + template.id + "/apply",
      { targetDate: "2026-09-21", preferencesVersion: 1 },
      template.version,
    )
    .expect(404);
  await b
    .put(
      "calendar/templates/" + template.id,
      { name: "Stolen" },
      template.version,
    )
    .expect(404);
  await b
    .del("calendar/templates/" + template.id, template.version)
    .expect(404);
  const applied = await a
    .post(
      "calendar/templates/" + template.id + "/apply",
      { targetDate: "2026-09-21", preferencesVersion: 1 },
      template.version,
    )
    .expect(201);
  expect(applied.body.count).toBe(2);
  const renamed = (
    await a
      .put(
        "calendar/templates/" + template.id,
        { name: "New routine" },
        template.version,
      )
      .expect(200)
  ).body;
  await a
    .post(
      "calendar/templates/" + template.id + "/apply",
      { targetDate: "2026-09-28", preferencesVersion: 1 },
      template.version,
    )
    .expect(409);
  expect((await a.get("weeks/2026-09-28")).body.blocks).toHaveLength(0);
  const ids = new Set<string>();
  let cursor: string | null = null;
  do {
    const page: Page<SearchRecord> = (
      await a.get(
        "calendar/search?limit=1" + (cursor ? "&cursor=" + cursor : ""),
      )
    ).body;
    for (const r of page.items) {
      expect(ids.has(r.item.id)).toBe(false);
      ids.add(r.item.id);
    }
    cursor = page.nextCursor;
  } while (cursor);
  expect(ids.size).toBe(7);
  expect((await b.get("calendar/search?q=Changed")).body.items).toHaveLength(0);
  await a.post("time-blocks", { ...block, title: "100% literal" }).expect(201);
  expect((await a.get("calendar/search?q=%25")).body.items).toHaveLength(1);
  expect(
    (await a.get("calendar/search?kind=block&from=2026-09-21&to=2026-09-21"))
      .body.items,
  ).toHaveLength(1);
  await a.get("calendar/search?cursor=" + randomUUID()).expect(422);
  await a.del("calendar/templates/" + template.id, renamed.version).expect(200);
});

it("copies a selected plan or date range and repeats a multi-day template without copying activity", async () => {
  const a = api((await signUp()).cookie),
    b = api((await signUp()).cookie);
  const first = (
    await a.post("time-blocks", { ...block, title: "Work day 1" }).expect(201)
  ).body;
  await a
    .post("time-blocks", {
      ...block,
      title: "Work day 3",
      startsAt: "2026-09-09T09:00:00Z",
      endsAt: "2026-09-09T10:00:00Z",
    })
    .expect(201);
  await a
    .post("time-entries", {
      title: "Actual",
      categoryId: null,
      timeBlockId: first.id,
      startsAt: block.startsAt,
      endsAt: block.endsAt,
    })
    .expect(201);
  const single = {
    span: "single",
    sourceDate: "2026-09-07",
    sourceId: first.id,
    sourceKind: "block",
    targetDate: "2026-09-21",
  };
  const singlePreview = (
    await a
      .get("calendar/copy-preview?" + new URLSearchParams(single))
      .expect(200)
  ).body;
  expect(
    singlePreview.blocks.map((plan: { title: string }) => plan.title),
  ).toEqual(["Work day 1"]);
  await b
    .get("calendar/copy-preview?" + new URLSearchParams(single))
    .expect(404);
  await a
    .post("calendar/copy", { ...single, token: singlePreview.token })
    .expect(201);
  const range = {
    span: "range",
    sourceDate: "2026-09-07",
    sourceEndDate: "2026-09-10",
    targetDate: "2026-09-28",
  };
  const rangePreview = (
    await a
      .get("calendar/copy-preview?" + new URLSearchParams(range))
      .expect(200)
  ).body;
  expect(rangePreview.blocks).toHaveLength(2);
  expect(rangePreview.blocks[1].startsAt.slice(0, 10)).toBe("2026-09-30");
  expect(rangePreview.items).toHaveLength(0);
  const sparse = {
    ...range,
    sourceEndDate: "2026-09-09",
    targetDate: "2026-09-15",
    selectedDates: "2026-09-07,2026-09-09",
  };
  const sparsePreview = (
    await a
      .get("calendar/copy-preview?" + new URLSearchParams(sparse))
      .expect(200)
  ).body;
  expect(
    sparsePreview.blocks.map((plan: { startsAt: string }) =>
      plan.startsAt.slice(0, 10),
    ),
  ).toEqual(["2026-09-15", "2026-09-17"]);
  const duplicatePreview = (
    await a
      .get(
        "calendar/copy-preview?" +
          new URLSearchParams({ ...range, targetDate: range.sourceDate }),
      )
      .expect(200)
  ).body;
  expect(duplicatePreview.blocks).toHaveLength(0);
  expect(duplicatePreview.skipped).toBe(2);
  const selfPreview = (
    await a
      .get(
        "calendar/copy-preview?" +
          new URLSearchParams({
            ...single,
            targetDate: "2026-09-07",
            targetMinute: String(
              localMinute(block.startsAt, singlePreview.timezone) + 5,
            ),
          }),
      )
      .expect(200)
  ).body;
  expect(selfPreview.blocks).toHaveLength(0);
  expect(selfPreview.skipped).toBe(1);
  const copiedRange = (
    await a
      .post("calendar/copy", { ...range, token: rangePreview.token })
      .expect(201)
  ).body;
  expect(copiedRange.createdBlocks).toHaveLength(2);
  const copiedUndo = {
    blocks: copiedRange.createdBlocks.map(
      ({ id, version }: { id: string; version: number }) => ({ id, version }),
    ),
    items: [],
  };
  await b.post("calendar/copy/undo", copiedUndo).expect(404);
  await a
    .post("calendar/copy/undo", {
      ...copiedUndo,
      blocks: [
        copiedUndo.blocks[0],
        { ...copiedUndo.blocks[1], version: copiedUndo.blocks[1].version + 1 },
      ],
    })
    .expect(409);
  await a.get("time-blocks/" + copiedUndo.blocks[0].id).expect(200);
  await a.post("calendar/copy/undo", copiedUndo).expect(200);
  const allDay = (
    await a
      .post("calendar/items", {
        title: "Trip",
        kind: "all_day",
        date: "2026-09-12",
        endDate: "2026-09-13",
        categoryId: null,
        goalId: null,
        notes: null,
      })
      .expect(201)
  ).body;
  const allDayCopy = {
    span: "single",
    sourceDate: "2026-09-12",
    sourceId: allDay.id,
    sourceKind: "item",
    targetDate: "2026-09-20",
  };
  const allDayPreview = (
    await a
      .get("calendar/copy-preview?" + new URLSearchParams(allDayCopy))
      .expect(200)
  ).body;
  const copiedAllDay = (
    await a
      .post("calendar/copy", { ...allDayCopy, token: allDayPreview.token })
      .expect(201)
  ).body;
  expect(copiedAllDay.createdItems).toHaveLength(1);
  await a
    .post("calendar/copy/undo", {
      blocks: [],
      items: copiedAllDay.createdItems,
    })
    .expect(200);
  await a.get("calendar/items/" + copiedAllDay.createdItems[0].id).expect(404);
  const template = (
    await a
      .post("calendar/templates", {
        name: "Four-day shift",
        span: "range",
        sourceDate: "2026-09-07",
        sourceEndDate: "2026-09-10",
      })
      .expect(201)
  ).body;
  expect(template.rangeDays).toBe(4);
  const review = (
    await a
      .get(
        `calendar/templates/${template.id}/preview?targetDate=2026-10-05&cycles=2`,
      )
      .expect(200)
  ).body;
  expect(review.blocks).toHaveLength(4);
  expect(
    review.blocks.map((plan: { startsAt: string }) =>
      plan.startsAt.slice(0, 10),
    ),
  ).toEqual(["2026-10-05", "2026-10-07", "2026-10-09", "2026-10-11"]);
  await a
    .post(
      "calendar/templates/" + template.id + "/apply",
      {
        targetDate: "2026-10-05",
        cycles: 2,
        preferencesVersion: review.preferencesVersion,
      },
      template.version,
    )
    .expect(201);
  expect((await a.get("weeks/2026-10-05")).body.entries).toHaveLength(0);
});

it("serializes occurrence versus series edits and rejects a changed timezone after template preview", async () => {
  const owner = await signUp(),
    a = api(owner.cookie);
  const input = {
    ...rule,
    startDate: "2026-09-07",
    untilDate: "2026-09-08",
    startMinute: 540,
  };
  const series = (await a.post("calendar/series", input).expect(201)).body
    .series;
  const week = (await a.get("weeks/2026-09-07")).body as Week;
  const first = week.blocks[0]!;
  const outcomes = await Promise.all([
    a.put(
      "time-blocks/" + first.id,
      { ...block, title: "One occurrence" },
      first.version,
    ),
    a.put(
      "calendar/series/" + series.id,
      { ...input, title: "Whole series" },
      series.version,
    ),
  ]);
  expect(outcomes.map((r) => r.status).sort()).toEqual([200, 409]);
  const template = (
    await a
      .post("calendar/templates", {
        name: "Routine",
        sourceDate: "2026-09-07",
        span: "week",
      })
      .expect(201)
  ).body;
  const preview = (
    await a
      .get(
        "calendar/templates/" + template.id + "/preview?targetDate=2026-09-21",
      )
      .expect(200)
  ).body;
  const me = (await a.get("me")).body;
  await a
    .put(
      "preferences",
      {
        timezone: "America/Edmonton",
        weekStartsOn: 1,
        weightUnit: "kg",
        distanceUnit: "km",
      },
      me.preferences.version,
    )
    .expect(200);
  await a
    .post(
      "calendar/templates/" + template.id + "/apply",
      {
        targetDate: "2026-09-21",
        preferencesVersion: preview.preferencesVersion,
      },
      preview.version,
    )
    .expect(409);
  expect((await a.get("weeks/2026-09-21")).body.blocks).toHaveLength(0);
  await expect(
    deps.pool.query(
      "update time_blocks set occurrence_date='2026-09-10' where user_id=$1 and id=$2",
      [owner.id, first.id],
    ),
  ).rejects.toMatchObject({ code: "23514" });
  await expect(
    deps.pool.query(
      "insert into calendar_template_entries(user_id,template_id,title,kind,day_offset) values($1,$2,'Invalid','block',0)",
      [owner.id, template.id],
    ),
  ).rejects.toMatchObject({ code: "23514" });
  await deps.pool.query("delete from users where id=$1", [owner.id]);
  for (const table of [
    "calendar_series",
    "calendar_templates",
    "calendar_template_entries",
    "time_blocks",
  ]) {
    const result = await deps.pool.query<{ count: number }>(
      `select count(*)::int as count from ${table} where user_id=$1`,
      [owner.id],
    );
    expect(result.rows[0]!.count).toBe(0);
  }
});
