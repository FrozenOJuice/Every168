import { afterEach, expect, it, vi } from "vitest";
import { emptyHistory, type CalendarAction } from "./calendar-history";
import { parseHistory, serializeHistory } from "./calendar-history-store";

const plan: CalendarAction = {
  key: "plan",
  kind: "create",
  blockId: "id",
  title: "Plan",
  version: 1,
};
afterEach(() => vi.unstubAllGlobals());
it("round-trips both stacks and the exact pending request, excluding transient actions and activity", () => {
  const state = {
    ...emptyHistory(),
    actions: [
      plan,
      { ...plan, key: "transient", transient: true },
      {
        key: "water",
        kind: "activity-create" as const,
        resource: "water" as const,
        id: "water",
        version: 1,
      },
    ],
    redo: [{ ...plan, key: "redo" }],
    pending: {
      direction: "redo" as const,
      action: { ...plan, key: "redo" },
      key: "original-request-key",
    },
  };
  const parsed = parseHistory(serializeHistory(state));
  expect(parsed.actions).toEqual([plan]);
  expect(parsed.redo).toEqual(state.redo);
  expect(parsed.pending).toEqual(state.pending);
});
it("discards malformed or oversized history and a pending request unrelated to the stack top", () => {
  expect(parseHistory("not json")).toEqual(emptyHistory());
  expect(
    parseHistory(
      JSON.stringify({
        ...emptyHistory(),
        actions: [{ ...plan, version: -1 }],
      }),
    ),
  ).toEqual(emptyHistory());
  expect(
    parseHistory(
      JSON.stringify({ ...emptyHistory(), actions: Array(101).fill(plan) }),
    ),
  ).toEqual(emptyHistory());
  expect(
    parseHistory(
      JSON.stringify({
        ...emptyHistory(),
        pending: { direction: "undo", action: plan, key: "request" },
      }),
    ),
  ).toEqual(emptyHistory());
});
it("hydrates refreshes, isolates accounts, clears sign-out, and rejects restored storage on a fresh visit", async () => {
  const makeStorage = () => {
    const values: Record<string, string> = {};
    return {
      getItem: (key: string) => values[key] ?? null,
      setItem: (key: string, value: string) => {
        values[key] = value;
      },
      removeItem: (key: string) => {
        delete values[key];
      },
      values,
    };
  };
  const storage = makeStorage();
  vi.stubGlobal("window", {});
  vi.stubGlobal("sessionStorage", storage);
  vi.stubGlobal("performance", {
    getEntriesByType: () => [{ type: "reload" }],
  });
  storage.setItem(
    "168hours:calendar-history:v2:one",
    serializeHistory({ ...emptyHistory(), actions: [plan] }),
  );
  vi.resetModules();
  let store = await import("./calendar-history-store");
  store.initializeCalendarHistory("one");
  expect(store.getCalendarHistory("one").actions).toEqual([plan]);
  store.initializeCalendarHistory("two");
  expect(store.getCalendarHistory("two").actions).toEqual([]);
  expect(store.getCalendarHistory("one").actions).toEqual([]);
  store.clearCalendarHistory();
  expect(store.calendarHistoryReady("two")).toBe(false);
  store.updateCalendarHistory("two", (state) => ({
    ...state,
    actions: [plan],
  }));
  expect(store.calendarHistoryReady("two")).toBe(false);
  storage.setItem(
    "168hours:calendar-history:v2:one",
    serializeHistory({ ...emptyHistory(), actions: [plan] }),
  );
  // Real Storage exposes its keys as enumerable properties.
  Object.defineProperty(storage, "168hours:calendar-history:v2:one", {
    value: "stored",
    configurable: true,
    enumerable: true,
  });
  vi.stubGlobal("performance", {
    getEntriesByType: () => [{ type: "navigate" }],
  });
  vi.resetModules();
  store = await import("./calendar-history-store");
  store.initializeCalendarHistory("one");
  expect(store.getCalendarHistory("one").actions).toEqual([]);
});
