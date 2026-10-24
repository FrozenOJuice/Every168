import { expect, it } from "vitest";
import { clampPopupFrame, resizePopupFrame } from "./assistant-popup-frame";

it("keeps oversized or off-screen windows reachable after a viewport change", () => {
  expect(
    clampPopupFrame(
      { x: 1200, y: -100, width: 900, height: 800 },
      { width: 800, height: 600 },
    ),
  ).toEqual({ x: 8, y: 8, width: 784, height: 584 });
  expect(
    clampPopupFrame(
      { x: -40, y: 700, width: 100, height: 50 },
      { width: 1280, height: 720 },
    ),
  ).toEqual({ x: 8, y: 352, width: 360, height: 360 });
});

it("resizes from the requested edge while preserving the opposite edge and minimum size", () => {
  const frame = { x: 200, y: 120, width: 500, height: 500 };
  expect(
    resizePopupFrame(frame, "nw", 300, 300, { width: 1280, height: 800 }),
  ).toEqual({ x: 340, y: 260, width: 360, height: 360 });
  expect(
    resizePopupFrame(frame, "w", -500, 0, { width: 1280, height: 800 }),
  ).toEqual({ x: 8, y: 120, width: 692, height: 500 });
  expect(
    resizePopupFrame(frame, "se", 1000, 1000, { width: 1280, height: 800 }),
  ).toEqual({ x: 200, y: 120, width: 1072, height: 672 });
});

it("allows a smaller size when the viewport cannot fit the usual minimum", () => {
  expect(
    resizePopupFrame(
      { x: 8, y: 8, width: 400, height: 520 },
      "se",
      -100,
      -100,
      { width: 320, height: 240 },
    ),
  ).toEqual({ x: 8, y: 8, width: 304, height: 224 });
});
