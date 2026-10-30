import {
  clippedSeconds,
  activeIntervals,
  durationSeconds,
  intervalCoverage,
  overlaps,
  type Interval,
} from "@168hours/domain-utils";
type Timed = Interval & {
  id: string;
  categoryId: string | null;
  excludedIntervals?: Interval[];
};
const recordedSeconds = (entry: Timed, range: Interval) =>
  activeIntervals(entry, entry.excludedIntervals).reduce(
    (sum, span) => sum + clippedSeconds(span, range),
    0,
  );
export function summarizeWeek(
  blocks: Timed[],
  entries: Timed[],
  categories: { id: string; name: string; color: string | null }[],
  range: Interval,
) {
  const overlapPairs: [string, string][] = [];
  for (let i = 0; i < blocks.length; i++)
    for (let j = i + 1; j < blocks.length; j++)
      if (overlaps(blocks[i]!, blocks[j]!))
        overlapPairs.push([blocks[i]!.id, blocks[j]!.id]);
  const plannedSeconds = blocks.reduce(
    (n, b) => n + clippedSeconds(b, range),
    0,
  );
  const coverageSeconds = intervalCoverage(blocks, range);
  const keys = new Set([...blocks, ...entries].map((b) => b.categoryId));
  return {
    calendarSeconds: durationSeconds(range.startsAt, range.endsAt),
    plannedSeconds,
    coverageSeconds,
    unallocatedSeconds:
      durationSeconds(range.startsAt, range.endsAt) - coverageSeconds,
    overlapSeconds: plannedSeconds - coverageSeconds,
    overlapPairs,
    recordedSeconds: entries.length
      ? entries.reduce((n, e) => n + recordedSeconds(e, range), 0)
      : null,
    categories: [...keys].map((categoryId) => {
      const category = categories.find((c) => c.id === categoryId);
      const actual = entries.filter((e) => e.categoryId === categoryId);
      return {
        categoryId,
        name: category?.name ?? "Uncategorized",
        color: category?.color ?? null,
        plannedSeconds: blocks
          .filter((b) => b.categoryId === categoryId)
          .reduce((n, b) => n + clippedSeconds(b, range), 0),
        recordedSeconds: actual.length
          ? actual.reduce((n, e) => n + recordedSeconds(e, range), 0)
          : null,
      };
    }),
  };
}
