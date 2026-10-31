import { afterEach, beforeEach, expect, it, vi } from "vitest";
const owner = "00000000-0000-4000-8000-000000000001",
  key = "00000000-0000-4000-8000-000000000002",
  id = "00000000-0000-4000-8000-000000000003";
let storage: Record<string, string>;
beforeEach(() => {
  vi.resetModules();
  storage = {};
  vi.stubGlobal("window", {});
  vi.stubGlobal("sessionStorage", {
    getItem: (k: string) => storage[k] ?? null,
    setItem: (k: string, v: string) => {
      storage[k] = v;
    },
    removeItem: (k: string) => {
      delete storage[k];
    },
  });
  vi.stubGlobal("performance", {
    now: () => Date.now(),
    getEntriesByType: () => [{ type: "reload" }],
  });
});
afterEach(() => vi.unstubAllGlobals());
const block = {
  id,
  version: 1,
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: "2026-09-01T00:00:00Z",
  title: "Plan",
  startsAt: "2026-09-01T09:00:00Z",
  endsAt: "2026-09-01T10:00:00Z",
  categoryId: null,
  goalId: null,
  notes: null,
  seriesId: null,
  occurrenceDate: null,
  isException: false,
};
it("replays the original body and key after a new document and records Undo once", async () => {
  let recovery = await import("./calendar-write-recovery");
  recovery.setCalendarWriteOwner(owner);
  const fetch = vi
    .fn()
    .mockRejectedValueOnce(new Error("lost response"))
    .mockResolvedValueOnce(Response.json(block));
  vi.stubGlobal("fetch", fetch);
  const init = {
    method: "POST",
    body: JSON.stringify({ title: "Plan" }),
    headers: { "Idempotency-Key": key },
  };
  await expect(
    recovery.calendarRecoveryFetch("/api/v1/time-blocks", init),
  ).rejects.toThrow();
  vi.resetModules();
  recovery = await import("./calendar-write-recovery");
  recovery.setCalendarWriteOwner(owner);
  expect(recovery.pendingCalendarWrite()?.key).toBe(key);
  await recovery.retryCalendarWrite();
  expect(fetch.mock.calls[1]![1].body).toBe(init.body);
  expect(fetch.mock.calls[1]![1].headers["Idempotency-Key"]).toBe(key);
  expect(recovery.pendingCalendarWrite()).toBeNull();
  const history = await import("./calendar-history-store");
  expect(history.getCalendarHistory(owner).actions).toMatchObject([
    { kind: "create", blockId: id, key },
  ]);
});
it("does not send a command when recovery storage cannot be written", async () => {
  const recovery = await import("./calendar-write-recovery");
  recovery.setCalendarWriteOwner(owner);
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  vi.stubGlobal("sessionStorage", {
    getItem: () => null,
    setItem: () => {
      throw new Error("storage unavailable");
    },
  });
  await expect(
    recovery.calendarRecoveryFetch("/api/v1/time-blocks", {
      method: "POST",
      headers: { "Idempotency-Key": key },
      body: "{}",
    }),
  ).rejects.toThrow("storage unavailable");
  expect(fetch).not.toHaveBeenCalled();
});
it("isolates pending writes by owner and clears credentials-free recovery on sign-out", async () => {
  const recovery = await import("./calendar-write-recovery");
  recovery.setCalendarWriteOwner(owner);
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
  await expect(
    recovery.calendarRecoveryFetch("/api/v1/time-blocks", {
      method: "POST",
      headers: { "Idempotency-Key": key },
      body: "{}",
    }),
  ).rejects.toThrow();
  recovery.setCalendarWriteOwner(id);
  expect(recovery.pendingCalendarWrite()).toBeNull();
  recovery.setCalendarWriteOwner(owner);
  expect(recovery.pendingCalendarWrite()?.key).toBe(key);
  recovery.clearCalendarWrites();
  expect(recovery.pendingCalendarWrite()).toBeNull();
});
it("retains server failures but clears definitive rejection without recording history", async () => {
  const recovery = await import("./calendar-write-recovery");
  recovery.setCalendarWriteOwner(owner);
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ error: "offline" }, { status: 503 }),
      )
      .mockResolvedValueOnce(
        Response.json({ error: "stale" }, { status: 409 }),
      ),
  );
  await recovery.calendarRecoveryFetch("/api/v1/time-blocks", {
    method: "POST",
    headers: { "Idempotency-Key": key },
    body: "{}",
  });
  expect(recovery.pendingCalendarWrite()?.key).toBe(key);
  await expect(recovery.retryCalendarWrite()).rejects.toThrow("rejected");
  expect(recovery.pendingCalendarWrite()).toBeNull();
  const history = await import("./calendar-history-store");
  expect(history.getCalendarHistory(owner).actions).toEqual([]);
});

it("leaves already-persisted Undo commands to the history executor", async () => {
  const recovery = await import("./calendar-write-recovery");
  recovery.setCalendarWriteOwner(owner);
  const history = await import("./calendar-history-store");
  const action = {
    kind: "copy" as const,
    key: id,
    blocks: [{ id, version: 1 }],
    items: [],
  };
  history.updateCalendarHistory(owner, (state) => ({
    ...state,
    actions: [action],
    pending: { direction: "undo", action, key },
  }));
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(Response.json({ ok: true, undoId: owner })),
  );
  await recovery.calendarRecoveryFetch("/api/v1/calendar/selection/delete", {
    method: "POST",
    headers: { "Idempotency-Key": key },
    body: JSON.stringify({ plans: [{ kind: "block", id, version: 1 }] }),
  });
  expect(history.getCalendarHistory(owner).actions).toEqual([action]);
  expect(recovery.pendingCalendarWrite()).toBeNull();
});

for (const command of [
  {
    path: "/api/v1/calendar/snapshot-copy",
    method: "POST",
    data: { token: "captured-preview" },
    result: { createdBlocks: [{ id, version: 2 }], createdItems: [] },
    kind: "copy",
  },
  {
    path: "/api/v1/calendar/selection/move",
    method: "POST",
    data: { plans: [{ kind: "block", id, version: 1 }], minutes: 30 },
    result: { undoId: owner, blocks: [{ id, version: 2 }], items: [] },
    kind: "group-edit",
  },
  {
    path: `/api/v1/time-blocks/${id}`,
    method: "DELETE",
    data: null,
    result: { ok: true, undoId: owner },
    kind: "delete",
  },
])
  it(`refresh recovery preserves the payload and revision for ${command.kind}`, async () => {
    let recovery = await import("./calendar-write-recovery");
    recovery.setCalendarWriteOwner(owner);
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("lost response"))
      .mockResolvedValueOnce(Response.json(command.result));
    vi.stubGlobal("fetch", fetch);
    const init = {
      method: command.method,
      body: command.data ? JSON.stringify(command.data) : null,
      headers: { "Idempotency-Key": key, "If-Match": '"1"' },
    };
    await expect(
      recovery.calendarRecoveryFetch(command.path, init),
    ).rejects.toThrow();
    vi.resetModules();
    recovery = await import("./calendar-write-recovery");
    recovery.setCalendarWriteOwner(owner);
    await recovery.retryCalendarWrite();
    expect(fetch.mock.calls[1]![1]).toMatchObject({
      method: command.method,
      body: init.body,
      headers: { "Idempotency-Key": key, "If-Match": '"1"' },
    });
    const history = await import("./calendar-history-store");
    expect(history.getCalendarHistory(owner).actions).toMatchObject([
      { kind: command.kind, key },
    ]);
  });

it("also retains uncertain manual actual-time edits for exact refresh retry", async () => {
  let recovery = await import("./calendar-write-recovery");
  recovery.setCalendarWriteOwner(owner);
  const result = {
    ...block,
    timeBlockId: null,
    sourceType: "manual",
    sourceId: null,
  };
  const fetch = vi
    .fn()
    .mockRejectedValueOnce(new Error("lost response"))
    .mockResolvedValueOnce(Response.json(result));
  vi.stubGlobal("fetch", fetch);
  const body = JSON.stringify({
    title: "Corrected actual time",
    startsAt: block.startsAt,
    endsAt: block.endsAt,
  });
  await expect(
    recovery.calendarRecoveryFetch(`/api/v1/time-entries/${id}`, {
      method: "PUT",
      body,
      headers: { "Idempotency-Key": key, "If-Match": '"1"' },
    }),
  ).rejects.toThrow();
  vi.resetModules();
  recovery = await import("./calendar-write-recovery");
  recovery.setCalendarWriteOwner(owner);
  expect(recovery.pendingCalendarWrite()?.body).toBe(body);
  await recovery.retryCalendarWrite();
  expect(fetch.mock.calls[1]![1]).toMatchObject({
    method: "PUT",
    body,
    headers: { "Idempotency-Key": key, "If-Match": '"1"' },
  });
  expect(recovery.pendingCalendarWrite()).toBeNull();
});
