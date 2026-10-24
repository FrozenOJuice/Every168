export type PopupFrame = {
  x: number;
  y: number;
  width: number;
  height: number;
};
export type ResizeEdge = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";
type Viewport = { width: number; height: number };
const margin = 8;
const limit = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, max));
export function clampPopupFrame(
  frame: PopupFrame,
  viewport: Viewport,
): PopupFrame {
  const maxWidth = Math.max(1, viewport.width - margin * 2);
  const maxHeight = Math.max(1, viewport.height - margin * 2);
  const width = limit(frame.width, Math.min(360, maxWidth), maxWidth);
  const height = limit(frame.height, Math.min(360, maxHeight), maxHeight);
  return {
    width,
    height,
    x: limit(frame.x, margin, viewport.width - width - margin),
    y: limit(frame.y, margin, viewport.height - height - margin),
  };
}
export function resizePopupFrame(
  frame: PopupFrame,
  edge: ResizeEdge,
  dx: number,
  dy: number,
  viewport: Viewport,
): PopupFrame {
  const start = clampPopupFrame(frame, viewport);
  const minWidth = Math.min(360, viewport.width - margin * 2);
  const minHeight = Math.min(360, viewport.height - margin * 2);
  let left = start.x,
    top = start.y,
    right = left + start.width,
    bottom = top + start.height;
  if (edge.includes("w")) left = limit(left + dx, margin, right - minWidth);
  if (edge.includes("e"))
    right = limit(right + dx, left + minWidth, viewport.width - margin);
  if (edge.includes("n")) top = limit(top + dy, margin, bottom - minHeight);
  if (edge.includes("s"))
    bottom = limit(bottom + dy, top + minHeight, viewport.height - margin);
  return { x: left, y: top, width: right - left, height: bottom - top };
}
