import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import request from "supertest";
import {
  trainingProgramSchema,
  programOccurrenceSchema,
  type TrainingProgram,
  type Workout,
} from "@168hours/contracts";
import { testApp, origin, commandHeaders } from "./helpers.js";
const { app, signUp } = testApp();
function client(cookie: string) {
  return {
    get: (path: string) =>
      request(app).get(`/api/v1/${path}`).set("Cookie", cookie),
    write: (
      method: "post" | "put" | "delete",
      path: string,
      data: object = {},
      version = 1,
      key: string = randomUUID(),
    ) =>
      request(app)
        [method](`/api/v1/${path}`)
        .set("Cookie", cookie)
        .set("Origin", origin)
        .set({ ...commandHeaders(version), "Idempotency-Key": key })
        .send(data),
  };
}
type Client = ReturnType<typeof client>;
async function fixture() {
  const a = client((await signUp()).cookie);
  const me = (await a.get("me")).body;
  await a
    .write(
      "put",
      "preferences",
      {
        timezone: "America/Vancouver",
        weekStartsOn: 1,
        weightUnit: "kg",
        distanceUnit: "km",
      },
      me.preferences.version,
    )
    .expect(200);
  const { body: e } = await a
    .write("post", "exercises", { name: "Program squat" })
    .expect(201);
  const plans = [];
  for (const title of ["Workout A", "Workout B"]) {
    plans.push(
      (
        await a
          .write("post", "strength-plans", {
            title,
            exercises: [
              {
                exerciseId: e.id,
                sets: [{ targetReps: 8, targetWeightKg: 40 }],
              },
            ],
          })
          .expect(201)
      ).body,
    );
  }
  const input = {
    title: "A/B training",
    startDate: "2026-03-07",
    trainingDays: [0, 2, 4],
    steps: plans.map((w) => ({ workoutId: w.id })),
  };
  const p = trainingProgramSchema.parse(
    (await a.write("post", "training-programs", input).expect(201)).body,
  );
  const get = async () =>
    trainingProgramSchema.parse(
      (await a.get(`training-programs/${p.id}`).expect(200)).body,
    );
  const action = (
    name: string,
    data: object,
    program: TrainingProgram,
    key?: string,
  ) =>
    a.write(
      "post",
      `training-programs/${p.id}/${name}`,
      data,
      program.version,
      key,
    );
  return { a, e, plans, p, input, get, action };
}
async function finish(a: Client, w: Workout, endedAt: string) {
  return (
    await a
      .write(
        "put",
        `strength-workouts/${w.id}`,
        {
          title: w.title,
          notes: w.notes,
          startedAt: w.startedAt,
          endedAt,
          linkedTimeBlockId: w.linkedTimeBlockId,
          exercises: w.exercises.map((e) => ({
            id: e.id,
            exerciseId: e.exerciseId,
            sets: e.sets.map((s) => ({
              id: s.id,
              reps: 8,
              weightKg: null,
              completed: true,
              skipped: false,
            })),
          })),
        },
        w.version,
      )
      .expect(200)
  ).body as Workout;
}
it("creates ordered programs, starts one independent session, advances on completion across a timezone/DST boundary and wraps cycles", async () => {
  const { a, p, plans, get, action } = await fixture();
  expect(p.next).toMatchObject({
    sequence: 0,
    position: 0,
    cycle: 1,
    suggestedDate: "2026-03-08",
    occurrence: null,
  });
  expect(
    (await a.get("strength-plans?kind=scheduled")).body.items,
  ).toHaveLength(0);
  const start = { sequence: 0, startedAt: "2026-03-08T09:30:00Z" },
    key = randomUUID();
  const w = (await action("begin", start, p, key).expect(201)).body as Workout;
  expect(w.exercises[0]?.sets[0]).toMatchObject({
    targetReps: 8,
    targetWeightKg: 40,
    reps: null,
    weightKg: null,
    completed: false,
  });
  expect((await action("begin", start, p, key).expect(201)).body.id).toBe(w.id);
  let current = await get();
  expect(current.next.occurrence?.session?.id).toBe(w.id);
  const resumed = (await action("begin", start, current).expect(201)).body;
  expect(resumed.id).toBe(w.id);
  current = await get();
  await action("skip", { sequence: 0 }, current).expect(422);
  await finish(a, w, "2026-03-08T10:30:00Z");
  const next = await get();
  expect(next).toMatchObject({
    completedCount: 1,
    next: {
      sequence: 1,
      position: 1,
      cycle: 1,
      suggestedDate: "2026-03-10",
      workoutId: plans[1].id,
    },
  });
  // Finishing changes progress even though it does not edit the program revision.
  await action("begin", start, current).expect(409);
  const w2 = (
    await action(
      "begin",
      { sequence: 1, startedAt: "2026-03-10T18:00:00Z" },
      next,
    ).expect(201)
  ).body;
  await finish(a, w2, "2026-03-10T19:00:00Z");
  expect(await get()).toMatchObject({
    completedCount: 2,
    next: { sequence: 2, cycle: 2, position: 0, suggestedDate: "2026-03-12" },
  });
  const history = (
    await a.get(`training-programs/${p.id}/history?limit=1`).expect(200)
  ).body;
  expect(programOccurrenceSchema.parse(history.items[0]).status).toBe(
    "completed",
  );
  expect(
    (
      await a
        .get(
          `training-programs/${p.id}/history?limit=1&cursor=${history.nextCursor}`,
        )
        .expect(200)
    ).body.items[0].session.id,
  ).toBe(w.id);
  expect(
    (await a.get(`training-program-for-session/${w.id}`).expect(200)).body
      .program.programId,
  ).toBe(p.id);
});
it("reschedules one Calendar entry, preserves snapshot targets, rejects stale Calendar revisions and advances from Calendar completion", async () => {
  const { a, p, plans, get, action } = await fixture();
  const scheduled = trainingProgramSchema.parse(
    (
      await action(
        "schedule",
        {
          sequence: 0,
          startsAt: "2026-03-08T17:00:00Z",
          endsAt: "2026-03-08T18:00:00Z",
        },
        p,
      ).expect(200)
    ).body,
  );
  const plan = scheduled.next.plan!,
    block = scheduled.next.block!;
  const changed = (
    await a
      .write(
        "put",
        `strength-plans/${plans[0].id}`,
        { title: "Changed source", isDraft: true, exercises: [] },
        plans[0].version,
      )
      .expect(200)
  ).body;
  expect(changed.title).toBe("Changed source");
  const current = await get();
  expect(current.next.plan?.title).toBe("Workout A");
  expect(current.next.plan?.exercises[0]?.sets[0]?.targetReps).toBe(8);
  const moved = trainingProgramSchema.parse(
    (
      await action(
        "schedule",
        {
          sequence: 0,
          blockVersion: block.version,
          startsAt: "2026-03-09T17:00:00Z",
          endsAt: "2026-03-09T18:00:00Z",
        },
        current,
      ).expect(200)
    ).body,
  );
  expect(moved.next.block?.id).toBe(block.id);
  expect(moved.next.plan?.id).toBe(plan.id);
  expect(moved.next.sequence).toBe(0);
  await action(
    "schedule",
    {
      sequence: 0,
      blockVersion: block.version,
      startsAt: "2026-03-10T17:00:00Z",
      endsAt: "2026-03-10T18:00:00Z",
    },
    moved,
  ).expect(409);
  const w = (
    await a
      .write(
        "post",
        `strength-plans/${plan.id}/begin`,
        { startedAt: "2026-03-09T17:00:00Z" },
        moved.next.plan!.version,
      )
      .expect(201)
  ).body;
  expect(w.linkedTimeBlockId).toBe(block.id);
  await finish(a, w, "2026-03-09T18:00:00Z");
  expect(await get()).toMatchObject({
    completedCount: 1,
    next: { sequence: 1, title: "Workout B" },
  });
});
it("skips remove their scheduled copies and Calendar time, concurrent actions cannot advance twice, and pause blocks new actions", async () => {
  const { a, p, get, action } = await fixture();
  let current = trainingProgramSchema.parse(
    (
      await action(
        "schedule",
        {
          sequence: 0,
          startsAt: "2026-03-08T17:00:00Z",
          endsAt: "2026-03-08T18:00:00Z",
        },
        p,
      ).expect(200)
    ).body,
  );
  const block = current.next.block!,
    plan = current.next.plan!;
  const results = await Promise.all([
    action("skip", { sequence: 0, blockVersion: block.version }, current),
    action("skip", { sequence: 0, blockVersion: block.version }, current),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  current = await get();
  expect(current).toMatchObject({
    skippedCount: 1,
    next: { sequence: 1, position: 1 },
  });
  await a.get(`strength-plans/${plan.id}`).expect(404);
  await a.get(`time-blocks/${block.id}`).expect(404);
  const paused = trainingProgramSchema.parse(
    (
      await a
        .write(
          "put",
          `training-programs/${p.id}/paused`,
          { paused: true },
          current.version,
        )
        .expect(200)
    ).body,
  );
  expect((await a.get("training-programs")).body.items).toHaveLength(0);
  expect(
    (await a.get("training-programs?paused=paused")).body.items[0].id,
  ).toBe(p.id);
  await action(
    "begin",
    { sequence: 1, startedAt: "2026-03-10T17:00:00Z" },
    paused,
  ).expect(422);
  await action("skip", { sequence: 1 }, paused).expect(422);
  const resumed = trainingProgramSchema.parse(
    (
      await a
        .write(
          "put",
          `training-programs/${p.id}/paused`,
          { paused: false },
          paused.version,
        )
        .expect(200)
    ).body,
  );
  const results2 = await Promise.all([
    action(
      "begin",
      { sequence: 1, startedAt: "2026-03-10T17:00:00Z" },
      resumed,
    ),
    action(
      "begin",
      { sequence: 1, startedAt: "2026-03-10T17:00:00Z" },
      resumed,
    ),
  ]);
  expect(results2.map((r) => r.status).sort()).toEqual([201, 409]);
  expect((await a.get("strength-workouts")).body.items).toHaveLength(1);
});
it("edits ordered steps using stable IDs and keeps already prepared workouts independent; missing sources can be skipped", async () => {
  const { a, p, plans, input, get, action } = await fixture();
  const scheduled = trainingProgramSchema.parse(
    (
      await action(
        "schedule",
        {
          sequence: 0,
          startsAt: "2026-03-08T17:00:00Z",
          endsAt: "2026-03-08T18:00:00Z",
        },
        p,
      ).expect(200)
    ).body,
  );
  const updated = trainingProgramSchema.parse(
    (
      await a
        .write(
          "put",
          `training-programs/${p.id}`,
          {
            ...input,
            steps: [
              { id: p.steps[1]!.id, workoutId: plans[1].id },
              { id: p.steps[0]!.id, workoutId: plans[0].id },
            ],
          },
          scheduled.version,
        )
        .expect(200)
    ).body,
  );
  expect(updated.next.plan?.id).toBe(scheduled.next.plan?.id);
  const w = (
    await action(
      "begin",
      { sequence: 0, startedAt: "2026-03-08T17:00:00Z" },
      updated,
    ).expect(201)
  ).body;
  await finish(a, w, "2026-03-08T18:00:00Z");
  let current = await get();
  expect(current.next).toMatchObject({
    position: 0,
    cycle: 2,
    title: "Workout B",
  });
  await a
    .write("delete", `strength-plans/${plans[1].id}`, {}, plans[1].version)
    .expect(200);
  current = await get();
  expect(current.next.available).toBe(false);
  await action(
    "begin",
    { sequence: 1, startedAt: "2026-03-10T17:00:00Z" },
    current,
  ).expect(422);
  await action("skip", { sequence: 1 }, current).expect(200);
  expect((await get()).next.title).toBe("Workout A");
});
it("retains sessions and Calendar entries after program deletion and returns the latest deleted session to its program step", async () => {
  const { a, p, get, action } = await fixture();
  const scheduled = trainingProgramSchema.parse(
    (
      await action(
        "schedule",
        {
          sequence: 0,
          startsAt: "2026-03-08T17:00:00Z",
          endsAt: "2026-03-08T18:00:00Z",
        },
        p,
      ).expect(200)
    ).body,
  );
  const w = (
    await action(
      "begin",
      { sequence: 0, startedAt: "2026-03-08T17:00:00Z" },
      scheduled,
    ).expect(201)
  ).body;
  const finished = await finish(a, w, "2026-03-08T18:00:00Z");
  await a
    .write("delete", `strength-workouts/${w.id}`, {}, finished.version)
    .expect(200);
  let current = await get();
  expect(current).toMatchObject({
    completedCount: 0,
    next: { sequence: 0, occurrence: { session: null } },
  });
  const replacement = (
    await action(
      "begin",
      { sequence: 0, startedAt: "2026-03-08T17:00:00Z" },
      current,
    ).expect(201)
  ).body;
  current = await get();
  await a
    .write("delete", `training-programs/${p.id}`, {}, current.version)
    .expect(200);
  await a.get(`training-programs/${p.id}`).expect(404);
  await a.get(`strength-workouts/${replacement.id}`).expect(200);
  await a.get(`time-blocks/${scheduled.next.block!.id}`).expect(200);
  expect(
    (await a.get(`training-program-for-session/${replacement.id}`)).body
      .program,
  ).toBeNull();
});
it("scopes all references and actions to owners, rejects drafts and invalid sequences, validates revisions and idempotency", async () => {
  const { a, p, plans, input } = await fixture(),
    b = client((await signUp()).cookie);
  await b.get(`training-programs/${p.id}`).expect(404);
  await b.get(`training-programs/${p.id}/history`).expect(404);
  await b.write("post", "training-programs", input).expect(404);
  for (const [method, suffix, data] of [
    ["put", "", input],
    ["delete", "", {}],
    ["put", "/paused", { paused: true }],
    ["post", "/begin", { sequence: 0, startedAt: "2026-03-08T17:00:00Z" }],
    ["post", "/skip", { sequence: 0 }],
    [
      "post",
      "/schedule",
      {
        sequence: 0,
        startsAt: "2026-03-08T17:00:00Z",
        endsAt: "2026-03-08T18:00:00Z",
      },
    ],
  ] as const) {
    await b
      .write(method, `training-programs/${p.id}${suffix}`, data)
      .expect(404);
  }
  await a
    .write("post", "training-programs", { ...input, steps: [] })
    .expect(422);
  await a
    .write("post", "training-programs", { ...input, trainingDays: [1, 1] })
    .expect(422);
  await a
    .write("put", `training-programs/${p.id}`, {
      ...input,
      steps: [{ id: randomUUID(), workoutId: plans[0].id }],
    })
    .expect(422);
  await a
    .write("post", `training-programs/${p.id}/schedule`, {
      sequence: 0,
      startsAt: "2026-03-08T18:00:00Z",
      endsAt: "2026-03-08T17:00:00Z",
    })
    .expect(422);
  const draft = (
    await a
      .write("post", "strength-plans", {
        title: "Draft",
        isDraft: true,
        exercises: [],
      })
      .expect(201)
  ).body;
  await a
    .write("post", "training-programs", {
      ...input,
      steps: [{ workoutId: draft.id }],
    })
    .expect(422);
  const key = randomUUID();
  const created = (
    await a.write("post", "training-programs", input, 1, key).expect(201)
  ).body;
  expect(
    (await a.write("post", "training-programs", input, 1, key).expect(201)).body
      .id,
  ).toBe(created.id);
  await a
    .write("post", "training-programs", { ...input, title: "Other" }, 1, key)
    .expect(409);
  await request(app).get("/api/v1/training-programs").expect(401);
});

it("reconnects Calendar undo to the same occurrence and prevents stale restoration after replacing or skipping its schedule", async () => {
  const { a, p, get, action } = await fixture();
  const dates = {
    startsAt: "2026-03-08T17:00:00Z",
    endsAt: "2026-03-08T18:00:00Z",
  };
  let current = trainingProgramSchema.parse(
    (await action("schedule", { sequence: 0, ...dates }, p).expect(200)).body,
  );
  const planId = current.next.plan!.id;
  const deleted = (
    await a
      .write(
        "delete",
        `time-blocks/${current.next.block!.id}`,
        {},
        current.next.block!.version,
      )
      .expect(200)
  ).body;
  current = await get();
  expect(current.next.block).toBeNull();
  expect(current.next.plan!.id).toBe(planId);
  const restored = (
    await a
      .write("post", `time-block-deletions/${deleted.undoId}/undo`)
      .expect(200)
  ).body;
  current = await get();
  expect(current.next.block!.id).toBe(restored.id);
  const removedAgain = (
    await a
      .write("delete", `time-blocks/${restored.id}`, {}, restored.version)
      .expect(200)
  ).body;
  current = await get();
  await action(
    "schedule",
    { sequence: 0, ...dates, blockVersion: restored.version },
    current,
  ).expect(409);
  current = trainingProgramSchema.parse(
    (await action("schedule", { sequence: 0, ...dates }, current).expect(200))
      .body,
  );
  expect(current.next.plan!.id).toBe(planId);
  expect(current.next.block!.id).not.toBe(restored.id);
  await a
    .write("post", `time-block-deletions/${removedAgain.undoId}/undo`)
    .expect(409);
  const deletion = (
    await a
      .write(
        "delete",
        `time-blocks/${current.next.block!.id}`,
        {},
        current.next.block!.version,
      )
      .expect(200)
  ).body;
  current = await get();
  await action("skip", { sequence: 0 }, current).expect(200);
  await a
    .write("post", `time-block-deletions/${deletion.undoId}/undo`)
    .expect(409);
  expect(await get()).toMatchObject({ skippedCount: 1, next: { sequence: 1 } });
});
