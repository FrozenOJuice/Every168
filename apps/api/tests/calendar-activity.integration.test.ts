import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import request from "supertest";
import {
  calendarActivityResultSchema,
  CALENDAR_ACTIVITY_LIMIT,
} from "@168hours/contracts";
import { calendarActivityService } from "../src/modules/planning/calendar-activity.service.js";
import { testApp, origin, commandHeaders } from "./helpers.js";
const { app, deps, signUp } = testApp();
const activity = (cookie: string, from = "2026-09-07", to = from) =>
  request(app)
    .get(`/api/v1/calendar/activity?from=${from}&to=${to}`)
    .set("Cookie", cookie);
it("projects owner-scoped domain moments and sessions by occurrence, preserves snapshots and reflects edits/deletes", async () => {
  const a = await signUp(),
    b = await signUp();
  const post = (path: string, input: object) =>
    request(app)
      .post("/api/v1/" + path)
      .set("Cookie", a.cookie)
      .set("Origin", origin)
      .set(commandHeaders())
      .send(input);
  const water = (
    await post("water-entries", {
      amountMl: 250,
      consumedAt: "2026-09-07T10:00:00Z",
    }).expect(201)
  ).body;
  const weight = (
    await post("weight-entries", {
      weightKg: 70,
      measuredAt: "2026-09-07T08:00:00Z",
    }).expect(201)
  ).body;
  const food = (
    await post("foods", {
      name: "Original meal",
      servingAmount: 100,
      servingUnit: "g",
      calories: 120,
    }).expect(201)
  ).body;
  await post("food-entries", {
    foodId: food.id,
    quantity: 2,
    consumedAt: "2026-09-07T12:00:00Z",
  }).expect(201);
  await request(app)
    .put("/api/v1/foods/" + food.id)
    .set("Cookie", a.cookie)
    .set("Origin", origin)
    .set(commandHeaders(food.version))
    .send({
      name: "Renamed food",
      servingAmount: 200,
      servingUnit: "g",
      calories: 250,
    })
    .expect(200);
  const cardio = (
    await post("cardio-activities", {
      title: "Evening walk",
      activityType: "walk",
      startedAt: "2026-09-07T18:00:00Z",
      durationSeconds: 1800,
    }).expect(201)
  ).body;
  const workout = (
    await post("strength-workouts", {
      title: "Workout",
      startedAt: "2026-09-07T09:00:00Z",
    }).expect(201)
  ).body;
  let result = calendarActivityResultSchema.parse(
    (await activity(a.cookie).expect(200)).body,
  );
  expect(result.entries.map((e) => e.source.type)).toEqual([
    "weight_entry",
    "strength_workout",
    "water_entry",
    "food_entry",
    "cardio_activity",
  ]);
  expect(result.entries.find((e) => e.source.id === water.id)).toMatchObject({
    kind: "moment",
    endsAt: null,
    summary: "250 ml",
    occurredAt: "2026-09-07T10:00:00.000Z",
  });
  expect(result.entries.find((e) => e.source.id === weight.id)?.href).toContain(
    "#food-weight",
  );
  expect(
    result.entries.find((e) => e.source.type === "food_entry"),
  ).toMatchObject({ title: "Original meal", summary: "2 × 100 g · other" });
  expect(result.entries.find((e) => e.source.id === workout.id)).toMatchObject({
    status: "draft",
    endsAt: null,
  });
  expect(result.entries.find((e) => e.source.id === cardio.id)?.endsAt).toBe(
    "2026-09-07T18:30:00.000Z",
  );
  expect((await activity(b.cookie).expect(200)).body.entries).toEqual([]);
  await activity("").expect(401);
  await request(app)
    .put("/api/v1/water-entries/" + water.id)
    .set("Cookie", a.cookie)
    .set("Origin", origin)
    .set(commandHeaders(water.version))
    .send({ amountMl: 500, consumedAt: "2026-09-08T10:00:00Z" })
    .expect(200);
  result = calendarActivityResultSchema.parse(
    (await activity(a.cookie).expect(200)).body,
  );
  expect(result.entries.some((e) => e.source.id === water.id)).toBe(false);
  expect(
    (await activity(a.cookie, "2026-09-08").expect(200)).body.entries[0]
      .summary,
  ).toBe("500 ml");
  await request(app)
    .delete("/api/v1/water-entries/" + water.id)
    .set("Cookie", a.cookie)
    .set("Origin", origin)
    .set(commandHeaders(2))
    .expect(200);
  expect(
    (await activity(a.cookie, "2026-09-08").expect(200)).body.entries,
  ).toEqual([]);
  const week = (
    await request(app)
      .get("/api/v1/weeks/2026-09-07")
      .set("Cookie", a.cookie)
      .expect(200)
  ).body;
  expect(week.entries).toHaveLength(1);
  expect(week.entries[0].sourceId).toBe(cardio.id);
});
it("uses timezone-correct half-open dates, bounds data and accepts a domain without Calendar-specific rendering rules", async () => {
  const a = await signUp();
  await request(app).get("/api/v1/me").set("Cookie", a.cookie).expect(200);
  await request(app)
    .put("/api/v1/preferences")
    .set("Cookie", a.cookie)
    .set("Origin", origin)
    .set(commandHeaders())
    .send({
      timezone: "America/Edmonton",
      weightUnit: "lb",
      distanceUnit: "km",
      weekStartsOn: 1,
    })
    .expect(200);
  for (const at of [
    "2026-03-08T07:00:00Z",
    "2026-03-09T05:59:59Z",
    "2026-03-09T06:00:00Z",
  ])
    await request(app)
      .post("/api/v1/water-entries")
      .set("Cookie", a.cookie)
      .set("Origin", origin)
      .set(commandHeaders())
      .send({ amountMl: 250, consumedAt: at })
      .expect(201);
  expect(
    (await activity(a.cookie, "2026-03-08").expect(200)).body.entries,
  ).toHaveLength(2);
  await activity(a.cookie, "2026-01-01", "2026-12-31").expect(422);
  await activity(a.cookie, "2026-09-08", "2026-09-07").expect(422);
  await deps.pool.query(
    "insert into water_entries(user_id,amount_ml,consumed_at) select $1,250,'2026-09-07T10:00:00Z'::timestamptz + n*interval '1 second' from generate_series(1,$2) n",
    [a.id, CALENDAR_ACTIVITY_LIMIT + 1],
  );
  const bounded = calendarActivityResultSchema.parse(
    (await activity(a.cookie).expect(200)).body,
  );
  expect(bounded.entries).toHaveLength(CALENDAR_ACTIVITY_LIMIT);
  expect(bounded.truncatedSources).toEqual([{ label: "Water", href: "/food" }]);
  const id = randomUUID();
  const drawing = calendarActivityService(deps.identity, [
    async (userId, range) => {
      expect(userId).toBe(a.id);
      expect(range).toMatchObject({
        startsAt: "2026-03-08T07:00:00Z",
        endsAt: "2026-03-09T06:00:00Z",
      });
      return {
        label: "Drawing",
        href: "/drawing",
        truncated: false,
        entries: [
          {
            source: { type: "sketch", id },
            domain: "Drawing",
            kind: "moment",
            status: "recorded",
            icon: "pencil",
            title: "Sketch finished",
            summary: "Practice",
            occurredAt: "2026-03-08T12:00:00Z",
            endsAt: null,
            href: "/drawing/" + id,
          },
        ],
      };
    },
  ]);
  expect(
    calendarActivityResultSchema.parse(
      await drawing.range(a.id, "2026-03-08", "2026-03-08"),
    ).entries[0]!.domain,
  ).toBe("Drawing");
});
