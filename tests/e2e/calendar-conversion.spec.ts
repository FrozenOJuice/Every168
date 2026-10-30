import {
  expectCalendarField,
  fillCalendarField,
} from "./helpers/calendar-form";
import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
const headers = () => ({
  Origin: "http://localhost:3100",
  "Idempotency-Key": randomUUID(),
});
async function start(page: Page) {
  expect(
    (
      await page.request.post("/api/auth/sign-up/email", {
        headers: headers(),
        data: {
          name: "Plan modes",
          email: `modes-${randomUUID()}@example.com`,
          password: "Synthetic-calendar-password-123",
        },
      })
    ).status(),
  ).toBe(200);
}
async function ready(page: Page) {
  await expect(page.locator(".calendar-interactions")).toHaveAttribute(
    "aria-busy",
    "false",
  );
}
const day = (page: Page) =>
  page.getByRole("region", { name: "Daily time grid" });
const editor = (page: Page) =>
  page.getByRole("dialog", { name: "Edit plan", exact: true });
async function items(page: Page) {
  return (
    await page.request.get(
      "/api/v1/calendar/items?from=2026-09-07&to=2026-09-13",
    )
  ).json();
}
async function blocks(page: Page) {
  return (await (await page.request.get("/api/v1/weeks/2026-09-07")).json())
    .blocks;
}

test("one editor switches saved plans between all-day and one continuous timed range with undo and redo", async ({
  page,
}) => {
  await start(page);
  const response = await page.request.post("/api/v1/time-blocks", {
    headers: headers(),
    data: {
      title: "Trip",
      notes: "Original notes",
      startsAt: "2026-09-07T09:00:00Z",
      endsAt: "2026-09-09T17:00:00Z",
    },
  });
  expect(response.status()).toBe(201);
  const original = await response.json();
  await page.goto("/?date=2026-09-07&view=day");
  await ready(page);
  const timed = () =>
    day(page)
      .locator(".grid-record")
      .getByRole("button", { name: /Trip.*planned/ });
  await timed().dblclick();
  await expect(
    editor(page).getByLabel("All day", { exact: true }),
  ).not.toBeChecked();
  await editor(page).getByLabel("All day", { exact: true }).check();
  await expect(editor(page)).toContainText(
    "Recorded results and time are kept. Undo restores the links",
  );
  await expectCalendarField(editor(page), "Date", "2026-09-07");
  await expectCalendarField(editor(page), "Last day", "2026-09-09");
  await editor(page).getByLabel("All day", { exact: true }).uncheck();
  await expectCalendarField(editor(page), "Start", "2026-09-07T09:00");
  await expectCalendarField(editor(page), "End", "2026-09-09T17:00");
  await editor(page).getByLabel("All day", { exact: true }).check();
  await page.keyboard.press("Escape");
  expect(await blocks(page)).toHaveLength(1);
  expect(await items(page)).toHaveLength(0);
  await timed().dblclick();
  await editor(page).getByLabel("All day", { exact: true }).check();
  const keys: string[] = [];
  await page.route("**/api/v1/calendar/plans/convert", async (route) => {
    keys.push(route.request().headers()["idempotency-key"]!);
    if (keys.length === 1) {
      expect((await route.fetch()).status()).toBe(200);
      await route.abort("failed");
    } else await route.continue();
  });
  await editor(page).getByRole("button", { name: "Save", exact: true }).click();
  await editor(page).getByRole("button", { name: "Retry save" }).click();
  await expect(editor(page)).toHaveCount(0);
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  await page.unroute("**/api/v1/calendar/plans/convert");
  expect(await blocks(page)).toHaveLength(0);
  expect(await items(page)).toHaveLength(1);
  expect((await items(page))[0]).toMatchObject({
    id: original.id,
    title: "Trip",
    notes: "Original notes",
    date: "2026-09-07",
    endDate: "2026-09-09",
  });
  await day(page)
    .getByRole("button", { name: /Trip, all day/ })
    .dblclick();
  await expect(
    editor(page).getByLabel("All day", { exact: true }),
  ).toBeChecked();
  await editor(page).getByLabel("All day", { exact: true }).uncheck();
  await expectCalendarField(editor(page), "Start", /^2026-09-07T/);
  await expectCalendarField(editor(page), "End", /^2026-09-09T/);
  await fillCalendarField(editor(page), "Start", "2026-09-07T10:00");
  await fillCalendarField(editor(page), "End", "2026-09-09T18:00");
  expect(
    (await new AxeBuilder({ page }).include('[role="dialog"]').analyze())
      .violations,
  ).toEqual([]);
  await editor(page).getByRole("button", { name: "Save", exact: true }).click();
  await expect(editor(page)).toHaveCount(0);
  expect(await items(page)).toHaveLength(0);
  expect(await blocks(page)).toHaveLength(1);
  expect((await blocks(page))[0]).toMatchObject({
    id: original.id,
    startsAt: "2026-09-07T10:00:00.000Z",
    endsAt: "2026-09-09T18:00:00.000Z",
  });
  await ready(page);
  await page.keyboard.press("Meta+z");
  await expect.poll(async () => (await items(page)).length).toBe(1);
  await ready(page);
  await page.keyboard.press("Meta+z");
  await expect
    .poll(async () => (await blocks(page))[0]?.startsAt)
    .toBe(original.startsAt);
  await ready(page);
  await page.keyboard.press("Meta+Shift+z");
  await expect.poll(async () => (await items(page)).length).toBe(1);
  await ready(page);
  await page.keyboard.press("Meta+Shift+z");
  await expect
    .poll(async () => (await blocks(page))[0]?.startsAt)
    .toBe("2026-09-07T10:00:00.000Z");
});

test("repeating plan mode changes support individual exceptions, following scopes and whole-series conversion", async ({
  page,
}) => {
  await start(page);
  const response = await page.request.post("/api/v1/calendar/series", {
    headers: headers(),
    data: {
      title: "Daily plan",
      kind: "all_day",
      timezone: "UTC",
      startDate: "2026-09-07",
      untilDate: "2026-09-09",
      startMinute: 0,
      durationMinutes: 60,
      frequency: "daily",
      interval: 1,
      weekdays: [1],
    },
  });
  expect(response.status()).toBe(201);
  const series = await response.json();
  await page.goto("/?date=2026-09-07&view=day");
  await ready(page);
  await day(page)
    .getByRole("button", { name: /Daily plan, all day/ })
    .dblclick();
  await editor(page).getByLabel("All day", { exact: true }).uncheck();
  await fillCalendarField(editor(page), "Start", "2026-09-07T09:00");
  await fillCalendarField(editor(page), "End", "2026-09-07T10:00");
  await editor(page).getByRole("button", { name: "Save", exact: true }).click();
  await expect(editor(page)).toHaveCount(0);
  expect(await blocks(page)).toHaveLength(1);
  expect(await items(page)).toHaveLength(2);
  expect((await blocks(page))[0]).toMatchObject({
    seriesId: series.series.id,
    isException: true,
  });
  await page.getByRole("link", { name: "Next day", exact: true }).click();
  await ready(page);
  await day(page)
    .getByRole("button", { name: /Daily plan, all day/ })
    .dblclick();
  await editor(page).getByLabel("All day", { exact: true }).uncheck();
  await editor(page)
    .getByLabel("Apply changes to", { exact: true })
    .selectOption("following");
  await editor(page).getByRole("button", { name: "Save", exact: true }).click();
  await expect(editor(page)).toHaveCount(0);
  expect(await blocks(page)).toHaveLength(3);
  expect(await items(page)).toHaveLength(0);
  expect(
    new Set((await blocks(page)).map((b: { seriesId: string }) => b.seriesId))
      .size,
  ).toBe(2);
  await ready(page);
  await page.keyboard.press("Meta+z");
  await expect.poll(async () => (await items(page)).length).toBe(2);
  await ready(page);
  await page.keyboard.press("Meta+z");
  await expect.poll(async () => (await items(page)).length).toBe(3);
  await page.getByRole("link", { name: "Previous day", exact: true }).click();
  await ready(page);
  await day(page)
    .getByRole("button", { name: /Daily plan, all day/ })
    .dblclick();
  await editor(page).getByLabel("All day", { exact: true }).uncheck();
  await editor(page)
    .getByLabel("Apply changes to", { exact: true })
    .selectOption("all");
  await editor(page).getByRole("button", { name: "Save", exact: true }).click();
  await expect(editor(page)).toHaveCount(0);
  expect(await blocks(page)).toHaveLength(3);
  expect(await items(page)).toHaveLength(0);
  await ready(page);
  await page.keyboard.press("Meta+z");
  await expect.poll(async () => (await items(page)).length).toBe(3);
});
