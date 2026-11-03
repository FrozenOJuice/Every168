import { expect, it } from "vitest";
import request from "supertest";
import { testApp, origin, commandHeaders } from "./helpers.js";
const { app, signUp } = testApp();
it("copies selected Edmonton dates using canonical UTC bounds, including the first local hour", async () => {
  const owner = await signUp(),
    other = await signUp();
  const me = await request(app)
    .get("/api/v1/me")
    .set("Cookie", owner.cookie)
    .expect(200);
  await request(app)
    .put("/api/v1/preferences")
    .set("Cookie", owner.cookie)
    .set("Origin", origin)
    .set(commandHeaders(me.body.preferences.version))
    .send({
      timezone: "America/Edmonton",
      weekStartsOn: 1,
      weightUnit: "kg",
      distanceUnit: "km",
    })
    .expect(200);
  const post = (
    cookie: string,
    title: string,
    startsAt: string,
    endsAt: string,
  ) =>
    request(app)
      .post("/api/v1/time-blocks")
      .set("Cookie", cookie)
      .set("Origin", origin)
      .set(commandHeaders())
      .send({ title, startsAt, endsAt })
      .expect(201);
  await post(
    owner.cookie,
    "First local hour",
    "2026-11-02T06:30:00Z",
    "2026-11-02T06:45:00Z",
  );
  await post(
    owner.cookie,
    "Second selected date",
    "2026-11-04T07:30:00Z",
    "2026-11-04T08:00:00Z",
  );
  await post(
    owner.cookie,
    "Unselected middle date",
    "2026-11-03T18:00:00Z",
    "2026-11-03T19:00:00Z",
  );
  await post(
    other.cookie,
    "Other owner",
    "2026-11-02T06:30:00Z",
    "2026-11-02T06:45:00Z",
  );
  const input = {
    span: "range",
    sourceDate: "2026-11-02",
    sourceEndDate: "2026-11-04",
    selectedDates: "2026-11-02,2026-11-04",
    targetDate: "2026-11-09",
  };
  const preview = await request(app)
    .get("/api/v1/calendar/copy-preview?" + new URLSearchParams(input))
    .set("Cookie", owner.cookie)
    .expect(200);
  expect(
    preview.body.blocks.map((block: { title: string }) => block.title),
  ).toEqual(["First local hour", "Second selected date"]);
  expect(
    preview.body.blocks.map((block: { startsAt: string }) => block.startsAt),
  ).toEqual(["2026-11-09T06:30:00Z", "2026-11-11T07:30:00Z"]);
  await request(app)
    .post("/api/v1/calendar/copy")
    .set("Cookie", owner.cookie)
    .set("Origin", origin)
    .set(commandHeaders())
    .send({ ...input, token: preview.body.token })
    .expect(201);
  const week = await request(app)
    .get("/api/v1/weeks/2026-11-09")
    .set("Cookie", owner.cookie)
    .expect(200);
  expect(
    week.body.blocks.map((block: { title: string }) => block.title),
  ).toEqual(["First local hour", "Second selected date"]);
});
