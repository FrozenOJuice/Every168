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

describe("workout ordering", () => {
  it("moves a whole item across several positions without changing its data or source array", async () => {
    const { moveTo } = await import("./strength-draft");
    const items = [
      { id: "first", sets: [{ reps: 8, completed: true }] },
      { id: "second", sets: [{ reps: null, completed: false }] },
      { id: "third", sets: [{ reps: 12, completed: false }] },
    ];
    const next = moveTo(items, 0, 2);
    expect(next.map((item) => item.id)).toEqual(["second", "third", "first"]);
    expect(next[2]).toBe(items[0]);
    expect(items.map((item) => item.id)).toEqual(["first", "second", "third"]);
    expect(moveTo(next, 2, 0)).toEqual(items);
    expect(moveTo(items, 0, -1)).toBe(items);
    expect(moveTo(items, 2, 3)).toBe(items);
  });
  it("keeps distinct client keys out of canonical plan and session writes", () => {
    const first = emptySet(),
      second = emptySet();
    expect(first.clientKey).not.toBe(second.clientKey);
    const exercise = {
      clientKey: "private-ui-key",
      exerciseId: id,
      name: "Squat",
      notes: null,
      sets: [first, second],
    };
    expect(planInput("A", null, [exercise]).exercises[0]).not.toHaveProperty(
      "clientKey",
    );
    expect(
      planInput("A", null, [exercise]).exercises[0]!.sets[0],
    ).not.toHaveProperty("clientKey");
    const input: SessionDraft = {
      title: "A",
      notes: null,
      startedAt: "2026-10-14T15:00:00Z",
      endedAt: null,
      linkedTimeBlockId: null,
      exercises: [exercise],
    };
    expect(sessionInput(input).exercises[0]).not.toHaveProperty("clientKey");
    expect(sessionInput(input).exercises[0]!.sets[0]).not.toHaveProperty(
      "clientKey",
    );
  });
});
