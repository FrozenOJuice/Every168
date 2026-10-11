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
