import type { Block, Week } from "@168hours/contracts";
/** Week responses overlap by time; command inputs must contain one current record per identity. */
export function calendarBlocks(weeks: Pick<Week, "blocks">[]): Block[] {
  const records = new Map<string, Block>();
  for (const week of weeks)
    for (const block of week.blocks) {
      const previous = records.get(block.id);
      if (!previous || block.version > previous.version)
        records.set(block.id, block);
    }
  return [...records.values()];
}
