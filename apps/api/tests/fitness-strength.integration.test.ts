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

it("finds only the owner's next linked, unstarted workout using current Calendar times", async () => {
  const a = client((await signUp()).cookie),
    b = client((await signUp()).cookie);
  const exercise = (
    await a.write("post", "exercises", { name: "Bench" }).expect(201)
  ).body;
  const input = {
    title: "Push day",
    exercises: [{ exerciseId: exercise.id, sets: [{ targetReps: 8 }] }],
  };
  const plan = (await a.write("post", "strength-plans", input).expect(201))
    .body;
  await a
    .write("post", "time-blocks", {
      title: "Push day",
      startsAt: "2030-01-02T15:00:00Z",
      endsAt: "2030-01-02T16:00:00Z",
    })
    .expect(201);
  expect(
    (await a.get("strength-plans/next").expect(200)).body.workout,
  ).toBeNull();
  const otherExercise = (
    await b.write("post", "exercises", { name: "Other bench" }).expect(201)
  ).body;
  const otherPlan = (
    await b
      .write("post", "strength-plans", {
        title: "Other user's workout",
        exercises: [
          { exerciseId: otherExercise.id, sets: [{ targetReps: 8 }] },
        ],
      })
      .expect(201)
  ).body;
  await b
    .write("post", `strength-plans/${otherPlan.id}/schedule`, {
      startsAt: "2030-01-01T15:00:00Z",
      endsAt: "2030-01-01T16:00:00Z",
    })
    .expect(201);
  const early = (
    await a
      .write("post", `strength-plans/${plan.id}/schedule`, {
        startsAt: "2030-01-10T15:00:00Z",
        endsAt: "2030-01-10T16:00:00Z",
      })
      .expect(201)
  ).body;
  const late = (
    await a
      .write("post", `strength-plans/${plan.id}/schedule`, {
        startsAt: "2030-01-20T15:00:00Z",
        endsAt: "2030-01-20T16:00:00Z",
      })
      .expect(201)
  ).body;
  expect(
    (await a.get("strength-plans/next").expect(200)).body.workout.plan.id,
  ).toBe(early.id);
  await a
    .write(
      "put",
      `strength-plans/${plan.id}`,
      {
        ...input,
        title: "Changed saved workout",
        exercises: [{ exerciseId: exercise.id, sets: [{ targetReps: 12 }] }],
      },
      plan.version,
    )
    .expect(200);
  const block = (await a.get(`time-blocks/${early.timeBlockId}`).expect(200))
    .body;
  await a
    .write(
      "put",
      `time-blocks/${block.id}`,
      {
        title: "Moved Push day",
        startsAt: "2030-01-30T15:00:00Z",
        endsAt: "2030-01-30T16:00:00Z",
      },
      block.version,
    )
    .expect(200);
  const next = (await a.get("strength-plans/next").expect(200)).body.workout;
  expect(next.plan.id).toBe(late.id);
  expect(next.plan.title).toBe("Push day");
  expect(next.plan.exercises[0].sets[0].targetReps).toBe(8);
  await a
    .write(
      "post",
      `strength-plans/${late.id}/begin`,
      { startedAt: "2030-01-20T15:00:00Z" },
      late.version,
    )
    .expect(201);
  expect(
    (await a.get("strength-plans/next").expect(200)).body.workout.plan.id,
  ).toBe(early.id);
  const moved = (await a.get(`time-blocks/${early.timeBlockId}`).expect(200))
    .body;
  await a
    .write("delete", `time-blocks/${moved.id}`, {}, moved.version)
    .expect(200);
  expect(
    (await a.get("strength-plans/next").expect(200)).body.workout,
  ).toBeNull();
  expect(
    (await b.get("strength-plans/next").expect(200)).body.workout.plan.title,
  ).toBe("Other user's workout");
});

it("saves incomplete private drafts, rejects starting/scheduling, and publishes with revision and replay protection", async () => {
  const a = client((await signUp()).cookie);
  const b = client((await signUp()).cookie);
  const key = randomUUID();
  const input = { title: "", isDraft: true, exercises: [] };
  const draft = strengthPlanSchema.parse(
    (await a.write("post", "strength-plans", input, 1, key).expect(201)).body,
  );
  expect(draft).toMatchObject({
    title: "Untitled workout",
    isDraft: true,
    exercises: [],
    kind: "workout",
  });
  expect(
    strengthPlanSchema.parse(
      (await a.write("post", "strength-plans", input, 1, key).expect(201)).body,
    ),
  ).toEqual(draft);
  expect(
    (await a.get("strength-plans")).body.items.map(
      (plan: { id: string }) => plan.id,
    ),
  ).toContain(draft.id);
  await b.get(`strength-plans/${draft.id}`).expect(404);
  await b
    .write("put", `strength-plans/${draft.id}`, input, draft.version)
    .expect(404);
  await a
    .write(
      "post",
      `strength-plans/${draft.id}/begin`,
      { startedAt: times.startsAt },
      draft.version,
    )
    .expect(422);
  await a
    .write("post", `strength-plans/${draft.id}/schedule`, times, draft.version)
    .expect(422);
  await a
    .write(
      "put",
      `strength-plans/${draft.id}`,
      { ...input, isDraft: false },
      draft.version,
    )
    .expect(422);
  const foreign = (
    await b.write("post", "exercises", { name: "Private movement" }).expect(201)
  ).body;
  await a
    .write(
      "put",
      `strength-plans/${draft.id}`,
      { ...input, exercises: [{ exerciseId: foreign.id, sets: [] }] },
      draft.version,
    )
    .expect(404);
  const exercise = (
    await a.write("post", "exercises", { name: "Press" }).expect(201)
  ).body;
  const incomplete = {
    title: "Push day",
    isDraft: true,
    exercises: [{ exerciseId: exercise.id, sets: [] }],
  };
  const revised = strengthPlanSchema.parse(
    (
      await a
        .write("put", `strength-plans/${draft.id}`, incomplete, draft.version)
        .expect(200)
    ).body,
  );
  expect(revised.isDraft).toBe(true);
  await a
    .write(
      "put",
      `strength-plans/${draft.id}`,
      { ...incomplete, isDraft: false },
      revised.version,
    )
    .expect(422);
  const ready = {
    title: "Push day",
    isDraft: false,
    exercises: [{ exerciseId: exercise.id, sets: [{ targetReps: 8 }] }],
  };
  const published = strengthPlanSchema.parse(
    (
      await a
        .write("put", `strength-plans/${draft.id}`, ready, revised.version)
        .expect(200)
    ).body,
  );
  expect(published.isDraft).toBe(false);
  await a
    .write("put", `strength-plans/${draft.id}`, incomplete, revised.version)
    .expect(409);
  const schedule = strengthPlanSchema.parse(
    (
      await a
        .write(
          "post",
          `strength-plans/${draft.id}/schedule`,
          times,
          published.version,
        )
        .expect(201)
    ).body,
  );
  expect(schedule.isDraft).toBe(false);
  await a
    .write(
      "post",
      `strength-plans/${draft.id}/begin`,
      { startedAt: times.startsAt },
      published.version,
    )
    .expect(201);
  const disposable = strengthPlanSchema.parse(
    (await a.write("post", "strength-plans", input).expect(201)).body,
  );
  await a
    .write("delete", `strength-plans/${disposable.id}`, {}, disposable.version)
    .expect(200);
  await a.get(`strength-plans/${disposable.id}`).expect(404);
});

it("persists tracking types, protects built-ins and snapshots modes without dropping measurements", async () => {
  const a = client((await signUp()).cookie);
  const b = client((await signUp()).cookie);
  const plank = (
    await a
      .write("post", "exercises/from-catalog", { key: "plank" })
      .expect(201)
  ).body;
  expect(plank.loggingType).toBe("duration");
  await a
    .write(
      "put",
      `exercises/${plank.id}`,
      { name: plank.name, loggingType: "reps_load" },
      plank.version,
    )
    .expect(403);
  const custom = (
    await a
      .write("post", "exercises", {
        name: "Weighted hold",
        loggingType: "duration_load",
      })
      .expect(201)
  ).body;
  expect(custom.loggingType).toBe("duration_load");
  await b.get(`exercises/${custom.id}`).expect(404);
  await a
    .write("post", "exercises", {
      name: "Invalid type",
      loggingType: "distance",
    })
    .expect(422);
  const plan = (
    await a
      .write("post", "strength-plans", {
        title: "Timed workout",
        exercises: [
          {
            exerciseId: custom.id,
            sets: [
              {
                targetReps: 4,
                targetDurationSeconds: 30,
                targetWeightKg: 10,
                restSeconds: 90,
              },
            ],
          },
        ],
      })
      .expect(201)
  ).body;
  expect(plan.exercises[0].loggingType).toBe("duration_load");
  const schedule = (
    await a
      .write("post", `strength-plans/${plan.id}/schedule`, times, plan.version)
      .expect(201)
  ).body;
  const changed = (
    await a
      .write(
        "put",
        `exercises/${custom.id}`,
        { name: custom.name, loggingType: "reps" },
        custom.version,
      )
      .expect(200)
  ).body;
  expect(changed.loggingType).toBe("reps");
  const session = (
    await a
      .write(
        "post",
        `strength-plans/${schedule.id}/begin`,
        { startedAt: times.startsAt },
        schedule.version,
      )
      .expect(201)
  ).body;
  expect(session.exercises[0].loggingType).toBe("duration_load");
  expect(session.exercises[0].sets[0]).toMatchObject({
    targetReps: 4,
    targetDurationSeconds: 30,
    targetWeightKg: 10,
    restSeconds: 90,
    reps: null,
    durationSeconds: null,
    completed: false,
  });
  const typed = workoutSchema.parse(session);
  const input = workoutUpdateInput.parse({
    title: typed.title,
    notes: typed.notes,
    startedAt: typed.startedAt,
    endedAt: null,
    linkedTimeBlockId: typed.linkedTimeBlockId,
    exercises: typed.exercises.map((e) => ({
      id: e.id,
      exerciseId: e.exerciseId,
      notes: e.notes,
      loggingType: "reps_load",
      sets: e.sets.map((s) => ({
        id: s.id,
        reps: null,
        durationSeconds: 30,
        weightKg: 10,
        completed: true,
        skipped: false,
        targetReps: s.targetReps,
        targetWeightKg: s.targetWeightKg,
        targetDurationSeconds: s.targetDurationSeconds,
        restSeconds: s.restSeconds,
      })),
    })),
  });
  const saved = (
    await a
      .write("put", `strength-workouts/${session.id}`, input, session.version)
      .expect(200)
  ).body;
  expect(saved.exercises[0].loggingType).toBe("duration_load");
  expect(saved.exercises[0].sets[0]).toMatchObject({
    targetReps: 4,
    durationSeconds: 30,
    weightKg: 10,
    completed: true,
  });
  const updatedPlan = (
    await a
      .write(
        "put",
        `strength-plans/${plan.id}`,
        {
          title: plan.title,
          exercises: plan.exercises.map(
            (e: { exerciseId: string; sets: object[] }) => ({
              exerciseId: e.exerciseId,
              sets: e.sets,
            }),
          ),
        },
        plan.version,
      )
      .expect(200)
  ).body;
  expect(updatedPlan.exercises[0].loggingType).toBe("reps");
  expect(updatedPlan.exercises[0].sets[0]).toMatchObject({
    targetDurationSeconds: 30,
    targetReps: 4,
    targetWeightKg: 10,
  });
  expect(
    (await a.get(`strength-plans/${schedule.id}`)).body.exercises[0]
      .loggingType,
  ).toBe("duration_load");
});
