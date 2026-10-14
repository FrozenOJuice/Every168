import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import request from "supertest";
import {
  strengthPlanSchema,
  workoutSchema,
  workoutUpdateInput,
} from "@168hours/contracts";
import { testApp, origin, commandHeaders } from "./helpers.js";
const { app, signUp } = testApp();
function client(cookie: string) {
  return {
    get: (path: string) =>
      request(app)
        .get("/api/v1/" + path)
        .set("Cookie", cookie),
    write: (
      method: "post" | "put" | "delete",
      path: string,
      data: object = {},
      version = 1,
      key = randomUUID(),
    ) =>
      request(app)
        [method]("/api/v1/" + path)
        .set("Cookie", cookie)
        .set("Origin", origin)
        .set({ ...commandHeaders(version), "Idempotency-Key": key })
        .send(data),
  };
}
const times = {
  startsAt: "2026-10-14T15:00:00Z",
  endsAt: "2026-10-14T16:00:00Z",
};
it("keeps reusable targets, scheduled plans and actual sessions separate, safely resumes and preserves Calendar links through undo", async () => {
  const a = client((await signUp()).cookie);
  const exercise = (
    await a.write("post", "exercises", { name: "Squat" }).expect(201)
  ).body;
  const input = {
    title: "Strength A",
    notes: "Train",
    exercises: [
      {
        exerciseId: exercise.id,
        sets: [
          { targetReps: 8, targetWeightKg: 50, restSeconds: 90 },
          { targetDurationSeconds: 30 },
        ],
      },
    ],
  };
  const p = strengthPlanSchema.parse(
    (await a.write("post", "strength-plans", input).expect(201)).body,
  );
  const scheduled = strengthPlanSchema.parse(
    (
      await a
        .write("post", `strength-plans/${p.id}/schedule`, times)
        .expect(201)
    ).body,
  );
  expect((await a.get("strength-workouts")).body.items).toHaveLength(0);
  const block = await a.get(`time-blocks/${scheduled.timeBlockId}`).expect(200);
  expect(Date.parse(block.body.startsAt)).toBe(Date.parse(times.startsAt));
  const deletion = (
    await a
      .write(
        "delete",
        `time-blocks/${scheduled.timeBlockId}`,
        {},
        block.body.version,
      )
      .expect(200)
  ).body;
  expect(
    (await a.get(`strength-plans/${scheduled.id}`)).body.timeBlockId,
  ).toBeNull();
  // Calendar's existing safe restore also restores scheduled Fitness metadata.
  await a
    .write(
      "post",
      `time-block-deletions/${deletion.undoId}/undo`,
      {},
      deletion.version,
    )
    .expect(200);
  const restored = strengthPlanSchema.parse(
    (await a.get(`strength-plans/${scheduled.id}`)).body,
  );
  expect(restored.timeBlockId).toBe(scheduled.timeBlockId);
  await a
    .write(
      "put",
      `strength-plans/${p.id}`,
      {
        ...input,
        title: "Strength B",
        exercises: [{ exerciseId: exercise.id, sets: [{ targetReps: 12 }] }],
      },
      p.version,
    )
    .expect(200);
  const key = randomUUID();
  const startedAt = "2026-10-14T15:10:00Z";
  const w = workoutSchema.parse(
    (
      await a
        .write(
          "post",
          `strength-plans/${restored.id}/begin`,
          { startedAt },
          restored.version,
          key,
        )
        .expect(201)
    ).body,
  );
  const retry = await a
    .write(
      "post",
      `strength-plans/${restored.id}/begin`,
      { startedAt },
      restored.version,
      key,
    )
    .expect(201);
  expect(retry.body.id).toBe(w.id);
  const resume = await a
    .write(
      "post",
      `strength-plans/${restored.id}/begin`,
      { startedAt },
      restored.version,
    )
    .expect(201);
  expect(resume.body.id).toBe(w.id);
  expect(w.title).toBe("Strength A");
  expect(w.exercises[0]!.sets).toHaveLength(2);
  expect(w.exercises[0]!.sets[0]).toMatchObject({
    targetReps: 8,
    reps: null,
    completed: false,
    skipped: false,
  });
  const update = workoutUpdateInput.parse({
    title: w.title,
    startedAt: w.startedAt,
    endedAt: "2026-10-14T15:50:00Z",
    notes: w.notes,
    linkedTimeBlockId: w.linkedTimeBlockId,
    exercises: w.exercises.map((e) => ({
      id: e.id,
      exerciseId: e.exerciseId,
      notes: e.notes,
      sets: e.sets.map((s, i) => ({
        id: s.id,
        targetReps: s.targetReps,
        targetWeightKg: s.targetWeightKg,
        targetDurationSeconds: s.targetDurationSeconds,
        restSeconds: s.restSeconds,
        reps: i === 0 ? 7 : null,
        weightKg: i === 0 ? 45 : null,
        durationSeconds: null,
        completed: i === 0,
        skipped: i === 1,
      })),
    })),
  });
  const saved = workoutSchema.parse(
    (
      await a
        .write("put", `strength-workouts/${w.id}`, update, w.version)
        .expect(200)
    ).body,
  );
  expect(saved.exercises[0]!.sets[0]).toMatchObject({
    targetReps: 8,
    reps: 7,
    targetWeightKg: 50,
    weightKg: 45,
  });
  expect(saved.exercises[0]!.sets[1]!.skipped).toBe(true);
  const week = (await a.get("weeks/2026-10-14")).body;
  expect(
    week.entries.filter((e: { sourceId: string }) => e.sourceId === w.id),
  ).toHaveLength(1);
  const activity = (
    await a.get("calendar/activity?from=2026-10-14&to=2026-10-14")
  ).body;
  expect(
    activity.entries.find(
      (e: { source: { id: string } }) => e.source.id === w.id,
    ).href,
  ).toBe(`/fitness/session/${w.id}`);
  expect(
    (await a.get(`strength-progress/${exercise.id}?excludeWorkoutId=${w.id}`))
      .body.history.items,
  ).toHaveLength(0);
  const repeated = workoutSchema.parse(
    (
      await a
        .write("post", `strength-workouts/${w.id}/repeat`, {}, saved.version)
        .expect(201)
    ).body,
  );
  expect(repeated.exercises[0]!.sets[0]).toMatchObject({
    reps: null,
    completed: false,
    skipped: false,
    targetReps: 8,
  });
  expect(repeated.linkedTimeBlockId).toBeNull();
  expect(
    (await a.get(`strength-plans/${p.id}`)).body.exercises[0].sets[0]
      .targetReps,
  ).toBe(12);
});
it("enforces owner references, optimistic revisions and completed/skipped set integrity", async () => {
  const a = client((await signUp()).cookie),
    b = client((await signUp()).cookie);
  const exercise = (
    await a.write("post", "exercises", { name: "Plank" }).expect(201)
  ).body;
  expect(
    (await a.get(`strength-plan-for-block/${randomUUID()}`).expect(200)).body,
  ).toEqual({ plan: null });
  const input = {
    title: "Hold",
    exercises: [
      { exerciseId: exercise.id, sets: [{ targetDurationSeconds: 30 }] },
    ],
  };
  const p = (await a.write("post", "strength-plans", input).expect(201)).body;
  await b.write("post", "strength-plans", input).expect(404);
  await b.get(`strength-plans/${p.id}`).expect(404);
  await b.write("post", `strength-plans/${p.id}/schedule`, times).expect(404);
  await b
    .write("post", `strength-plans/${p.id}/begin`, {
      startedAt: times.startsAt,
    })
    .expect(404);
  await a
    .write(
      "put",
      `strength-plans/${p.id}`,
      { ...input, title: "Renamed" },
      p.version,
    )
    .expect(200);
  await a
    .write("post", `strength-plans/${p.id}/schedule`, times, p.version)
    .expect(409);
  const w = workoutSchema.parse(
    (
      await a
        .write("post", "strength-workouts", { startedAt: times.startsAt })
        .expect(201)
    ).body,
  );
  const update = {
    title: w.title,
    startedAt: w.startedAt,
    endedAt: null,
    exercises: [{ exerciseId: exercise.id, sets: [{ completed: true }] }],
  };
  await a
    .write("put", `strength-workouts/${w.id}`, update, w.version)
    .expect(422);
  await a
    .write(
      "put",
      `strength-workouts/${w.id}`,
      {
        ...update,
        exercises: [
          {
            exerciseId: exercise.id,
            sets: [{ reps: 8, completed: true, skipped: true }],
          },
        ],
      },
      w.version,
    )
    .expect(422);
  const pending = await a
    .write(
      "put",
      `strength-workouts/${w.id}`,
      {
        ...update,
        exercises: [
          {
            exerciseId: exercise.id,
            sets: [{ completed: false, targetDurationSeconds: 30 }],
          },
        ],
      },
      w.version,
    )
    .expect(200);
  await a
    .write(
      "put",
      `strength-workouts/${w.id}`,
      {
        ...update,
        title: "Stale",
        exercises: [{ exerciseId: exercise.id, sets: [{ completed: false }] }],
      },
      w.version,
    )
    .expect(409);
  await b
    .write("delete", `strength-workouts/${w.id}`, {}, pending.body.version)
    .expect(404);
  await a
    .write("post", `exercises/${exercise.id}/archive`, {}, exercise.version)
    .expect(200);
  await a.write("post", "strength-plans", input).expect(422);
});
