import {
  expectCalendarField,
  fillCalendarField,
  openCalendarPlan,
  selectCalendarRepeat,
} from "./helpers/calendar-form";
import { test, expect, type Page, type Locator } from "@playwright/test";
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
const headers = () => ({
  Origin: "http://localhost:3100",
  "Idempotency-Key": randomUUID(),
});
async function start(page: Page) {
  expect(
    (
      await page.request.post("/api/__test/register", {
        headers: headers(),
        data: {
          name: "Event creator",
          email: `event-${randomUUID()}@example.com`,
          password: "Synthetic-calendar-password-123",
        },
      })
    ).status(),
  ).toBe(200);
  await page.goto("/?date=2026-09-07&view=day");
  await expect(page.locator(".calendar-interactions")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await openCalendarPlan(page);
  return page.getByRole("dialog", { name: "Add plan", exact: true });
}
async function footerVisible(page: Page, dialog: Locator) {
  const footer = await dialog.locator(".form-footer").boundingBox();
  const box = await dialog.boundingBox();
  expect(footer!.y).toBeGreaterThanOrEqual(box!.y);
  expect(footer!.y + footer!.height).toBeLessThanOrEqual(box!.y + box!.height);
  expect(footer!.y + footer!.height).toBeGreaterThanOrEqual(
    box!.y + box!.height - 24,
  );
  const body = await dialog.locator(".form-scroll-body").boundingBox();
  expect(body!.y + body!.height).toBeLessThanOrEqual(footer!.y + 1);
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
}

test("timed creation has visible notes, custom timing, pinned actions and same-key retry", async ({
  page,
}, info) => {
  if (info.project.name === "phone")
    await page.setViewportSize({ width: 320, height: 700 });
  const dialog = await start(page);
  await expect(dialog.getByLabel("Title", { exact: true })).toBeFocused();
  await expect(dialog.getByText("Other plans", { exact: true })).toHaveCount(0);
  await expect(dialog.getByText("More details", { exact: true })).toHaveCount(
    0,
  );
  await dialog.getByLabel("Title", { exact: true }).fill("Planning session");
  await dialog.getByLabel("Notes (optional)").fill("Bring the outline");
  await fillCalendarField(dialog, "Start", "2026-09-08T23:30");
  await expectCalendarField(dialog, "End", "2026-09-09T00:30");
  await fillCalendarField(dialog, "End", "2026-09-09T01:00");
  await footerVisible(page, dialog);
  expect(
    (await new AxeBuilder({ page }).include(".calendar-event-editor").analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({ path: info.outputPath("timed-creator.png") });
  const keys: string[] = [];
  await page.route("**/api/v1/time-blocks", async (route) => {
    keys.push(route.request().headers()["idempotency-key"]!);
    if (keys.length === 1) {
      expect((await route.fetch()).status()).toBe(201);
      await route.abort("failed");
    } else await route.continue();
  });
  await dialog.getByRole("button", { name: "Start date", exact: true }).click();
  // Keyboard submission can leave a picker open; an uncertain write must lock it too.
  await dialog.getByRole("button", { name: "Save", exact: true }).focus();
  await dialog
    .getByRole("button", { name: "Save", exact: true })
    .press("Enter");
  await expect(dialog.getByRole("dialog")).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "Start date", exact: true }),
  ).toBeDisabled();
  await expect(
    dialog.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeDisabled();
  await expect(dialog.getByLabel("Title", { exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "Retry save", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  const week = await (
    await page.request.get("/api/v1/weeks/2026-09-07")
  ).json();
  expect(week.blocks).toHaveLength(1);
  expect(week.blocks[0]).toMatchObject({
    title: "Planning session",
    notes: "Bring the outline",
    startsAt: "2026-09-08T23:30:00.000Z",
    endsAt: "2026-09-09T01:00:00.000Z",
  });
});

test("all-day repeating creation scrolls fields with actions fixed and validates the end date", async ({
  page,
}, info) => {
  if (info.project.name === "phone")
    await page.setViewportSize({ width: 320, height: 700 });
  const dialog = await start(page);
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog.getByLabel("Title", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await dialog.getByLabel("Title", { exact: true }).fill("Conference");
  await dialog.getByLabel("All day", { exact: true }).check();
  await fillCalendarField(dialog, "Date", "2026-09-07");
  await dialog.getByLabel("Spans multiple days").check();
  await fillCalendarField(dialog, "Last day", "2026-09-08");
  await selectCalendarRepeat(dialog, "weekly");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Repeat through", exact: true }),
  ).toHaveAttribute("data-invalid", "true");
  await fillCalendarField(dialog, "Repeat through", "2026-09-14");
  await expect(dialog.locator(".calendar-repeat-preview")).toContainText(
    "2 plans will be added",
  );
  await dialog.getByLabel("Notes (optional)").fill("Two-day event");
  await dialog
    .locator("form > fieldset")
    .first()
    .evaluate((element) => {
      element.scrollTop = 0;
    });
  await footerVisible(page, dialog);
  await page.screenshot({ path: info.outputPath("repeating-creator.png") });
  expect(
    (await new AxeBuilder({ page }).include(".calendar-event-editor").analyze())
      .violations,
  ).toEqual([]);
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const items = await (
    await page.request.get(
      "/api/v1/calendar/items?from=2026-09-07&to=2026-09-20",
    )
  ).json();
  expect(items).toHaveLength(2);
  expect(items[0]).toMatchObject({
    date: "2026-09-07",
    endDate: "2026-09-08",
    notes: "Two-day event",
  });
  expect(items[1]).toMatchObject({ date: "2026-09-14", endDate: "2026-09-15" });
});

test("cancel discards creation and closing a date picker keeps the draft open", async ({
  page,
}) => {
  const dialog = await start(page);
  await dialog.getByLabel("Title", { exact: true }).fill("Cancelled draft");
  await dialog.getByRole("button", { name: "Start date", exact: true }).click();
  await expect(
    dialog.getByRole("dialog", { name: "Choose day", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("dialog")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(
    (await (await page.request.get("/api/v1/weeks/2026-09-07")).json()).blocks,
  ).toHaveLength(0);
});
