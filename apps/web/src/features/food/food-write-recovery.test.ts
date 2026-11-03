import { afterEach, beforeEach, expect, it, vi } from "vitest";
const owner = "00000000-0000-4000-8000-000000000001",
  key = "00000000-0000-4000-8000-000000000002",
  other = "00000000-0000-4000-8000-000000000003";
let storage: Record<string, string>;
const input = {
  name: "Test food",
  servingAmount: 100,
  servingUnit: "g" as const,
  calories: 0,
  proteinG: null,
  carbsG: null,
  fatG: null,
  fiberG: null,
};
const food = {
  ...input,
  id: other,
  version: 1,
  createdAt: "2026-10-23T12:00:00Z",
  updatedAt: "2026-10-23T12:00:00Z",
  kind: "food",
  favourite: false,
  archivedAt: null,
  ingredients: [],
  yieldServings: 1,
  instructions: null,
};
beforeEach(() => {
  vi.resetModules();
  storage = {};
  vi.stubGlobal("window", { dispatchEvent: () => true });
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => {
      storage[k] = v;
    },
    removeItem: (k: string) => {
      delete storage[k];
    },
  });
});
afterEach(() => vi.unstubAllGlobals());
it("replays the exact canonical body, key and revision after refresh", async () => {
  let recovery = await import("./food-write-recovery");
  recovery.setFoodWriteOwner(owner);
  const fetch = vi.fn().mockRejectedValueOnce(new Error("lost response"));
  vi.stubGlobal("fetch", fetch);
  await expect(
    recovery.foodApi.updateFood(other, input, 7, key),
  ).rejects.toThrow();
  expect(recovery.pendingFoodWrite()).toMatchObject({
    key,
    version: '"7"',
    method: "PUT",
  });
  vi.resetModules();
  recovery = await import("./food-write-recovery");
  recovery.setFoodWriteOwner(owner);
  fetch
    .mockResolvedValueOnce(Response.json({ user: { id: owner } }))
    .mockResolvedValueOnce(Response.json(food));
  await recovery.retryFoodWrite();
  expect(fetch.mock.calls[2]![1].body).toBe(fetch.mock.calls[0]![1].body);
  expect(fetch.mock.calls[2]![1].headers).toMatchObject({
    "Idempotency-Key": key,
    "If-Match": '"7"',
  });
  expect(recovery.pendingFoodWrite()).toBeNull();
});
it("blocks sending when the recovery receipt cannot be retained", async () => {
  const recovery = await import("./food-write-recovery");
  recovery.setFoodWriteOwner(owner);
  vi.stubGlobal("sessionStorage", {
    getItem: () => null,
    setItem: () => {
      throw new Error("storage unavailable");
    },
  });
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  await expect(recovery.foodApi.createFood(input, key)).rejects.toThrow();
  expect(fetch).not.toHaveBeenCalled();
});
it("isolates accounts and checks the active server account before replaying", async () => {
  const recovery = await import("./food-write-recovery");
  recovery.setFoodWriteOwner(owner);
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(Response.json({}, { status: 503 }));
  vi.stubGlobal("fetch", fetch);
  await expect(recovery.foodApi.createFood(input, key)).rejects.toThrow();
  recovery.setFoodWriteOwner(other);
  expect(recovery.pendingFoodWrite()).toBeNull();
  recovery.setFoodWriteOwner(owner);
  fetch.mockResolvedValueOnce(Response.json({ user: { id: other } }));
  await expect(recovery.retryFoodWrite()).rejects.toThrow("original account");
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(recovery.pendingFoodWrite()?.key).toBe(key);
  expect(Object.values(storage).join(" ")).not.toMatch(
    /cookie|authorization|password/i,
  );
});
it("retains unknown successful responses and clears definitive conflicts", async () => {
  const recovery = await import("./food-write-recovery");
  recovery.setFoodWriteOwner(owner);
  const fetch = vi.fn().mockResolvedValueOnce(new Response(""));
  vi.stubGlobal("fetch", fetch);
  await expect(recovery.foodApi.createFood(input, key)).rejects.toThrow();
  expect(recovery.pendingFoodWrite()?.key).toBe(key);
  fetch.mockResolvedValueOnce(
    Response.json(
      { error: { code: "STALE_REVISION", message: "stale" } },
      { status: 409 },
    ),
  );
  await expect(recovery.foodApi.createFood(input, key)).rejects.toThrow(
    "stale",
  );
  expect(recovery.pendingFoodWrite()).toBeNull();
});
it("rejects unsafe recovered routes, invalid payloads and missing update revisions", async () => {
  const { parseFoodWrite } = await import("./food-write-recovery");
  const pending = {
    owner,
    key,
    path: "/api/v1/foods",
    method: "POST",
    version: null,
    body: JSON.stringify(input),
  };
  expect(parseFoodWrite(pending)).toEqual(pending);
  for (const bad of [
    { ...pending, path: "https://evil.invalid/api/v1/foods" },
    { ...pending, path: "/api/v1/tasks" },
    { ...pending, body: '{"name":"invalid"}' },
    { ...pending, path: `/api/v1/foods/${other}`, method: "PUT" },
  ])
    expect(() => parseFoodWrite(bad)).toThrow();
});
it("retains direct catalogue references and goal revisions in recovery", async () => {
  const recovery = await import("./food-write-recovery");
  recovery.setFoodWriteOwner(owner);
  const fetch = vi.fn().mockRejectedValueOnce(new Error("lost response"));
  vi.stubGlobal("fetch", fetch);
  await expect(
    recovery.foodApi.saveNutritionGoals(
      { calories: 2000, proteinG: null, carbsG: null, fatG: null },
      1,
      key,
    ),
  ).rejects.toThrow();
  expect(recovery.pendingFoodWrite()).toMatchObject({
    path: "/api/v1/nutrition-goals",
    version: '"1"',
    key,
  });
  fetch
    .mockResolvedValueOnce(Response.json({ user: { id: owner } }))
    .mockResolvedValueOnce(
      Response.json({
        version: 2,
        calories: 2000,
        proteinG: null,
        carbsG: null,
        fatG: null,
      }),
    );
  expect(await recovery.retryFoodWrite()).toEqual({ view: "day" });
  expect(recovery.pendingFoodWrite()).toBeNull();
  expect(
    recovery.parseFoodWrite({
      owner,
      path: "/api/v1/food-entries",
      method: "POST",
      key,
      version: null,
      body: JSON.stringify({
        catalogueId: other,
        quantity: 50,
        portionId: "g",
        consumedAt: "2026-11-03T12:00:00Z",
      }),
    }).path,
  ).toBe("/api/v1/food-entries");
});
