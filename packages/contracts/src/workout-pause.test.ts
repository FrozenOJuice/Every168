import { expect, it } from "vitest";
import { workoutUpdateInput } from "./exercise";
const input = {
  title: "Workout",
  startedAt: "2026-10-28T12:00:00Z",
  endedAt: null,
  exercises: [],
};
it("rejects reversed, overlapping, out-of-bounds and non-final open pauses", () => {
  const at = (minute: number) =>
    new Date(Date.UTC(2026, 9, 28, 12, minute)).toISOString();
  for (const pauses of [
    [{ startsAt: at(-1), endsAt: at(5) }],
    [{ startsAt: at(10), endsAt: at(5) }],
    [{ startsAt: at(10), endsAt: at(10) }],
    [
      { startsAt: at(10), endsAt: at(20) },
      { startsAt: at(15), endsAt: at(25) },
    ],
    [
      { startsAt: at(10), endsAt: null },
      { startsAt: at(20), endsAt: at(25) },
    ],
  ])
    expect(workoutUpdateInput.safeParse({ ...input, pauses }).success).toBe(
      false,
    );
  expect(
    workoutUpdateInput.safeParse({
      ...input,
      pauses: [{ startsAt: at(10), endsAt: null }],
    }).success,
  ).toBe(true);
});
