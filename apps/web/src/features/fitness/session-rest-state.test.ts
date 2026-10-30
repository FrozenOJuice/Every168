import { expect, it } from "vitest";
import {
  nextSessionRest,
  undoSessionRest,
  reconcileSessionRest,
  restSource,
} from "./session-rest-state";
import { emptySet, type ExerciseDraft } from "./strength-draft";
const exercise = (key: string): ExerciseDraft => ({
  clientKey: key,
  exerciseId: key,
  name: key,
  notes: null,
  sets: [{ ...emptySet(), restSeconds: 90, clientKey: `${key}-set` }],
});
it("only cancels rest for its own set, including duplicated definitions", () => {
  const a = exercise("a");
  const b = { ...exercise("b"), exerciseId: a.exerciseId };
  const rest = nextSessionRest(
    null,
    60,
    a.name,
    restSource(a, a.sets[0]!),
    1000,
  )!;
  expect(undoSessionRest(rest, restSource(b, b.sets[0]!))).toBe(rest);
  expect(
    undoSessionRest(
      rest,
      restSource(a, { ...emptySet(), clientKey: "a-other-set" }),
    ),
  ).toBe(rest);
  expect(undoSessionRest(rest, restSource(a, a.sets[0]!))).toBeNull();
  expect(
    nextSessionRest(rest, null, b.name, restSource(b, b.sets[0]!), 2000),
  ).toBe(rest);
  expect(
    nextSessionRest(rest, 0, a.name, restSource(a, a.sets[0]!), 2000),
  ).toBeNull();
});
it("keeps the deadline across server identity assignment and reload, and clears removed origins", () => {
  const a = exercise("local");
  const rest = nextSessionRest(
    null,
    90,
    a.name,
    restSource(a, a.sets[0]!),
    1000,
  )!;
  a.id = "server-exercise";
  a.sets[0]!.id = "server-set";
  const saved = reconcileSessionRest(rest, [a])!;
  expect(saved.until).toBe(rest.until);
  const reloaded = {
    ...a,
    clientKey: a.id,
    sets: a.sets.map((set) => ({ ...set, clientKey: set.id })),
  };
  expect(reconcileSessionRest(saved, [reloaded])).toBe(saved);
  expect(
    undoSessionRest(saved, restSource(reloaded, reloaded.sets[0]!)),
  ).toBeNull();
  expect(reconcileSessionRest(saved, [])).toBeNull();
});
it("a new timed rest replaces the active rest with the new origin", () => {
  const a = exercise("a"),
    b = exercise("b");
  const rest = nextSessionRest(
    null,
    60,
    a.name,
    restSource(a, a.sets[0]!),
    1000,
  )!;
  expect(
    nextSessionRest(rest, 30, b.name, restSource(b, b.sets[0]!), 2000),
  ).toMatchObject({
    until: 32000,
    exercise: b.name,
    source: restSource(b, b.sets[0]!),
  });
});

it("adjusts the active deadline from its original start without restarting elapsed rest", () => {
  const a = exercise("a");
  const b = exercise("b");
  const rest = nextSessionRest(
    null,
    90,
    a.name,
    restSource(a, a.sets[0]!),
    1000,
  )!;
  b.sets[0]!.restSeconds = 120;
  expect(reconcileSessionRest(rest, [a, b])).toBe(rest);
  a.sets[0]!.restSeconds = 120;
  const longer = reconcileSessionRest(rest, [a, b])!;
  expect(longer.until).toBe(121000);
  expect(longer.startedAt).toBe(1000);
  a.sets[0]!.restSeconds = 30;
  const shorter = reconcileSessionRest(JSON.parse(JSON.stringify(longer)), [
    a,
    b,
  ])!;
  expect(shorter.until).toBe(31000);
  expect(shorter.startedAt).toBe(1000);
  a.sets[0]!.restSeconds = 0;
  expect(reconcileSessionRest(shorter, [a, b])).toBeNull();
  a.sets[0]!.restSeconds = null;
  expect(reconcileSessionRest(shorter, [a, b])).toBeNull();
  expect(reconcileSessionRest(null, [a, b])).toBeNull();
});
