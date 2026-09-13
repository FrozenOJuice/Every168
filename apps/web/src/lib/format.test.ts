import { expect, it } from "vitest";
import { localTimeField } from "./format";

it("accepts unchanged recorded times in either occurrence of a repeated hour", () => {
  for (const instant of ["2026-11-01T07:30:37Z", "2026-11-01T08:30:37Z"]) {
    const field = localTimeField("America/Edmonton", instant);
    expect(field.safeParse("2026-11-01T01:30").success).toBe(true);
    expect(field.safeParse("2026-11-01T01:31").success).toBe(false);
  }
});

it("rejects new ambiguous or nonexistent times, including edits to a known instant", () => {
  const field = localTimeField("America/Edmonton");
  expect(field.safeParse("2026-11-01T01:30").success).toBe(false);
  expect(field.safeParse("2026-03-08T02:30").success).toBe(false);
  expect(
    localTimeField("America/Edmonton", "2026-03-08T09:30:00Z").safeParse(
      "2026-03-08T02:30",
    ).success,
  ).toBe(false);
  expect(field.safeParse("2026-03-08T03:30").success).toBe(true);
  expect(field.safeParse("").success).toBe(false);
});
