import { expect, it } from "vitest";
import { workoutSchema, workoutUpdateInput } from "@168hours/contracts";
import { emptySet, sessionDraft, sessionInput } from "./strength-draft";
import { recoverSession } from "./session-recovery";

const session = workoutSchema.parse({
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
