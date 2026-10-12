import { expect, it } from "vitest";
import type { Block } from "@168hours/contracts";
import {
  recordAction,
  undoAction,
  type CalendarAction,
} from "./calendar-history";

const created: CalendarAction = {
  key: "create",
  kind: "create",
  blockId: "a",
  title: "Plan",
  version: 1,
};
const renamed: CalendarAction = {
  key: "rename",
  kind: "edit",
  blockId: "a",
  title: "Renamed",
  version: 2,
  previousVersion: 1,
  undoId: "edit1",
};
const moved: CalendarAction = {
  key: "move",
  kind: "edit",
  blockId: "a",
  title: "Renamed",
  version: 3,
  previousVersion: 2,
  undoId: "edit2",
};
const deleted: CalendarAction = {
  key: "delete",
  kind: "delete",
  blockId: "a",
  title: "Renamed",
  previousVersion: 3,
  undoId: "delete1",
};
const restored = (version: number) => ({ id: "a", version }) as Block;

it("unwinds create, rename, move and delete while advancing only our own revisions", () => {
  let history: CalendarAction[] = [created, renamed, moved, deleted];
  history = undoAction(history, deleted, restored(4));
  expect(history.at(-1)).toMatchObject({ key: "move", version: 4 });
  history = undoAction(history, history.at(-1)!, restored(5));
  expect(history.at(-1)).toMatchObject({ key: "rename", version: 5 });
  history = undoAction(history, history.at(-1)!, restored(6));
  expect(history.at(-1)).toMatchObject({ key: "create", version: 6 });
  expect(undoAction(history, history.at(-1)!, null)).toEqual([]);
});

it("keeps unrelated actions in order and leaves external revision gaps guarded", () => {
  const other: CalendarAction = { ...created, key: "other", blockId: "b" };
  let history: CalendarAction[] = [created, other, moved];
  history = undoAction(history, moved, restored(4));
  expect(history).toEqual([created, other]);
  expect(undoAction(history, moved, restored(5))).toBe(history);
  expect(recordAction(history, created)).toBe(history);
});

it("restores a deleted group as one action and advances earlier copy revisions", () => {
  const copied: CalendarAction = {
    key: "copy",
    kind: "copy",
    blocks: [{ id: "a", version: 1 }],
    items: [{ id: "item", version: 1 }],
  };
  const group: CalendarAction = {
    key: "group",
    kind: "group-delete",
    undoId: "receipt",
  };
  const history = undoAction([copied, group], group, null, {
    blocks: [{ id: "a", version: 2 }],
    items: [{ id: "item", version: 2 }],
  });
  expect(history).toEqual([
    {
      ...copied,
      blocks: [{ id: "a", version: 2 }],
      items: [{ id: "item", version: 2 }],
    },
  ]);
});

it("unwinds all-day deletion, edits and creation using the revisions returned by each inverse", () => {
  const creation: CalendarAction = {
    kind: "copy",
    key: "all-day-create",
    blocks: [],
    items: [{ id: "day", version: 1 }],
  };
  const edit: CalendarAction = {
    kind: "item-edit",
    key: "all-day-edit",
    itemId: "day",
    version: 2,
    before: {
      title: "Before",
      notes: null,
      categoryId: null,
      goalId: null,
      kind: "all_day",
      date: "2026-09-07",
      endDate: "2026-09-07",
    },
  };
  const deletion: CalendarAction = {
    kind: "group-delete",
    key: "all-day-delete",
    undoId: "receipt",
  };
  let history = undoAction([creation, edit, deletion], deletion, null, {
    blocks: [],
    items: [{ id: "day", version: 3 }],
  });
  expect(history.at(-1)).toMatchObject({ kind: "item-edit", version: 3 });
  history = undoAction(history, history.at(-1)!, null, {
    blocks: [],
    items: [{ id: "day", version: 4 }],
  });
  expect(history).toEqual([
    { ...creation, items: [{ id: "day", version: 4 }] },
  ]);
});

it("advances a series occurrence after undoing its edit before undoing the series", () => {
  const series: CalendarAction = {
    kind: "series",
    key: "series-create",
    undoId: "receipt",
    blocks: [{ id: "a", version: 1 }],
  };
  const history = undoAction([series, renamed], renamed, restored(3));
  expect(history).toEqual([{ ...series, blocks: [{ id: "a", version: 3 }] }]);
});
