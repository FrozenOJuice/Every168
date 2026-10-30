import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import request from "supertest";
import { workoutUpdateInput } from "@168hours/contracts";
import { testApp, origin, commandHeaders } from "./helpers.js";
const { app, signUp } = testApp();
it("persists owner-scoped pauses, validates intervals and keeps workout/Calendar totals and retries consistent", async () => {
  const owner = (await signUp()).cookie;
  const other = (await signUp()).cookie;
  const get = (path: string, cookie = owner) =>
    request(app).get(`/api/v1/${path}`).set("Cookie", cookie);
  const write = (
    method: "post" | "put" | "delete",
    path: string,
    data: object,
    version = 1,
    key = randomUUID(),
    cookie = owner,
  ) =>
    request(app)
      [method](`/api/v1/${path}`)
      .set("Cookie", cookie)
      .set("Origin", origin)
      .set({ ...commandHeaders(version), "Idempotency-Key": key })
      .send(data);
  const exercise = (
    await write("post", "exercises", { name: "Paused bench" }).expect(201)
  ).body;
  const workout = (
    await write("post", "strength-workouts", {
      title: "Paused training",
      startedAt: "2026-10-28T12:00:00Z",
    }).expect(201)
  ).body;
  const path = `strength-workouts/${workout.id}`;
  let input = workoutUpdateInput.parse({
    title: workout.title,
    startedAt: workout.startedAt,
    endedAt: null,
    exercises: [
      {
        exerciseId: exercise.id,
        sets: [{ reps: 12, weightKg: 50, completed: true }],
      },
    ],
    pauses: [{ startsAt: "2026-10-28T12:10:00Z", endsAt: null }],
  });
  const pauseKey = randomUUID();
  const paused = (
    await write("put", path, input, workout.version, pauseKey).expect(200)
  ).body;
  expect(
    (await write("put", path, input, workout.version, pauseKey).expect(200))
      .body,
  ).toEqual(paused);
  expect((await get(path).expect(200)).body.pauses).toEqual(input.pauses);
  await get(path, other).expect(404);
  await write("put", path, input, paused.version, randomUUID(), other).expect(
    404,
  );
  await write(
    "put",
    path,
    { ...input, endedAt: "2026-10-28T13:00:00Z" },
    paused.version,
  ).expect(422);
  await write(
    "put",
    path,
    {
      ...input,
      pauses: [
        { startsAt: "2026-10-28T12:10:00Z", endsAt: "2026-10-28T12:20:00Z" },
        { startsAt: "2026-10-28T12:15:00Z", endsAt: "2026-10-28T12:25:00Z" },
      ],
    },
    paused.version,
  ).expect(422);
  input = {
    ...input,
    endedAt: "2026-10-28T13:00:00Z",
    pauses: [
      { startsAt: "2026-10-28T12:10:00Z", endsAt: "2026-10-28T12:30:00Z" },
    ],
  };
  const finished = (await write("put", path, input, paused.version).expect(200))
    .body;
  const week = (await get("weeks/2026-10-28").expect(200)).body;
  expect(
    week.entries.filter(
      (entry: { sourceId: string }) => entry.sourceId === workout.id,
    ),
  ).toHaveLength(1);
  expect(week.entries[0].excludedIntervals).toEqual(input.pauses);
  expect(week.recordedSeconds).toBe(2400);
  expect(
    (await get("fitness-progress?date=2026-10-28").expect(200)).body.weeks.at(
      -1,
    ).durationSeconds,
  ).toBe(2400);
  input.pauses = [
    { startsAt: "2026-10-28T12:10:00Z", endsAt: "2026-10-28T12:20:00Z" },
  ];
  const corrected = (
    await write("put", path, input, finished.version).expect(200)
  ).body;
  expect((await get("weeks/2026-10-28").expect(200)).body.recordedSeconds).toBe(
    3000,
  );
  expect(
    (await get("fitness-progress?date=2026-10-28").expect(200)).body.weeks.at(
      -1,
    ).durationSeconds,
  ).toBe(3000);
  await write("delete", path, {}, corrected.version).expect(200);
  expect((await get("weeks/2026-10-28").expect(200)).body.entries).toHaveLength(
    0,
  );
});
