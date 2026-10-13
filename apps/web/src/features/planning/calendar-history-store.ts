import { z } from "zod";
import { calendarItemInput } from "@168hours/contracts";
import {
  emptyHistory,
  type CalendarAction,
  type CalendarHistory,
} from "./calendar-history";

const ref = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
});
const base = {
  key: z.string().min(1).max(200),
  transient: z.boolean().optional(),
};
const block = {
  blockId: z.string().min(1),
  title: z.string(),
  version: z.number().int().positive(),
};
const actionSchema: z.ZodType<CalendarAction> = z.discriminatedUnion("kind", [
  z.object({ ...base, kind: z.literal("create"), ...block }),
  z.object({
    ...base,
    kind: z.literal("edit"),
    ...block,
    previousVersion: z.number().int().positive(),
    undoId: z.string().min(1),
  }),
  z.object({
    ...base,
    kind: z.literal("delete"),
    blockId: block.blockId,
    title: block.title,
    previousVersion: z.number().int().positive(),
    undoId: z.string().min(1),
  }),
  z.object({
    ...base,
    kind: z.literal("copy"),
    blocks: z.array(ref).max(100),
    items: z.array(ref).max(100),
  }),
  z.object({
    ...base,
    kind: z.literal("group-delete"),
    undoId: z.string().min(1),
  }),
  z.object({
    ...base,
    kind: z.literal("item-edit"),
    itemId: z.string().min(1),
    version: block.version,
    before: calendarItemInput,
    after: calendarItemInput,
  }),
  z.object({
    ...base,
    kind: z.literal("series"),
    undoId: z.string().min(1),
    blocks: z.array(ref).max(366),
  }),
  z.object({
    ...base,
    kind: z.literal("activity-create"),
    resource: z.enum([
      "food",
      "water",
      "weight",
      "cardio",
      "strength",
      "entry",
    ]),
    id: z.string().min(1),
    version: block.version,
  }),
]);
const historySchema = z
  .object({
    actions: z.array(actionSchema).max(100),
    redo: z.array(actionSchema).max(100),
    seen: z.array(z.string()).max(200),
    pending: z
      .object({
        direction: z.enum(["undo", "redo"]),
        action: actionSchema,
        key: z.string().min(1),
      })
      .nullable(),
  })
  .refine((v) => v.actions.length + v.redo.length <= 100);
const prefix = "168hours:calendar-history:v1:";
const stores = new Map<string, CalendarHistory>();
const listeners = new Set<() => void>();
let initialized = false;
export const historyIsPersistent = (action: CalendarAction) =>
  !action.transient && action.kind !== "activity-create";
export function serializeHistory(history: CalendarHistory) {
  return JSON.stringify({
    ...history,
    actions: history.actions.filter(historyIsPersistent),
    redo: history.redo.filter(historyIsPersistent),
    pending:
      history.pending && historyIsPersistent(history.pending.action)
        ? history.pending
        : null,
  });
}
export function parseHistory(value: string | null): CalendarHistory {
  if (!value || value.length > 4_000_000) return emptyHistory();
  try {
    const parsed = historySchema.safeParse(JSON.parse(value));
    if (!parsed.success) return emptyHistory();
    const history = parsed.data;
    const stack =
      history.pending?.direction === "redo" ? history.redo : history.actions;
    if (history.pending && stack.at(-1)?.key !== history.pending.action.key)
      return emptyHistory();
    return history;
  } catch {
    return emptyHistory();
  }
}
export function clearCalendarHistory() {
  stores.clear();
  if (typeof window !== "undefined") {
    try {
      for (const key of Object.keys(sessionStorage))
        if (key.startsWith(prefix)) sessionStorage.removeItem(key);
    } catch {
      /* Memory history still works when storage is unavailable. */
    }
  }
  listeners.forEach((listener) => listener());
}
export function initializeCalendarHistory(userId: string) {
  if (stores.has(userId)) return;
  if (!initialized) {
    // Session-restoring browsers may retain sessionStorage after closing. Only an
    // actual refresh may hydrate it into a new document; fresh visits start empty.
    const navigation = performance.getEntriesByType("navigation")[0] as
      PerformanceNavigationTiming | undefined;
    if (navigation?.type !== "reload") clearCalendarHistory();
    initialized = true;
  }
  if ([...stores.keys()].some((id) => id !== userId)) clearCalendarHistory();
  let history = emptyHistory();
  try {
    history = parseHistory(sessionStorage.getItem(prefix + userId));
  } catch {
    /* Fall back to memory. */
  }
  stores.set(userId, history);
  listeners.forEach((listener) => listener());
}
const serverHistory = emptyHistory();
export const getCalendarHistory = (userId: string) =>
  stores.get(userId) ?? serverHistory;
export const calendarHistoryReady = (userId: string) => stores.has(userId);
export function subscribeCalendarHistory(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function updateCalendarHistory(
  userId: string,
  update: (history: CalendarHistory) => CalendarHistory,
) {
  // A late response after sign-out must not recreate the cleared account's history.
  if (!stores.has(userId)) return;
  const history = update(getCalendarHistory(userId));
  stores.set(userId, history);
  try {
    sessionStorage.setItem(prefix + userId, serializeHistory(history));
  } catch {
    /* The in-memory stack remains usable. */
  }
  listeners.forEach((listener) => listener());
}
