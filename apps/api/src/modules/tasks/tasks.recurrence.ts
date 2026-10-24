import { addDays, daysBetween } from "@168hours/domain-utils";
import { dateSchema, type TaskRepeat } from "@168hours/contracts";
export function nextTaskDate(date: string, anchor: string, repeat: TaskRepeat) {
  let next: string;
  if (repeat.frequency !== "monthly")
    next = addDays(date, repeat.frequency === "daily" ? 1 : 7);
  else {
    const first = addDays(date.slice(0, 7) + "-01", 32).slice(0, 7) + "-01";
    if (!dateSchema.safeParse(first).success) return null;
    const last = new Date(first + "T00:00:00Z");
    last.setUTCMonth(last.getUTCMonth() + 1, 0);
    const length = last.getUTCDate();
    next =
      first.slice(0, 8) +
      String(Math.min(Number(anchor.slice(8)), length)).padStart(2, "0");
  }
  return !dateSchema.safeParse(next).success ||
    (repeat.until && next > repeat.until)
    ? null
    : next;
}
export function shiftTaskDate(date: string | null, from: string, to: string) {
  return date ? addDays(date, daysBetween(from, to)) : null;
}
