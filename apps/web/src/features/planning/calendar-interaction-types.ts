import type { Block, CalendarItem } from "@168hours/contracts";
import type { DragMode, CalendarPoint } from "./calendar-drag";
import type { MovingPlan } from "./calendar-plan-motion";
export type Gesture = {
  pointer: number;
  x: number;
  y: number;
  origin: CalendarPoint;
  mode: DragMode;
  block?: Block;
  item?: CalendarItem;
  plans?: { blocks: Block[]; items: CalendarItem[] };
  bounds: { left: number; top: number; width: number; height: number };
};
export type Preview = {
  point: CalendarPoint;
  x: number;
  y: number;
  label: string;
  selection: { startsAt: string; endsAt: string } | null;
  bounds: Gesture["bounds"] | null;
  resize: { id: string; startsAt: string; endsAt: string } | null;
  dateResize?: CalendarItem;
  moving?: MovingPlan[];
};
export type CalendarNotice = {
  id: number;
  message: string;
  undoKey?: string;
  action?: { label: string; onClick: () => void };
  kind: "copy" | "change" | "hint" | "error";
};
