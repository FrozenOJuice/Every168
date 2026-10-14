import { describe, it, expect } from "vitest";
import { setInput, workoutUpdateInput } from "@168hours/contracts";
import {
  emptySet,
  planInput,
  sessionInput,
  type SessionDraft,
} from "./strength-draft";
const id = "00000000-0000-4000-8000-000000000001";
describe("Strength target and actual boundaries", () => {
  it("keeps unset performance unknown and rejects completed or skipped contradictions", () => {
    expect(emptySet()).toMatchObject({
      reps: null,
      weightKg: null,
      durationSeconds: null,
      completed: false,
      skipped: false,
    });
    expect(setInput.safeParse({ completed: true }).success).toBe(false);
    expect(
      setInput.safeParse({ completed: true, skipped: true, reps: 8 }).success,
    ).toBe(false);
    expect(
      setInput.safeParse({ completed: false, skipped: true, targetReps: 8 })
        .success,
    ).toBe(true);
  });
  it("captures reusable targets without completion, nested record IDs or recorded performance", () => {
    const e = {
      id,
      exerciseId: id,
      name: "Squat",
      notes: null,
      sets: [
        {
          ...emptySet(),
          id,
          reps: 7,
          weightKg: 45,
          completed: true,
          targetReps: 8,
          targetWeightKg: 50,
        },
      ],
    };
    const plan = planInput("A", null, [e], true);
    expect(plan.exercises[0]!.sets[0]).toEqual({
      targetReps: 8,
      targetWeightKg: 50,
      targetDurationSeconds: null,
      restSeconds: null,
    });
    expect(plan.exercises[0]).not.toHaveProperty("id");
    const input: SessionDraft = {
      title: "A",
      notes: null,
      startedAt: "2026-10-14T15:00:00Z",
      endedAt: null,
      linkedTimeBlockId: null,
      exercises: [e],
    };
    expect(
      workoutUpdateInput.parse(sessionInput(input)).exercises[0]!.sets[0],
    ).toMatchObject({
      id,
      targetReps: 8,
      reps: 7,
      weightKg: 45,
      completed: true,
    });
    expect(sessionInput(input).exercises[0]).not.toHaveProperty("name");
  });
});
