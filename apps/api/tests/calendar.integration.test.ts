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
      {
        ...rule,
        title: "Whole series",
        startMinute: 540,
        preserveExceptions: false,
      },
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
  expect(duplicatePreview.blocks).toHaveLength(2);
  const duplicate = (
    await a
      .post("calendar/copy", {
        ...range,
        targetDate: range.sourceDate,
        token: duplicatePreview.token,
      })
      .expect(201)
  ).body;
  expect(duplicate.createdBlocks).toHaveLength(2);
  expect(duplicate.createdBlocks[0].id).not.toBe(first.id);
  await a
    .post("calendar/copy/undo", {
      blocks: duplicate.createdBlocks.map(
        ({ id, version }: { id: string; version: number }) => ({ id, version }),
      ),
      items: [],
    })
    .expect(200);
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
  expect(selfPreview.blocks).toHaveLength(1);
  expect(selfPreview.blocks[0].startsAt).not.toBe(block.startsAt);
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
  const sameDayPreview = (
    await a
      .get(
        "calendar/copy-preview?" +
          new URLSearchParams({
            ...allDayCopy,
            targetDate: allDayCopy.sourceDate,
          }),
      )
      .expect(200)
  ).body;
  expect(sameDayPreview.items).toHaveLength(1);
  expect(sameDayPreview.items[0].date).toBe(allDay.date);
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

it("pastes captured plans after their sources change or disappear", async () => {
  const a = api((await signUp()).cookie);
  const b = api((await signUp()).cookie);
  const original = { ...block, title: "Before edit", notes: "Original notes" };
  const first = (await a.post("time-blocks", original).expect(201)).body;
  const later = {
    ...block,
    title: "Second block",
    startsAt: "2026-09-09T13:00:00Z",
    endsAt: "2026-09-09T14:00:00Z",
  };
  const second = (await a.post("time-blocks", later).expect(201)).body;
  const day = {
    title: "Day marker",
    kind: "all_day",
    date: "2026-09-08",
    endDate: "2026-09-08",
    categoryId: null,
    goalId: null,
    notes: null,
  };
  const item = (await a.post("calendar/items", day).expect(201)).body;
  const snapshot = {
    sourceDate: "2026-09-07",
    timezone: "UTC",
    blocks: [original, later],
    items: [day],
  };
  const changed = (
    await a
      .put(
        "time-blocks/" + first.id,
        {
          ...original,
          title: "After edit",
          startsAt: "2026-09-11T12:00:00Z",
          endsAt: "2026-09-11T13:00:00Z",
        },
        first.version,
      )
      .expect(200)
  ).body;
  await a.del("time-blocks/" + first.id, changed.version).expect(200);
  await a.del("time-blocks/" + second.id, second.version).expect(200);
  await a.del("calendar/items/" + item.id, item.version).expect(200);

  const single = {
    snapshot: { ...snapshot, blocks: [original], items: [] },
    targetDate: "2026-09-14",
  };
  const singlePreview = (
    await a.post("calendar/snapshot-preview", single).expect(200)
  ).body;
  expect(singlePreview.blocks[0].title).toBe("Before edit");
  expect(singlePreview.blocks[0].startsAt).toBe("2026-09-14T09:00:00Z");
  await b
    .post("calendar/snapshot-copy", { ...single, token: singlePreview.token })
    .expect(409);
  const singleCopy = (
    await a
      .post("calendar/snapshot-copy", { ...single, token: singlePreview.token })
      .expect(201)
  ).body;
  expect(singleCopy.createdBlocks).toHaveLength(1);
  expect(singleCopy.createdBlocks[0].id).not.toBe(first.id);
  expect(
    (await a.get("time-blocks/" + singleCopy.createdBlocks[0].id)).body.notes,
  ).toBe("Original notes");
  await a
    .post("calendar/copy/undo", {
      blocks: singleCopy.createdBlocks.map(
        ({ id, version }: { id: string; version: number }) => ({ id, version }),
      ),
      items: [],
    })
    .expect(200);

  const group = { snapshot, targetDate: "2026-09-21", targetMinute: 600 };
  const groupPreview = (
    await a.post("calendar/snapshot-preview", group).expect(200)
  ).body;
  expect(
    groupPreview.blocks.map((entry: { startsAt: string }) => entry.startsAt),
  ).toEqual(["2026-09-21T10:00:00Z", "2026-09-23T14:00:00Z"]);
  expect(groupPreview.items[0].date).toBe("2026-09-22");
  const groupCopy = (
    await a
      .post("calendar/snapshot-copy", { ...group, token: groupPreview.token })
      .expect(201)
  ).body;
  expect(groupCopy.count).toBe(3);
  await a
    .post("calendar/copy/undo", {
      blocks: groupCopy.createdBlocks.map(
        ({ id, version }: { id: string; version: number }) => ({ id, version }),
      ),
      items: groupCopy.createdItems,
    })
    .expect(200);
});
it("copies an arbitrary plan selection and deletes/restores a mixed group atomically", async () => {
  const a = api((await signUp()).cookie);
  const b = api((await signUp()).cookie);
  const first = (
    await a
      .post("time-blocks", {
        ...block,
        title: "First shift",
        startsAt: "2026-09-07T15:00:00Z",
        endsAt: "2026-09-07T16:00:00Z",
      })
      .expect(201)
  ).body;
  const linked = (
    await a
      .post("time-entries", {
        title: "Recorded first shift",
        categoryId: null,
        timeBlockId: first.id,
        startsAt: first.startsAt,
        endsAt: first.endsAt,
      })
      .expect(201)
  ).body;
  const second = (
    await a
      .post("time-blocks", {
        ...block,
        title: "Later shift",
        startsAt: "2026-09-09T19:00:00Z",
        endsAt: "2026-09-09T20:00:00Z",
      })
      .expect(201)
  ).body;
  const allDay = (
    await a
      .post("calendar/items", {
        title: "Conference",
        kind: "all_day",
        date: "2026-09-08",
        endDate: "2026-09-08",
      })
      .expect(201)
  ).body;
  const selection = {
    span: "selection",
    sourceDate: "2026-09-07",
    selectedPlans: `block:${first.id},item:${allDay.id},block:${second.id}`,
    targetDate: "2026-09-14",
    targetMinute: "600",
  };
  await b
    .get("calendar/copy-preview?" + new URLSearchParams(selection))
    .expect(404);
  const preview = (
    await a
      .get("calendar/copy-preview?" + new URLSearchParams(selection))
      .expect(200)
  ).body;
  expect(
    preview.blocks.map((plan: { startsAt: string }) => plan.startsAt),
  ).toEqual(["2026-09-14T10:00:00Z", "2026-09-16T14:00:00Z"]);
  expect(preview.items.map((plan: { date: string }) => plan.date)).toEqual([
    "2026-09-15",
  ]);
  const changed = (
    await a
      .put(
        "time-blocks/" + second.id,
        {
          title: second.title,
          categoryId: second.categoryId,
          goalId: second.goalId,
          notes: "Updated before paste",
          startsAt: second.startsAt,
          endsAt: second.endsAt,
        },
        second.version,
      )
      .expect(200)
  ).body;
  await a
    .post("calendar/copy", {
      ...selection,
      targetMinute: 600,
      token: preview.token,
    })
    .expect(409);
  const latest = (
    await a
      .get("calendar/copy-preview?" + new URLSearchParams(selection))
      .expect(200)
  ).body;
  const copied = (
    await a
      .post("calendar/copy", {
        ...selection,
        targetMinute: 600,
        token: latest.token,
      })
      .expect(201)
  ).body;
  expect(copied.count).toBe(3);
  await a
    .post("calendar/copy/undo", {
      blocks: copied.createdBlocks.map(
        ({ id, version }: { id: string; version: number }) => ({ id, version }),
      ),
      items: copied.createdItems,
    })
    .expect(200);
  const overlapping = (
    await a
      .get(
        "calendar/copy-preview?" +
          new URLSearchParams({
            ...selection,
            targetDate: "2026-09-07",
            targetMinute: "905",
          }),
      )
      .expect(200)
  ).body;
  expect(overlapping.blocks).toHaveLength(2);
  expect(overlapping.items).toHaveLength(1);
  const plans = [
    { kind: "block", id: first.id, version: first.version },
    { kind: "block", id: second.id, version: changed.version },
    { kind: "item", id: allDay.id, version: allDay.version },
  ];
  await b.post("calendar/selection/delete", { plans }).expect(404);
  await a
    .post("calendar/selection/delete", {
      plans: [plans[0], { ...plans[1], version: second.version }, plans[2]],
    })
    .expect(409);
  await a.get("time-blocks/" + first.id).expect(200);
  expect(
    (await a.get("time-entries/" + linked.id).expect(200)).body.timeBlockId,
  ).toBe(first.id);
  const deleted = (
    await a.post("calendar/selection/delete", { plans }).expect(200)
  ).body;
  await a.get("time-blocks/" + first.id).expect(404);
  expect(
    (await a.get("time-entries/" + linked.id).expect(200)).body.timeBlockId,
  ).toBe(null);
  await a.get("calendar/items/" + allDay.id).expect(404);
  await b
    .post("calendar/selection/delete/undo", { undoId: deleted.undoId })
    .expect(404);
  await a
    .post("calendar/selection/delete/undo", { undoId: deleted.undoId })
    .expect(200);
  expect(
    (await a.get("time-blocks/" + first.id).expect(200)).body.version,
  ).toBe(first.version + 1);
  expect(
    (await a.get("time-entries/" + linked.id).expect(200)).body.timeBlockId,
  ).toBe(first.id);
  expect(
    (await a.get("calendar/items/" + allDay.id).expect(200)).body.version,
  ).toBe(allDay.version + 1);
  await a
    .post("calendar/selection/delete/undo", { undoId: deleted.undoId })
    .expect(404);
});

it("deletes and restores one all-day plan with ownership, revision and replay guards", async () => {
  const a = api((await signUp()).cookie),
    b = api((await signUp()).cookie);
  const input = {
    title: "Multi-day plan",
    kind: "all_day",
    date: "2026-09-07",
    endDate: "2026-09-09",
    notes: "Keep these details on undo",
  };
  const item = (await a.post("calendar/items", input).expect(201)).body;
  const selection = {
    plans: [{ kind: "item", id: item.id, version: item.version }],
  };
  await a.post("calendar/selection/delete", { plans: [] }).expect(422);
  await b.post("calendar/selection/delete", selection).expect(404);
  await a
    .post("calendar/selection/delete", {
      plans: [{ ...selection.plans[0], version: item.version + 1 }],
    })
    .expect(409);
  await a.get("calendar/items/" + item.id).expect(200);
  const deleteHeaders = commandHeaders();
  const deleted = (
    await a
      .post("calendar/selection/delete", selection, 1, deleteHeaders)
      .expect(200)
  ).body;
  await a.get("calendar/items/" + item.id).expect(404);
  expect(
    (
      await a
        .post("calendar/selection/delete", selection, 1, deleteHeaders)
        .expect(200)
    ).body,
  ).toEqual(deleted);
  const undo = { undoId: deleted.undoId };
  await b.post("calendar/selection/delete/undo", undo).expect(404);
  const undoHeaders = commandHeaders();
  const restored = (
    await a
      .post("calendar/selection/delete/undo", undo, 1, undoHeaders)
      .expect(200)
  ).body;
  expect(restored).toMatchObject({
    blocks: [],
    items: [{ id: item.id, version: item.version + 1 }],
  });
  expect(
    (await a.get("calendar/items/" + item.id).expect(200)).body,
  ).toMatchObject({ ...input, id: item.id, version: item.version + 1 });
  expect(
    (
      await a
        .post("calendar/selection/delete/undo", undo, 1, undoHeaders)
        .expect(200)
    ).body,
  ).toEqual(restored);
  await a.post("calendar/selection/delete/undo", undo).expect(404);
  const unscheduled = (
    await a
      .post("calendar/items", {
        title: "Backlog",
        kind: "unscheduled",
        date: null,
        endDate: null,
      })
      .expect(201)
  ).body;
  await a
    .post("calendar/selection/delete", {
      plans: [
        { kind: "item", id: unscheduled.id, version: unscheduled.version },
      ],
    })
    .expect(422);
  await a.get("calendar/items/" + unscheduled.id).expect(200);
});

it("undoes entire-series edits and deletion while restoring exceptions, exclusions and recorded links", async () => {
  const a = api((await signUp()).cookie),
    b = api((await signUp()).cookie);
  const input = {
    ...rule,
    startDate: "2026-09-07",
    untilDate: "2026-09-10",
    startMinute: 540,
  };
  const created = (await a.post("calendar/series", input).expect(201)).body;
  const sourceBlocks = (await a.get("weeks/2026-09-07").expect(200)).body
    .blocks;
  const exception = (
    await a
      .put(
        "time-blocks/" + sourceBlocks[0].id,
        {
          ...block,
          title: "Individual exception",
          startsAt: sourceBlocks[0].startsAt,
          endsAt: sourceBlocks[0].endsAt,
        },
        sourceBlocks[0].version,
      )
      .expect(200)
  ).body;
  await a
    .del("time-blocks/" + sourceBlocks[1].id, sourceBlocks[1].version)
    .expect(200);
  const linkedBlock = sourceBlocks[3];
  const recorded = (
    await a
      .post("time-entries", {
        title: "Actual work",
        startsAt: linkedBlock.startsAt,
        endsAt: linkedBlock.endsAt,
        timeBlockId: linkedBlock.id,
      })
      .expect(201)
  ).body;
  const cardio = (
    await a
      .post("cardio-activities", {
        activityType: "walk",
        title: "Linked walk",
        startedAt: linkedBlock.startsAt,
        durationSeconds: 600,
        distanceMeters: null,
        linkedTimeBlockId: linkedBlock.id,
        notes: null,
      })
      .expect(201)
  ).body;
  const beforeSeries = (
    await a.get("calendar/series/" + created.series.id).expect(200)
  ).body;
  const before = (await a.get("weeks/2026-09-07").expect(200)).body.blocks;
  const changed = (
    await a
      .put(
        "calendar/series/" + created.series.id,
        {
          ...input,
          title: "Shorter replacement",
          untilDate: "2026-09-09",
          startMinute: 600,
        },
        beforeSeries.version,
      )
      .expect(200)
  ).body;
  expect((await a.get("time-entries/" + recorded.id)).body.timeBlockId).toBe(
    null,
  );
  const deletion = (
    await a
      .del("calendar/series/" + created.series.id, changed.series.version)
      .expect(200)
  ).body;
  await a.get("calendar/series/" + created.series.id).expect(404);
  await b
    .post("calendar/series/undo", { undoId: deletion.undoId, blocks: [] })
    .expect(404);
  const restoredDeletion = (
    await a
      .post("calendar/series/undo", { undoId: deletion.undoId, blocks: [] })
      .expect(200)
  ).body;
  const restoredEdit = (
    await a
      .post("calendar/series/undo", {
        undoId: changed.undoId,
        blocks: restoredDeletion.blocks,
      })
      .expect(200)
  ).body;
  const content = (v: Record<string, unknown>) => {
    const { version: _version, updatedAt: _updatedAt, ...rest } = v;
    return rest;
  };
  const restored = (await a.get("weeks/2026-09-07").expect(200)).body.blocks;
  expect(restored.map(content)).toEqual(before.map(content));
  expect(
    restored.find((v: { id: string }) => v.id === exception.id).isException,
  ).toBe(true);
  expect(
    (await a.get("calendar/series/" + created.series.id)).body.excludedDates,
  ).toEqual(beforeSeries.excludedDates);
  expect((await a.get("time-entries/" + recorded.id)).body.timeBlockId).toBe(
    linkedBlock.id,
  );
  expect(
    (await a.get("cardio-activities/" + cardio.id)).body.linkedTimeBlockId,
  ).toBe(linkedBlock.id);
  expect(restoredEdit.blocks).toHaveLength(before.length);
  await a
    .post("calendar/series/undo", {
      undoId: changed.undoId,
      blocks: restoredEdit.blocks,
    })
    .expect(404);
});

it("guards series undo against later occurrence edits and replays a completed inverse", async () => {
  const a = api((await signUp()).cookie);
  const input = {
    ...rule,
    startDate: "2026-09-07",
    untilDate: "2026-09-08",
    startMinute: 540,
  };
  const created = (await a.post("calendar/series", input).expect(201)).body;
  const first = (await a.get("time-blocks/" + created.blocks[0].id).expect(200))
    .body;
  const edited = (
    await a
      .put(
        "time-blocks/" + first.id,
        {
          ...block,
          title: "Changed elsewhere",
          startsAt: first.startsAt,
          endsAt: first.endsAt,
        },
        first.version,
      )
      .expect(200)
  ).body;
  await a
    .post("calendar/series/undo", {
      undoId: created.undoId,
      blocks: created.blocks,
    })
    .expect(409);
  expect((await a.get("time-blocks/" + first.id)).body.title).toBe(
    "Changed elsewhere",
  );
  await a
    .post("time-block-edits/" + edited.undoId + "/undo", {}, edited.version)
    .expect(200);
  const blocks = (await a.get("weeks/2026-09-07")).body.blocks.map(
    ({ id, version }: { id: string; version: number }) => ({ id, version }),
  );
  const headers = commandHeaders();
  const undo = { undoId: created.undoId, blocks };
  const result = (
    await a.post("calendar/series/undo", undo, 1, headers).expect(200)
  ).body;
  expect(
    (await a.post("calendar/series/undo", undo, 1, headers).expect(200)).body,
  ).toEqual(result);
  await a.get("calendar/series/" + created.series.id).expect(404);
  expect((await a.get("weeks/2026-09-07")).body.blocks).toHaveLength(0);
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

it("series inverses redo creation, editing and deletion with stable occurrence identities", async () => {
  const a = await signUp();
  const post = (
    path: string,
    data: object,
    version?: number,
    headers = commandHeaders(version),
  ) =>
    request(app)
      .post("/api/v1/" + path)
      .set("Cookie", a.cookie)
      .set("Origin", origin)
      .set(headers)
      .send(data);
  const rule = {
    title: "History series",
    timezone: "UTC",
    startDate: "2026-09-07",
    untilDate: "2026-09-09",
    startMinute: 540,
    durationMinutes: 60,
    frequency: "daily",
    interval: 1,
    weekdays: [1],
  };
  const created = (await post("calendar/series", rule).expect(201)).body;
  const gone = (
    await post("calendar/series/undo", {
      undoId: created.undoId,
      blocks: created.blocks,
    }).expect(200)
  ).body;
  expect(gone.blocks).toHaveLength(0);
  const headers = commandHeaders();
  const redo = (
    await post(
      "calendar/series/undo",
      { undoId: gone.undoId, blocks: gone.blocks },
      undefined,
      headers,
    ).expect(200)
  ).body;
  expect(redo.blocks.map((block: { id: string }) => block.id)).toEqual(
    created.blocks.map((block: { id: string }) => block.id),
  );
  expect(
    (
      await post(
        "calendar/series/undo",
        { undoId: gone.undoId, blocks: gone.blocks },
        undefined,
        headers,
      ).expect(200)
    ).body,
  ).toEqual(redo);
  let series = (
    await request(app)
      .get("/api/v1/calendar/series/" + created.series.id)
      .set("Cookie", a.cookie)
      .expect(200)
  ).body;
  const edited = (
    await request(app)
      .put("/api/v1/calendar/series/" + series.id)
      .set("Cookie", a.cookie)
      .set("Origin", origin)
      .set(commandHeaders(series.version))
      .send({ ...rule, title: "Edited series", untilDate: "2026-09-08" })
      .expect(200)
  ).body;
  const original = (
    await post("calendar/series/undo", {
      undoId: edited.undoId,
      blocks: edited.blocks,
    }).expect(200)
  ).body;
  expect(original.blocks).toHaveLength(3);
  const reapplied = (
    await post("calendar/series/undo", {
      undoId: original.undoId,
      blocks: original.blocks,
    }).expect(200)
  ).body;
  expect(reapplied.blocks.map((block: { id: string }) => block.id)).toEqual(
    edited.blocks.map((block: { id: string }) => block.id),
  );
  series = (
    await request(app)
      .get("/api/v1/calendar/series/" + created.series.id)
      .set("Cookie", a.cookie)
      .expect(200)
  ).body;
  expect(series.title).toBe("Edited series");
  const deleted = (
    await request(app)
      .delete("/api/v1/calendar/series/" + series.id)
      .set("Cookie", a.cookie)
      .set("Origin", origin)
      .set(commandHeaders(series.version))
      .expect(200)
  ).body;
  const restored = (
    await post("calendar/series/undo", {
      undoId: deleted.undoId,
      blocks: [],
    }).expect(200)
  ).body;
  expect(restored.blocks.map((block: { id: string }) => block.id)).toEqual(
    edited.blocks.map((block: { id: string }) => block.id),
  );
  const deletedAgain = (
    await post("calendar/series/undo", {
      undoId: restored.undoId,
      blocks: restored.blocks,
    }).expect(200)
  ).body;
  expect(deletedAgain.blocks).toHaveLength(0);
  await request(app)
    .get("/api/v1/calendar/series/" + series.id)
    .set("Cookie", a.cookie)
    .expect(404);
});

it("converts standalone timed/all-day plans into reversible series without losing identity or links", async () => {
  const a = api((await signUp()).cookie),
    b = api((await signUp()).cookie);
  for (const kind of ["timed", "all_day"] as const) {
    const source = (
      kind === "timed"
        ? await a.post("time-blocks", block).expect(201)
        : await a
            .post("calendar/items", {
              title: "Trip",
              kind: "all_day",
              date: "2026-09-07",
              endDate: "2026-09-08",
            })
            .expect(201)
    ).body;
    const sourceKind = kind === "timed" ? "block" : "item";
    const input = {
      ...rule,
      kind,
      dateSpan: 2,
      timezone: "UTC",
      startDate: "2026-09-07",
      untilDate: "2026-09-09",
      startMinute: 540,
      source: { kind: sourceKind, id: source.id, version: source.version },
    };
    await b.post("calendar/series", input).expect(404);
    const created = (await a.post("calendar/series", input).expect(201)).body;
    expect(created.count).toBe(3);
    const path = kind === "timed" ? "time-blocks/" : "calendar/items/";
    expect((await a.get(path + source.id)).body.seriesId).toBe(
      created.series.id,
    );
    const undone = (
      await a
        .post("calendar/series/undo", {
          undoId: created.undoId,
          blocks: created.blocks,
          items: created.items,
        })
        .expect(200)
    ).body;
    expect((await a.get(path + source.id)).body).toMatchObject({
      title: source.title,
      seriesId: null,
      occurrenceDate: null,
      isException: false,
    });
    await a.get("calendar/series/" + created.series.id).expect(404);
    const redone = (await a.post("calendar/series/undo", undone).expect(200))
      .body;
    expect((await a.get(path + source.id)).body.seriesId).toBe(
      created.series.id,
    );
    expect(kind === "timed" ? redone.blocks.length : redone.items.length).toBe(
      3,
    );
  }
});

it("splits following timed occurrences with preserved overrides and exclusions, and reverses the split atomically", async () => {
  const a = api((await signUp()).cookie);
  const input = {
    ...rule,
    timezone: "UTC",
    startDate: "2026-09-07",
    untilDate: "2026-09-11",
    startMinute: 540,
  };
  const created = (await a.post("calendar/series", input).expect(201)).body;
  const plans = (await a.get("weeks/2026-09-07")).body.blocks;
  const middle = plans[2],
    last = plans[4];
  const exception = (
    await a
      .put(
        "time-blocks/" + last.id,
        {
          ...block,
          title: "Special",
          startsAt: last.startsAt,
          endsAt: last.endsAt,
        },
        last.version,
      )
      .expect(200)
  ).body;
  await a.del("time-blocks/" + plans[3].id, plans[3].version).expect(200);
  const parent = (await a.get("calendar/series/" + created.series.id)).body;
  const split = (
    await a
      .put(
        "calendar/series/" + parent.id,
        {
          ...input,
          title: "Following",
          startDate: middle.occurrenceDate,
          scope: "following",
          fromDate: middle.occurrenceDate,
        },
        parent.version,
      )
      .expect(200)
  ).body;
  expect(split.series.id).not.toBe(parent.id);
  expect(split.series.excludedDates).toEqual(["2026-09-10"]);
  expect((await a.get("time-blocks/" + plans[0].id)).body).toMatchObject({
    title: "Repeat",
    seriesId: parent.id,
  });
  expect((await a.get("time-blocks/" + middle.id)).body).toMatchObject({
    title: "Following",
    seriesId: split.series.id,
  });
  expect((await a.get("time-blocks/" + last.id)).body).toMatchObject({
    title: "Special",
    seriesId: split.series.id,
    isException: true,
  });
  const undone = (
    await a
      .post("calendar/series/undo", {
        undoId: split.undoId,
        blocks: split.blocks,
        items: split.items,
      })
      .expect(200)
  ).body;
  expect((await a.get("time-blocks/" + middle.id)).body).toMatchObject({
    title: "Repeat",
    seriesId: parent.id,
  });
  await a.get("calendar/series/" + split.series.id).expect(404);
  const redo = (await a.post("calendar/series/undo", undone).expect(200)).body;
  const current = (await a.get("calendar/series/" + split.series.id)).body;
  const replaced = (
    await a
      .put(
        "calendar/series/" + current.id,
        {
          ...input,
          startDate: middle.occurrenceDate,
          title: "Replace",
          preserveExceptions: false,
        },
        current.version,
      )
      .expect(200)
  ).body;
  expect((await a.get("time-blocks/" + exception.id)).body).toMatchObject({
    title: "Replace",
    isException: false,
  });
  await a
    .post("calendar/series/undo", {
      undoId: redo.undoId,
      blocks: redo.blocks,
      items: redo.items,
    })
    .expect(409);
  expect(replaced.count).toBe(2);
});

it("uses date-based all-day recurrence across DST and supports scoped changes, stops, exclusions and history", async () => {
  const a = api((await signUp()).cookie),
    b = api((await signUp()).cookie);
  const input = {
    ...rule,
    kind: "all_day",
    dateSpan: 2,
    startMinute: 150,
    startDate: "2026-03-07",
    untilDate: "2026-03-10",
  };
  const created = (await a.post("calendar/series", input).expect(201)).body;
  expect(created.count).toBe(4);
  expect(created.skippedDates).toEqual([]);
  expect(created.blocks).toEqual([]);
  const read = async () =>
    (await a.get("calendar/items?from=2026-03-07&to=2026-03-12")).body;
  const plans = await read();
  expect(plans.map((p: { date: string }) => p.date)).toEqual([
    "2026-03-07",
    "2026-03-08",
    "2026-03-09",
    "2026-03-10",
  ]);
  expect(plans[1].endDate).toBe("2026-03-09");
  const exception = (
    await a
      .put(
        "calendar/items/" + plans[2].id,
        {
          title: "Individual",
          kind: "all_day",
          date: plans[2].date,
          endDate: plans[2].endDate,
        },
        plans[2].version,
      )
      .expect(200)
  ).body;
  const parent = (await a.get("calendar/series/" + created.series.id)).body;
  const split = (
    await a
      .put(
        "calendar/series/" + parent.id,
        {
          ...input,
          startDate: "2026-03-08",
          scope: "following",
          fromDate: "2026-03-08",
          title: "Future",
        },
        parent.version,
      )
      .expect(200)
  ).body;
  expect((await a.get("calendar/items/" + exception.id)).body.title).toBe(
    "Individual",
  );
  const current = (await a.get("calendar/series/" + split.series.id)).body;
  const stopInput = {
    operation: "stop",
    scope: "following",
    fromDate: "2026-03-09",
  };
  await b
    .post(
      "calendar/series/" + current.id + "/change",
      stopInput,
      current.version,
    )
    .expect(404);
  const stopped = (
    await a
      .post(
        "calendar/series/" + current.id + "/change",
        stopInput,
        current.version,
      )
      .expect(200)
  ).body;
  expect(await read()).toHaveLength(2);
  const undone = (
    await a
      .post("calendar/series/undo", {
        undoId: stopped.undoId,
        blocks: stopped.blocks,
        items: stopped.items,
      })
      .expect(200)
  ).body;
  expect(await read()).toHaveLength(4);
  const item = (await read())[1];
  const deleted = (
    await a
      .post("calendar/selection/delete", {
        plans: [{ kind: "item", id: item.id, version: item.version }],
      })
      .expect(200)
  ).body;
  expect(
    (await a.get("calendar/series/" + current.id)).body.excludedDates,
  ).toContain(item.occurrenceDate);
  await a
    .post("calendar/selection/delete/undo", { undoId: deleted.undoId })
    .expect(200);
  expect(
    (await a.get("calendar/series/" + current.id)).body.excludedDates,
  ).not.toContain(item.occurrenceDate);
  const latest = (await a.get("calendar/series/" + current.id)).body;
  const changed = (
    await a
      .post(
        "calendar/series/" + current.id + "/change",
        {
          operation: "edit",
          scope: "following",
          fromDate: item.occurrenceDate,
          occurrence: {
            kind: "item",
            id: item.id,
            version: (await a.get("calendar/items/" + item.id)).body.version,
            item: {
              title: "Shifted",
              kind: "all_day",
              date: "2026-03-09",
              endDate: "2026-03-10",
            },
          },
        },
        latest.version,
      )
      .expect(200)
  ).body;
  expect(changed.items.length).toBeGreaterThan(0);
  expect(undone.items).toHaveLength(3);
});

it("scoped title edits do not spread an occurrence's exceptional time and reject mismatched all-day details", async () => {
  const a = api((await signUp()).cookie);
  const input = {
    ...rule,
    timezone: "UTC",
    startDate: "2026-09-07",
    untilDate: "2026-09-09",
    startMinute: 540,
  };
  const created = (await a.post("calendar/series", input).expect(201)).body;
  const plans = ((await a.get("weeks/2026-09-07")).body as Week).blocks;
  const first = plans.find((p) => p.occurrenceDate === "2026-09-07")!;
  const exception = (
    await a
      .put(
        "time-blocks/" + first.id,
        {
          ...block,
          startsAt: "2026-09-07T11:00:00Z",
          endsAt: "2026-09-07T13:00:00Z",
        },
        first.version,
      )
      .expect(200)
  ).body;
  const parent = (await a.get("calendar/series/" + created.series.id)).body;
  await a
    .post(
      "calendar/series/" + parent.id + "/change",
      {
        operation: "edit",
        scope: "all",
        fromDate: exception.occurrenceDate,
        occurrence: {
          kind: "block",
          id: exception.id,
          version: exception.version,
          block: {
            ...block,
            title: "Rename series",
            startsAt: exception.startsAt,
            endsAt: exception.endsAt,
          },
        },
      },
      parent.version,
    )
    .expect(200);
  const others = ((await a.get("weeks/2026-09-07")).body as Week).blocks.filter(
    (p) => p.id !== first.id,
  );
  expect(
    others.every(
      (p) =>
        p.title === "Rename series" &&
        p.startsAt.includes("T09:00") &&
        p.endsAt.includes("T10:00"),
    ),
  ).toBe(true);
  const allDay = (
    await a.post("calendar/series", { ...input, kind: "all_day" }).expect(201)
  ).body;
  const item = (await a.get("calendar/items/" + allDay.items[0].id)).body;
  await a
    .post(
      "calendar/series/" + allDay.series.id + "/change",
      {
        operation: "edit",
        scope: "all",
        fromDate: item.occurrenceDate,
        occurrence: {
          kind: "item",
          id: item.id,
          version: item.version,
          item: { title: "Wrong type", kind: "unscheduled" },
        },
      },
      allDay.series.version,
    )
    .expect(422);
});
