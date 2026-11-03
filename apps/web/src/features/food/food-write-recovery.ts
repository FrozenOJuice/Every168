import { createClient } from "@168hours/api-client";
import { z } from "zod";
import {
  foodInput,
  nutritionGoalsInput,
  preparationInput,
  foodFavouriteInput,
  foodEntryInput,
  foodEntryUpdate,
  quickFoodInput,
  waterInput,
  weightInput,
  foodSchema,
  foodEntrySchema,
  waterSchema,
  weightSchema,
} from "@168hours/contracts";
import { calendarRecoveryFetch } from "../planning/calendar-write-recovery";

const prefix = "168hours:food-write:v1:";
export const foodWriteEvent = "168hours:food-write";
const uuid = "[0-9a-f-]{36}";
const pathPattern = new RegExp(
  `^/api/v1/(?:nutrition-goals|foods(?:/${uuid}(?:/(?:archive|restore|favourite))?)?|food-preparations(?:/${uuid})?|food-entries(?:/quick|/${uuid}(?:/repeat)?)?|(?:water|weight)-entries(?:/${uuid})?)$`,
  "i",
);
export const foodWriteSchema = z.object({
  owner: z.uuid(),
  path: z.string().regex(pathPattern),
  method: z.enum(["POST", "PUT", "DELETE"]),
  key: z.uuid(),
  version: z
    .string()
    .regex(/^"[1-9]\d*"$/)
    .nullable(),
  body: z.string().max(256000).nullable(),
});
export type FoodWrite = z.infer<typeof foodWriteSchema>;
let owner: string | null = null;
let running = false;
let storageError: string | null = null;
const notify = () => window.dispatchEvent(new Event(foodWriteEvent));
export function setFoodWriteOwner(value: string | null) {
  owner = value;
  storageError = null;
}
export function foodWriteStorageError() {
  return storageError;
}

/** Validate the exact stored command, including allowed method/body/version pairs. */
export function parseFoodWrite(value: unknown): FoodWrite {
  const p = foodWriteSchema.parse(value);
  const parts = p.path.slice("/api/v1/".length).split("/");
  const [resource, id, action] = parts;
  const body: unknown = p.body ? JSON.parse(p.body) : {};
  const create = p.method === "POST" && (!id || id === "quick");
  if (
    (create && p.version !== null) ||
    (!create && !p.version && action !== "repeat")
  )
    throw new Error("Invalid Food revision");
  if (resource === "nutrition-goals") {
    if (p.method !== "PUT" || id)
      throw new Error("Invalid nutrition goals operation");
    nutritionGoalsInput.parse(body);
  } else if (resource === "foods") {
    if (action && p.method === "POST")
      (action === "favourite"
        ? foodFavouriteInput
        : z.object({}).strict()
      ).parse(body);
    else if ((create || (id && p.method === "PUT")) && !action)
      foodInput.parse(body);
    else throw new Error("Invalid food operation");
  } else if (resource === "food-preparations") {
    if (!(create || (id && p.method === "PUT")))
      throw new Error("Invalid preparation operation");
    preparationInput.parse(body);
  } else if (resource === "food-entries") {
    if (create) (id === "quick" ? quickFoodInput : foodEntryInput).parse(body);
    else if (
      (p.method === "PUT" && !action) ||
      (p.method === "POST" && action === "repeat")
    )
      foodEntryUpdate.parse(body);
    else if (p.method !== "DELETE" || action || p.body !== null)
      throw new Error("Invalid entry operation");
  } else {
    if (create || (id && p.method === "PUT"))
      (resource === "water-entries" ? waterInput : weightInput).parse(body);
    else if (!id || p.method !== "DELETE" || p.body !== null)
      throw new Error("Invalid measurement operation");
  }
  return p;
}
export function pendingFoodWrite() {
  if (!owner) return null;
  const raw = sessionStorage.getItem(prefix + owner);
  if (!raw) return null;
  const p = parseFoodWrite(JSON.parse(raw));
  if (p.owner !== owner)
    throw new Error("Saved Food recovery belongs to another account.");
  return p;
}
async function execute(p: FoodWrite, init: RequestInit = {}) {
  if (owner !== p.owner || running)
    throw new Error("Food change is unavailable.");
  running = true;
  notify();
  try {
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
    if (owner === p.owner && response.status < 500) {
      // An incomplete successful response must retain its original receipt.
      if (response.ok) await response.clone().json();
      sessionStorage.removeItem(prefix + p.owner);
    }
    return response;
  } finally {
    running = false;
    notify();
  }
}
export function foodWriteRunning() {
  return running;
}
const foodRecoveryFetch: typeof globalThis.fetch = async (input, init = {}) => {
  const path = typeof input === "string" ? input : "";
  const method = init.method?.toUpperCase();
  if (
    typeof window === "undefined" ||
    !owner ||
    !pathPattern.test(path) ||
    !method ||
    !["POST", "PUT", "DELETE"].includes(method)
  )
    return calendarRecoveryFetch(input, init);
  try {
    const headers = new Headers(init.headers);
    const p = parseFoodWrite({
      owner,
      path,
      method,
      key: headers.get("Idempotency-Key"),
      version: headers.get("If-Match"),
      body: typeof init.body === "string" ? init.body : null,
    });
    const previous = pendingFoodWrite();
    if (
      previous &&
      (previous.key !== p.key ||
        previous.path !== p.path ||
        previous.method !== p.method)
    )
      throw new Error(
        "Confirm the previous Food change before saving another.",
      );
    sessionStorage.setItem(prefix + owner, JSON.stringify(previous ?? p));
    storageError = null;
    return execute(previous ?? p, init);
  } catch (error) {
    storageError =
      error instanceof Error
        ? error.message
        : "Food recovery storage is unavailable.";
    notify();
    throw error;
  }
};
export const foodApi = createClient({ fetch: foodRecoveryFetch });
export async function retryFoodWrite() {
  const p = pendingFoodWrite();
  if (!p) return;
  const me = await globalThis.fetch("/api/v1/me", {
    credentials: "include",
    cache: "no-store",
  });
  if (!me.ok)
    throw new Error(
      "Sign in to the original account to confirm this Food change.",
    );
  const account = z
    .object({ user: z.object({ id: z.uuid() }) })
    .parse(await me.json());
  if (account.user.id !== p.owner || owner !== p.owner)
    throw new Error(
      "Sign in to the original account to confirm this Food change.",
    );
  const response = await execute(p);
  if (!response.ok)
    throw new Error(
      response.status >= 500
        ? "Could not confirm this change. Retry when the connection returns."
        : "The server rejected this change. Reload the latest Food data before trying again.",
    );
  if (p.method === "DELETE") return null;
  if (p.path.endsWith("/nutrition-goals")) return { view: "day" as const };
  const data: unknown = await response.json();
  if (/\/(foods|food-preparations)(\/|$)/.test(p.path))
    return { view: foodSchema.parse(data).kind };
  const at = p.path.includes("/weight-entries")
    ? weightSchema.parse(data).measuredAt
    : p.path.includes("/water-entries")
      ? waterSchema.parse(data).consumedAt
      : foodEntrySchema.parse(data).consumedAt;
  return { view: "day" as const, at };
}
