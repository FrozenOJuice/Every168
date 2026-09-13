import { describe, expect, it } from "vitest";
import { dayRange } from "@168hours/domain-utils";
import { blockSchema } from "@168hours/contracts";
import {
  layoutDay,
  HOUR_HEIGHT,
  slotMinute,
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
  it("snaps clicks to quarter hours and clamps the last minute of an hour", () => {
    expect(
      [0, 17, 18, 35, 36, 53, 54, 72].map((offset) =>
        slotMinute(23, offset, 72),
      ),
    ).toEqual([1380, 1380, 1395, 1395, 1410, 1410, 1425, 1425]);
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
  it("keeps very short records reachable, including near midnight, without overlaying their touch targets", () => {
    const positions = layoutDay(
      [
        record(1, "2026-09-08T05:50:00Z", "2026-09-08T05:51:00Z"),
        record(2, "2026-09-08T05:55:00Z", "2026-09-08T06:00:00Z"),
      ],
      day,
    );
    expect(positions).toHaveLength(2);
    for (const p of positions) {
      expect(((p.bottom - p.top) / 60) * HOUR_HEIGHT).toBeGreaterThanOrEqual(
        45.99,
      );
      expect(p.bottom).toBeLessThanOrEqual(1440);
      expect(p.lanes).toBe(2);
    }
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
