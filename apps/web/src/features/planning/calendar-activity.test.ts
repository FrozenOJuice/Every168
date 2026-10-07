import { describe, expect, it } from "vitest";
import type { CalendarActivity } from "@168hours/contracts";
import { activityOnDate } from "./calendar-activity";
const moment: CalendarActivity = {
  source: { type: "drawing", id: "00000000-0000-4000-8000-000000000001" },
  domain: "Drawing",
  icon: "pencil",
  kind: "moment",
  status: "recorded",
  title: "Sketch",
  summary: "Study finished",
  occurredAt: "2026-03-09T05:59:59Z",
  endsAt: null,
  href: "/drawing",
};
describe("Calendar activity presentation", () => {
  it("includes moments on their local day and sessions overlapping midnight, without giving moments duration", () => {
    const session = {
      ...moment,
      kind: "session" as const,
      occurredAt: "2026-03-08T06:30:00Z",
      endsAt: "2026-03-08T07:30:00Z",
    };
    expect(
      activityOnDate([moment, session], "2026-03-08", "America/Edmonton"),
    ).toEqual([moment, session]);
    expect(
      activityOnDate([moment, session], "2026-03-09", "America/Edmonton"),
    ).toEqual([]);
    expect(
      activityOnDate(
        [{ ...moment, occurredAt: "2026-03-09T06:00:00Z" }],
        "2026-03-08",
        "America/Edmonton",
      ),
    ).toEqual([]);
  });
  it("supports unknown domains and matches title, summary and domain while respecting type/category filters", () => {
    expect(
      activityOnDate([moment], "2026-03-08", "America/Edmonton", {
        kind: "all",
        q: "drawing",
      }),
    ).toEqual([moment]);
    expect(
      activityOnDate([moment], "2026-03-08", "America/Edmonton", {
        kind: "entry",
        q: "finished",
        categoryId: "none",
      }),
    ).toEqual([moment]);
    expect(
      activityOnDate([moment], "2026-03-08", "America/Edmonton", {
        kind: "block",
        q: "",
      }),
    ).toEqual([]);
    expect(
      activityOnDate([moment], "2026-03-08", "America/Edmonton", {
        kind: "all",
        q: "",
        categoryId: "00000000-0000-4000-8000-000000000001",
      }),
    ).toEqual([]);
  });
});
