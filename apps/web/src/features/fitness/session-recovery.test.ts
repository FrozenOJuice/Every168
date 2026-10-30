import { expect, it } from "vitest";
import { workoutSchema, workoutUpdateInput } from "@168hours/contracts";
import {
  emptySet,
  sessionDraft,
  sessionInput,
  type SessionDraft,
} from "./strength-draft";
import { acceptSessionSave, recoverSession } from "./session-recovery";

const session = workoutSchema.parse({
  startingSetup: null,
  id: "00000000-0000-4000-8000-000000000001",
  version: 3,
  createdAt: "2026-10-23T12:00:00Z",
  updatedAt: "2026-10-23T12:00:00Z",
  title: "Workout",
  notes: null,
  startedAt: "2026-10-23T12:00:00Z",
  endedAt: null,
  linkedTimeBlockId: null,
  exercises: [],
});
const invalidInput = () => ({
  ...sessionDraft(session),
  title: "",
  notes: "Keep this note",
  exercises: [
    {
      exerciseId: session.id,
      name: "Squat",
      clientKey: "exercise-key",
      notes: null,
      intentTags: ["x".repeat(33)],
      sets: [
        {
          ...emptySet(),
          clientKey: "set-key",
          reps: 0,
          restSeconds: -1,
          distanceMeters: -2,
          laps: 1.5,
        },
      ],
    },
  ],
});

it("retains invalid local pause corrections through draft recovery without replacing saved instants", () => {
  const input = {
    ...sessionDraft(session),
    endedAt: "2026-10-23T14:00:00Z",
    pauses: [
      {
        startsAt: "2026-10-23T12:30:12.123Z",
        endsAt: "2026-10-23T13:00:14.456Z",
      },
    ],
  };
  const invalidTimes = {
    "pauses.0.startsAt": "2026-03-08T02:30",
    "pauses.0.endsAt": "2026-11-01T01:30",
  };
  const restored = recoverSession(
    JSON.stringify({ input, invalidTimes, version: session.version }),
    session,
  );
  expect(restored).toMatchObject({
    dirty: true,
    conflict: false,
    invalidTimes,
  });
  expect(restored.input.pauses).toEqual(input.pauses);
});
it("recovers invalid session measurements and other edits without relaxing save validation", () => {
  const input = invalidInput();
  const recovered = recoverSession(
    JSON.stringify({ input, version: 3 }),
    session,
  );
  expect(recovered).toMatchObject({
    input,
    version: 3,
    dirty: true,
    conflict: false,
  });
  expect(
    workoutUpdateInput.safeParse(sessionInput(recovered.input)).success,
  ).toBe(false);
});
it("retains invalid drafts on a revision conflict without authorizing an overwrite", () => {
  const input = invalidInput();
  expect(
    recoverSession(JSON.stringify({ input, version: 2 }), session),
  ).toMatchObject({
    input,
    version: 2,
    dirty: true,
    conflict: true,
  });
});
it("retains both raw invalid times even when the canonical payload matches the server", () => {
  const invalidTimes = { startedAt: "", endedAt: "2026-03-08T02:30" };
  expect(
    recoverSession(
      JSON.stringify({
        input: sessionDraft(session),
        version: 3,
        invalidTimes,
      }),
      session,
    ),
  ).toMatchObject({ invalidTimes, dirty: true, conflict: false });
});
it("recognizes a confirmed payload after a lost response and ignores malformed storage", () => {
  expect(
    recoverSession(
      JSON.stringify({ input: sessionDraft(session), version: 2 }),
      session,
    ),
  ).toMatchObject({ version: 3, dirty: false, conflict: false });
  for (const raw of [
    null,
    "{",
    JSON.stringify({ input: { exercises: null }, version: 3 }),
  ])
    expect(recoverSession(raw, session)).toMatchObject({
      input: sessionDraft(session),
      dirty: false,
    });
});

it("retains an uncertain request key even when the server already has its payload", () => {
  const input = sessionDraft(session);
  const pending = {
    input,
    version: 2,
    key: "00000000-0000-4000-8000-000000000002",
  };
  expect(
    recoverSession(JSON.stringify({ input, version: 2, pending }), session),
  ).toMatchObject({ pending, conflict: false, dirty: true });
});
it("rebases server IDs after edits and reordering during an in-flight save", () => {
  const old: SessionDraft = invalidInput();
  old.exercises[0]!.intentTags = [];
  old.exercises[0]!.sets = [emptySet()];
  const second = {
    ...old.exercises[0]!,
    clientKey: "second-exercise",
    sets: [emptySet()],
  };
  old.exercises.push(second);
  const saved = {
    ...session,
    version: 4,
    exercises: old.exercises.map((e, i) => ({
      ...e,
      id: `assigned-${i}`,
      exerciseNameSnapshot: e.name,
      sets: e.sets.map((s) => ({ ...s, id: `set-${i}` })),
    })),
  } as unknown as typeof session;
  const edited = {
    ...old,
    title: "Newer title",
    exercises: [
      second,
      {
        ...old.exercises[0]!,
        sets: [{ ...old.exercises[0]!.sets[0]!, targetReps: 8 }, emptySet()],
      },
    ],
  };
  const result = acceptSessionSave(
    { input: edited, version: 3, dirty: true, conflict: false },
    { input: old, version: 3, key: "key" },
    saved,
  );
  expect(result).toMatchObject({
    version: 4,
    dirty: true,
    input: { title: "Newer title" },
  });
  expect(result.input.exercises.map((e) => e.id)).toEqual([
    "assigned-1",
    "assigned-0",
  ]);
  expect(result.input.exercises[1]!.sets[0]).toMatchObject({
    id: "set-0",
    targetReps: 8,
  });
  expect(result.input.exercises[1]!.sets[1]!.id).toBeUndefined();
});
