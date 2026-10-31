import { z } from "zod";
import {
  calendarItemUpdateInput,
  blockSchema,
  timeEntrySchema,
  blockEditSchema,
  blockDeletionSchema,
  calendarItemSchema,
  seriesUndoResultSchema,
} from "@168hours/contracts";
import { addHistoryAction, type CalendarAction } from "./calendar-history";
import {
  getCalendarHistory,
  initializeCalendarHistory,
  updateCalendarHistory,
} from "./calendar-history-store";

const prefix = "168hours:calendar-write:v1:";
const uuid = "[0-9a-f-]{36}";
const pathPattern = new RegExp(
  `^/api/v1/(?:(?:time-blocks|time-entries)(?:/${uuid})?|calendar/(?:items(?:/${uuid})?|series(?:/${uuid}(?:/change)?)?|plans/convert|selection/(?:move|delete)|(?:snapshot-)?copy))$`,
  "i",
);
const pendingSchema = z.object({
  owner: z.uuid(),
  path: z.string().regex(pathPattern),
  method: z.enum(["POST", "PUT", "DELETE"]),
  key: z.uuid(),
  version: z
    .string()
    .regex(/^"[1-9]\d*"$/)
    .nullable(),
  body: z.string().max(256_000).nullable(),
  before: calendarItemUpdateInput.optional(),
});
type Pending = z.infer<typeof pendingSchema>;
let owner: string | null = null;
export function setCalendarWriteOwner(value: string) {
  owner = value;
  initializeCalendarHistory(value);
}
export function clearCalendarWrites() {
  owner = null;
  try {
    for (const key of Object.keys(sessionStorage))
      if (key.startsWith(prefix)) sessionStorage.removeItem(key);
  } catch {}
}
export function pendingCalendarWrite(): Pending | null {
  if (!owner) return null;
  const raw = sessionStorage.getItem(prefix + owner);
  if (!raw) return null;
  const result = pendingSchema.safeParse(JSON.parse(raw));
  if (!result.success || result.data.owner !== owner)
    throw new Error(
      "Saved Calendar recovery data could not be validated. Keep this tab open and contact support.",
    );
  return result.data;
}
const refs = z.array(
  z.object({ id: z.uuid(), version: z.number().int().positive() }),
);
function actionFor(p: Pending, data: unknown): CalendarAction | null {
  const base = { key: p.key };
  if (p.path.startsWith("/api/v1/time-entries")) {
    if (p.method !== "POST") return null;
    const entry = timeEntrySchema.parse(data);
    return {
      ...base,
      kind: "activity-create",
      resource: "entry",
      id: entry.id,
      version: entry.version,
    };
  }
  if (p.path.startsWith("/api/v1/time-blocks")) {
    const blockId = p.path.split("/").at(-1)!;
    if (p.method === "POST") {
      const b = blockSchema.parse(data);
      return {
        ...base,
        kind: "create",
        blockId: b.id,
        version: b.version,
        title: b.title,
      };
    }
    const previousVersion = Number(p.version?.slice(1, -1));
    if (p.method === "PUT") {
      const b = blockEditSchema.parse(data);
      return {
        ...base,
        kind: "edit",
        blockId: b.id,
        version: b.version,
        title: b.title,
        previousVersion,
        undoId: b.undoId,
      };
    }
    return {
      ...base,
      kind: "delete",
      blockId,
      title: "Plan",
      previousVersion,
      undoId: blockDeletionSchema.parse(data).undoId,
    };
  }
  if (/\/items(?:\/|$)/.test(p.path)) {
    if (p.method === "DELETE") return null;
    const item = calendarItemSchema.parse(data);
    if (p.method === "POST")
      return {
        ...base,
        kind: "copy",
        blocks: [],
        items: [{ id: item.id, version: item.version }],
      };
    if (!p.before) throw new Error("Missing original Calendar item");
    return {
      ...base,
      kind: "item-edit",
      itemId: item.id,
      version: item.version,
      before: p.before,
      after: {
        ...calendarItemUpdateInput.parse(JSON.parse(p.body!)),
        isException: item.isException,
      },
    };
  }
  if (/\/(snapshot-)?copy$/.test(p.path)) {
    const result = z
      .object({ createdBlocks: refs, createdItems: refs })
      .parse(data);
    return {
      ...base,
      kind: "copy",
      blocks: result.createdBlocks,
      items: result.createdItems,
    };
  }
  if (p.path.endsWith("/selection/delete"))
    return {
      ...base,
      kind: "group-delete",
      undoId: z.object({ undoId: z.uuid() }).parse(data).undoId,
    };
  const result = seriesUndoResultSchema.parse(data);
  return {
    ...base,
    ...result,
    kind: p.path.includes("/selection/move")
      ? "group-edit"
      : p.path.endsWith("/plans/convert")
        ? "conversion"
        : "series",
  };
}
async function execute(p: Pending, init: RequestInit = {}) {
  if (p.method === "PUT" && /\/calendar\/items\//.test(p.path) && !p.before) {
    const original = await globalThis.fetch(p.path, {
      credentials: "include",
      cache: "no-store",
    });
    if (!original.ok) {
      if (original.status < 500) sessionStorage.removeItem(prefix + p.owner);
      return original;
    }
    const item = calendarItemSchema.parse(await original.json());
    p = {
      ...p,
      before: calendarItemUpdateInput.parse(
        Object.fromEntries(
          Object.keys(calendarItemUpdateInput.shape).map((key) => [
            key,
            item[key as keyof typeof item],
          ]),
        ),
      ),
    };
    if (owner !== p.owner)
      throw new Error("Account changed during Calendar save");
    sessionStorage.setItem(prefix + p.owner, JSON.stringify(p));
  }
  const response = await globalThis.fetch(p.path, {
    ...init,
    method: p.method,
    body: p.body,
    credentials: "include",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": p.key,
      ...(p.version ? { "If-Match": p.version } : {}),
    },
  });
  if (owner !== p.owner) return response;
  if (response.ok) {
    // Keep the request durable until its confirmed result has reached Undo history.
    const data: unknown = await response.clone().json();
    const action = actionFor(p, data);
    if (action)
      updateCalendarHistory(p.owner, (state) =>
        addHistoryAction(state, action),
      );
    sessionStorage.removeItem(prefix + p.owner);
  } else if (response.status < 500) sessionStorage.removeItem(prefix + p.owner);
  return response;
}
/** Only Calendar commands are journalled; credentials are never persisted. */
export const calendarRecoveryFetch: typeof globalThis.fetch = async (
  input,
  init = {},
) => {
  const path = typeof input === "string" ? input : "";
  const method = init.method?.toUpperCase();
  if (
    typeof window === "undefined" ||
    !owner ||
    !pathPattern.test(path) ||
    !method ||
    !["POST", "PUT", "DELETE"].includes(method)
  )
    return globalThis.fetch(input, init);
  const headers = new Headers(init.headers),
    key = headers.get("Idempotency-Key");
  if (!key) return globalThis.fetch(input, init);
  // Undo/Redo already persist this exact command through their own receipt state.
  if (getCalendarHistory(owner).pending?.key === key)
    return globalThis.fetch(input, init);
  const existing = pendingCalendarWrite();
  if (existing) {
    if (existing.key !== key || existing.path !== path)
      throw new Error(
        "Resolve the previous Calendar change before saving another.",
      );
    return execute(existing, init);
  }
  const pending = pendingSchema.parse({
    owner,
    path,
    method,
    key,
    version: headers.get("If-Match"),
    body: typeof init.body === "string" ? init.body : null,
  });
  sessionStorage.setItem(prefix + owner, JSON.stringify(pending));
  return execute(pending, init);
};
export async function retryCalendarWrite() {
  const pending = pendingCalendarWrite();
  if (!pending) return;
  const response = await execute(pending);
  if (!response.ok)
    throw new Error(
      response.status >= 500
        ? "Could not confirm this change. Retry when the connection returns."
        : "The server rejected this change. Reload the latest Calendar before making another change.",
    );
}
