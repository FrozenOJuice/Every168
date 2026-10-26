import type { ExerciseDraft, SetDraft } from "./strength-draft";
const key = (v: { id?: string; clientKey?: string }) => v.clientKey ?? v.id;
const recorded = (s: SetDraft) =>
  s.completed ||
  s.skipped ||
  s.resultsEdited ||
  [s.reps, s.weightKg, s.durationSeconds, s.distanceMeters, s.laps].some(
    (v) => v !== null,
  );
export function removedResults(
  before: ExerciseDraft[],
  after: ExerciseDraft[],
) {
  return before.flatMap((e) => {
    const remaining = after.find((v) => key(v) === key(e));
    return e.sets.filter(
      (s) => !remaining?.sets.some((v) => key(v) === key(s)) && recorded(s),
    );
  }).length;
}
export function applyRemoval(
  current: ExerciseDraft[],
  before: ExerciseDraft[],
  after: ExerciseDraft[],
) {
  return current
    .filter(
      (e) =>
        !before.some((v) => key(v) === key(e)) ||
        after.some((v) => key(v) === key(e)),
    )
    .map((e) => {
      const old = before.find((v) => key(v) === key(e));
      const next = after.find((v) => key(v) === key(e));
      return !old || !next
        ? e
        : {
            ...e,
            sets: e.sets.filter(
              (s) =>
                !old.sets.some((v) => key(v) === key(s)) ||
                next.sets.some((v) => key(v) === key(s)),
            ),
          };
    });
}
export function restoreRemoval(
  current: ExerciseDraft[],
  before: ExerciseDraft[],
  after: ExerciseDraft[],
) {
  const result = [...current];
  for (const [index, old] of before.entries()) {
    const next = after.find((v) => key(v) === key(old));
    const at = result.findIndex((v) => key(v) === key(old));
    if (!next && at < 0)
      result.splice(Math.min(index, result.length), 0, {
        ...old,
        id: undefined,
        sets: old.sets.map((s) => ({ ...s, id: undefined })),
      });
    else if (next && at >= 0) {
      const sets = [...result[at]!.sets];
      for (const [i, s] of old.sets.entries())
        if (
          !next.sets.some((v) => key(v) === key(s)) &&
          !sets.some((v) => key(v) === key(s))
        )
          sets.splice(Math.min(i, sets.length), 0, { ...s, id: undefined });
      result[at] = { ...result[at]!, sets };
    }
  }
  return result.length <= 50 && result.every((e) => e.sets.length <= 100)
    ? result
    : null;
}
