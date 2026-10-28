import type { ExerciseDraft, SetDraft } from "./strength-draft";
export type RestSource = { exerciseKeys: string[]; setKeys: string[] };
export type SessionRest = {
  until: number;
  exercise: string;
  source: RestSource;
};
const aliases = (value: { id?: string; clientKey?: string }) => [
  ...new Set([value.id, value.clientKey].filter((key): key is string => !!key)),
];
const overlaps = (a: string[], b: string[]) => a.some((key) => b.includes(key));
export const restSource = (
  exercise: ExerciseDraft,
  set: SetDraft,
): RestSource => ({ exerciseKeys: aliases(exercise), setKeys: aliases(set) });
export function nextSessionRest(
  current: SessionRest | null,
  seconds: number | null,
  exercise: string,
  source: RestSource,
  now: number,
): SessionRest | null {
  if (seconds && seconds > 0)
    return { until: now + seconds * 1000, exercise, source };
  // Completing a later set ends this exercise's old rest, not another exercise's.
  return current && overlaps(current.source.exerciseKeys, source.exerciseKeys)
    ? null
    : current;
}
export function undoSessionRest(
  current: SessionRest | null,
  source: RestSource,
): SessionRest | null {
  return current &&
    overlaps(current.source.exerciseKeys, source.exerciseKeys) &&
    overlaps(current.source.setKeys, source.setKeys)
    ? null
    : current;
}
export function reconcileSessionRest(
  current: SessionRest | null,
  exercises: ExerciseDraft[],
): SessionRest | null {
  if (!current) return null;
  const exercise = exercises.find((e) =>
    overlaps(aliases(e), current.source.exerciseKeys),
  );
  const set = exercise?.sets.find((s) =>
    overlaps(aliases(s), current.source.setKeys),
  );
  if (!exercise || !set) return null;
  const source = restSource(exercise, set);
  const exerciseKeys = [
    ...new Set([...current.source.exerciseKeys, ...source.exerciseKeys]),
  ];
  const setKeys = [...new Set([...current.source.setKeys, ...source.setKeys])];
  return exerciseKeys.length === current.source.exerciseKeys.length &&
    setKeys.length === current.source.setKeys.length
    ? current
    : { ...current, source: { exerciseKeys, setKeys } };
}
