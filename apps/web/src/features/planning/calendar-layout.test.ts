import { describe, expect, it } from "vitest";
import { dayRange } from "@168hours/domain-utils";
import { blockSchema } from "@168hours/contracts";
import {
  layoutDay,
  HOUR_HEIGHT,
  slotMinute,
  timeScaleScrollTop,
  timeTickMinutes,
  visibleWeekSegments,
  type CalendarRecord,
} from "./calendar-layout";

const day = {
  date: "2026-09-07",
  ...dayRange("2026-09-07", "America/Edmonton"),
  blockIds: [],
  entryIds: [],
};
function record(id: number, start: string, end: string): CalendarRecord {
  return {
    kind: "block",
    item: blockSchema.parse({
      seriesId: null,
      occurrenceDate: null,
      isException: false,
      id: `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`,
      createdAt: "2026-09-01T00:00:00Z",
      updatedAt: "2026-09-01T00:00:00Z",
      version: 1,
      title: "Synthetic block",
      categoryId: null,
      goalId: null,
      notes: null,
      startsAt: start,
      endsAt: end,
    }),
  };
}
describe("calendar presentation", () => {
  it("snaps clicks to five minutes and clamps the last interval of an hour", () => {
    expect(
      [0, 4, 5, 9, 10, 14, 15, 55, 60].map((offset) =>
        slotMinute(23, offset, HOUR_HEIGHT),
      ),
    ).toEqual([1380, 1380, 1385, 1385, 1390, 1390, 1395, 1435, 1435]);
    expect(slotMinute(14, 3, 44)).toBe(840);
    expect(slotMinute(14, 4, 44)).toBe(845);
    expect(slotMinute(14, 10, 120)).toBe(845);
    expect(slotMinute(14, 20, 240)).toBe(845);
    expect(slotMinute(14, 3, 32)).toBe(845);
    expect(slotMinute(14, 1, 12)).toBe(845);
  });
  it("changes label intervals with a buffer around each zoom threshold", () => {
    expect(timeTickMinutes(60, 20)).toBe(240);
    expect(timeTickMinutes(240, 25)).toBe(240);
    expect(timeTickMinutes(240, 26)).toBe(120);
    expect(timeTickMinutes(120, 20)).toBe(240);
    expect(timeTickMinutes(60, 36)).toBe(120);
    expect(timeTickMinutes(120, 41)).toBe(120);
    expect(timeTickMinutes(120, 42)).toBe(60);
    expect(timeTickMinutes(60, 89)).toBe(60);
    expect(timeTickMinutes(60, 90)).toBe(30);
    expect(timeTickMinutes(30, 85)).toBe(30);
    expect(timeTickMinutes(30, 84)).toBe(60);
    expect(timeTickMinutes(30, 32)).toBe(120);
    expect(timeTickMinutes(30, 149)).toBe(30);
    expect(timeTickMinutes(30, 150)).toBe(15);
    expect(timeTickMinutes(15, 141)).toBe(15);
    expect(timeTickMinutes(15, 140)).toBe(30);
  });
  it("keeps a steady scroll position through the full-day zoom boundary", () => {
    const anchor = { top: 216, y: 500, height: 60 };
    const minimum = 24;
    for (const height of [50, 40, 30]) {
      const remainingScroll = 24 * (height - minimum);
      expect(
        timeScaleScrollTop(anchor, height, minimum) / remainingScroll,
      ).toBeCloseTo(0.25);
    }
    expect(timeScaleScrollTop(anchor, minimum, minimum)).toBe(0);
    expect(timeScaleScrollTop(anchor, 100, minimum)).toBeCloseTo(
      ((anchor.top + anchor.y) * 100) / anchor.height - anchor.y,
    );
  });
  it("keeps short records proportional at every hour scale", () => {
    const short = record(1, "2026-09-07T18:00:00Z", "2026-09-07T18:05:00Z");
    for (const height of [12, 32, 44, 60, 120, 240]) {
      const [segment] = layoutDay([short], day);
      expect(segment).toBeDefined();
      expect(segment!.bottom - segment!.top).toBe(5);
      expect(((segment!.bottom - segment!.top) / 60) * height).toBeCloseTo(
        height / 12,
      );
    }
  });
  it("keeps the rest of a busy day visible and exposes only excess lanes as overflow", () => {
    const records = Array.from({ length: 5 }, (_, i) =>
      record(i + 1, "2026-09-07T15:00:00Z", "2026-09-07T16:00:00Z"),
    );
    const later = record(6, "2026-09-07T18:00:00Z", "2026-09-07T18:05:00Z");
    const layout = layoutDay([...records, later], day);
    const week = visibleWeekSegments(layout);
    expect(week.hidden).toBe(3);
    expect(week.visible.map((segment) => segment.record.item.id)).toEqual([
      records[0]!.item.id,
      records[1]!.item.id,
      later.item.id,
    ]);
    expect(week.visible.map((segment) => segment.lanes)).toEqual([2, 2, 1]);
    expect(layout).toHaveLength(6); // Day can still render every lane.
    expect(layout[0]!.lanes).toBe(5); // No mutation of the complete layout.
  });
  it("clips overnight records to the displayed day without changing source timestamps", () => {
    const overnight = record(1, "2026-09-07T05:00:00Z", "2026-09-07T07:00:00Z");
    const late = record(2, "2026-09-08T05:00:00Z", "2026-09-08T07:00:00Z");
    const positions = layoutDay([late, overnight], day);
    expect(positions.map(({ top, bottom }) => [top, bottom])).toEqual([
      [0, 60],
      [1380, 1440],
    ]);
    expect(overnight.item.startsAt).toBe("2026-09-07T05:00:00Z");
  });
  it("allocates separate lanes for a transitive overlap group and releases them afterward", () => {
    const records = [
      record(1, "2026-09-07T15:00:00Z", "2026-09-07T16:00:00Z"),
      record(2, "2026-09-07T15:30:00Z", "2026-09-07T16:30:00Z"),
      record(3, "2026-09-07T16:00:00Z", "2026-09-07T17:00:00Z"),
      record(4, "2026-09-07T17:00:00Z", "2026-09-07T18:00:00Z"),
    ];
    expect(
      layoutDay(records, day).map(({ lane, lanes }) => [lane, lanes]),
    ).toEqual([
      [0, 2],
      [1, 2],
      [0, 2],
      [0, 1],
    ]);
  });
  it("keeps short records at their real times without inventing overlap near midnight", () => {
    const positions = layoutDay(
      [
        record(1, "2026-09-08T05:50:00Z", "2026-09-08T05:51:00Z"),
        record(2, "2026-09-08T05:55:00Z", "2026-09-08T06:00:00Z"),
      ],
      day,
    );
    expect(positions).toHaveLength(2);
    expect(
      positions.map(({ top, bottom, lanes }) => [top, bottom, lanes]),
    ).toEqual([
      [1430, 1431, 1],
      [1435, 1440, 1],
    ]);
  });
  it("does not render an interval touching only the boundary of the day", () => {
    expect(
      layoutDay(
        [
          record(1, "2026-09-07T05:00:00Z", "2026-09-07T06:00:00Z"),
          record(2, "2026-09-08T06:00:00Z", "2026-09-08T07:00:00Z"),
        ],
        day,
      ),
    ).toEqual([]);
  });
});
