import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
const date = "2026-09-07";
const headers = () => ({
  Origin: "http://localhost:3100",
  "Idempotency-Key": randomUUID(),
});
async function start(page: Page, view = "day") {
  page.setDefaultTimeout(10000);
  await page.clock.setFixedTime(new Date(`${date}T08:00:00Z`));
  expect(
    (
      await page.request.post("/api/auth/sign-up/email", {
        headers: headers(),
        data: {
          name: "Input review",
          email: `input-${randomUUID()}@example.com`,
          password: "Synthetic-calendar-password-123",
        },
      })
    ).status(),
  ).toBe(200);
  const plans: { id: string; title: string }[] = [];
  for (const [title, time] of [
    ["First plan", "09"],
    ["Second plan", "11"],
  ]) {
    const response = await page.request.post("/api/v1/time-blocks", {
      headers: headers(),
      data: {
        title,
        startsAt: `${date}T${time}:00:00Z`,
        endsAt: `${date}T${Number(time) + 1}:00:00Z`,
      },
    });
    expect(response.status()).toBe(201);
    plans.push(await response.json());
  }
  const response = await page.request.post("/api/v1/calendar/items", {
    headers: headers(),
    data: { title: "All-day plan", kind: "all_day", date, endDate: date },
  });
  expect(response.status()).toBe(201);
  plans.push(await response.json());
  await page.goto(`/?date=${date}&view=${view}`);
  await expect(
    page.getByRole("region", {
      name: view === "day" ? "Daily time grid" : "Weekly time grid",
    }),
  ).toBeVisible();
  return plans;
}
const edit = (page: Page) =>
  page.getByRole("dialog", { name: "Edit plan", exact: true });

const slot = (page: Page, day: string, hour: number) =>
  page.locator(
    `.hour-slot[data-context-date="${day}"][data-context-hour="${hour}"]`,
  );
const heading = (page: Page, day: string) =>
  page.locator(
    `.grid-day-heading[data-date="${day}"] > button, .month-day[data-date="${day}"] .month-select-day`,
  );
const actions = (page: Page) =>
  page.getByRole("button", { name: "Actions", exact: true });
const menu = (page: Page) =>
  page.getByRole("menu", { name: "Calendar actions" });
const selectedTime = (page: Page) => page.locator("[data-selected-time]");
const plan = (page: Page, id: string) =>
  page
    .getByRole("region", { name: "Day activity" })
    .locator(`[data-calendar-record="${id}"]`)
    .last();

test("arrows navigate five-minute slots across hours and days; day selection keeps a Tab entry", async ({
  page,
}) => {
  await start(page);
  await heading(page, date).press("Space");
  await expect(page.locator('.hour-slot[tabindex="0"]')).toHaveCount(1);
  await slot(page, date, 8).focus();
  await page.keyboard.press("ArrowDown");
  await expect(selectedTime(page)).toHaveAttribute(
    "data-selected-time",
    `${date}T08:05`,
  );
  await expect(slot(page, date, 8)).toHaveAccessibleName(
    `Select time on ${date} at 08:05`,
  );
  for (let i = 0; i < 11; i++) await page.keyboard.press("ArrowDown");
  await expect(slot(page, date, 9)).toBeFocused();
  await expect(selectedTime(page)).toHaveAttribute(
    "data-selected-time",
    `${date}T09:00`,
  );
  await page.keyboard.press("ArrowRight");
  await expect(slot(page, "2026-09-08", 9)).toBeFocused();
  await expect(selectedTime(page)).toHaveAttribute(
    "data-selected-time",
    "2026-09-08T09:00",
  );
  await page.keyboard.press("ArrowLeft");
  await expect(slot(page, date, 9)).toBeFocused();
  await slot(page, date, 0).focus();
  await page.keyboard.press("ArrowUp");
  await expect(slot(page, "2026-09-06", 23)).toBeFocused();
  await expect(selectedTime(page)).toHaveAttribute(
    "data-selected-time",
    "2026-09-06T23:55",
  );
  await page.keyboard.press("Enter");
  const draft = page.getByRole("dialog", { name: "Add plan", exact: true });
  await expect(draft.getByLabel("Start", { exact: true })).toHaveValue(
    "2026-09-06T23:55",
  );
  await page.keyboard.press("Escape");
  await expect(slot(page, "2026-09-06", 23)).toBeFocused();
  await heading(page, "2026-09-06").focus();
  await page.keyboard.press("ArrowRight");
  await expect(heading(page, date)).toBeFocused();
  await page.getByRole("link", { name: "Next day", exact: true }).click();
  await expect(heading(page, "2026-09-08")).toBeVisible();
  await expect(page.locator('.hour-slot[tabindex="0"]')).toHaveCount(1);
  await heading(page, "2026-09-08").press("Space");
  await expect(page.locator('.hour-slot[tabindex="0"]')).toHaveCount(1);
});

test("Week and Month have one day Tab entry with arrow navigation and keyboard range selection", async ({
  page,
}) => {
  await start(page, "week");
  await expect(
    page.locator('.grid-day-heading > button[tabindex="0"]'),
  ).toHaveCount(1);
  await heading(page, date).press("Space");
  await page.keyboard.press("Shift+ArrowRight");
  await expect(heading(page, "2026-09-08")).toBeFocused();
  await expect(heading(page, date)).toHaveAttribute("aria-pressed", "true");
  await expect(heading(page, "2026-09-08")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.keyboard.press("Control+Space");
  await expect(heading(page, "2026-09-08")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await heading(page, "2026-09-13").focus();
  await page.keyboard.press("ArrowRight");
  await expect(heading(page, "2026-09-14")).toBeFocused();
  await page.getByRole("link", { name: "Month", exact: true }).click();
  await expect(page.locator('.month-select-day[tabindex="0"]')).toHaveCount(1);
  await heading(page, "2026-09-14").focus();
  await page.keyboard.press("ArrowDown");
  await expect(heading(page, "2026-09-21")).toBeFocused();
  await page.keyboard.press("Space");
  await page.keyboard.press("Shift+ArrowUp");
  await expect(
    page.locator('.month-select-day[aria-pressed="true"]'),
  ).toHaveCount(8);
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("region", { name: "Daily time grid" }),
  ).toBeVisible();
  await expect(heading(page, "2026-09-14")).toBeVisible();
});

test("Space selects mixed plans, modifier Space groups and Enter edits", async ({
  page,
}) => {
  const plans = await start(page);
  const first = plan(page, plans[0]!.id),
    second = plan(page, plans[1]!.id),
    allDay = plan(page, plans[2]!.id);
  await first.press("Space");
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await expect(edit(page)).toHaveCount(0);
  await allDay.press("Control+Space");
  await expect(allDay).toHaveAttribute("aria-pressed", "true");
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await second.press("Shift+Space");
  await expect(allDay).toHaveAttribute("aria-pressed", "true");
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await expect(second).toHaveAttribute("aria-pressed", "true");
  await actions(page).click();
  await menu(page).getByRole("menuitem", { name: "Copy", exact: true }).click();
  await expect(page.locator(".calendar-notice-message")).toHaveText(
    "3 plans copied.",
  );
  await second.press("Enter");
  await expect(edit(page).getByLabel("Title", { exact: true })).toHaveValue(
    "Second plan",
  );
  await edit(page).getByLabel("Title", { exact: true }).press("ArrowLeft");
  await expect(edit(page)).toBeVisible();
  await page.keyboard.press("Escape");
});

test("touch actions support mixed groups, copy, destination paste and undo without long press", async ({
  page,
}, info) => {
  test.skip(info.project.name === "desktop", "Touch input");
  const plans = await start(page);
  await page
    .getByRole("button", { name: "Select multiple", exact: true })
    .tap();
  const first = plan(page, plans[0]!.id),
    allDay = plan(page, plans[2]!.id);
  await first.tap();
  await allDay.tap();
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await expect(allDay).toHaveAttribute("aria-pressed", "true");
  await first.tap();
  await expect(first).toHaveAttribute("aria-pressed", "false");
  await first.tap();
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await expect(edit(page)).toHaveCount(0);
  await actions(page).tap();
  await menu(page).getByRole("menuitem", { name: "Copy", exact: true }).tap();
  await page.getByRole("button", { name: "Done selecting", exact: true }).tap();
  await heading(page, date).tap();
  await actions(page).tap();
  await menu(page)
    .getByRole("menuitem", { name: "Paste into day", exact: true })
    .tap();
  await expect(page.locator(".calendar-notice-message")).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).tap();
  await expect(page.locator(".calendar-interactions")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.getByRole("link", { name: "Month", exact: true }).tap();
  await expect(
    page.getByRole("region", { name: "Monthly calendar" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Select multiple", exact: true })
    .tap();
  await expect(
    page.getByRole("button", { name: "Done selecting", exact: true }),
  ).toBeVisible();
  await heading(page, date).tap({ position: { x: 6, y: 6 } });
  await heading(page, "2026-09-09").tap({ position: { x: 6, y: 6 } });
  await expect(
    page.locator('.month-select-day[aria-pressed="true"]'),
  ).toHaveCount(2);
  await actions(page).tap();
  await expect(
    menu(page).getByRole("menuitem", {
      name: "Copy selected days",
      exact: true,
    }),
  ).toBeEnabled();
  await page.keyboard.press("Escape");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("overflow lists expose the same explicit actions and selection toggle", async ({
  page,
}) => {
  const plans = await start(page, "week");
  for (let index = 0; index < 3; index++) {
    const response = await page.request.post("/api/v1/time-blocks", {
      headers: headers(),
      data: {
        title: `Overlap ${index}`,
        startsAt: `${date}T09:00:00Z`,
        endsAt: `${date}T10:00:00Z`,
      },
    });
    expect(response.status()).toBe(201);
  }
  await page.reload();
  await page
    .getByRole("button", { name: new RegExp(`Show all records for ${date},`) })
    .first()
    .click();
  const popup = page.locator("dialog[open]");
  await popup
    .getByRole("button", { name: "Select multiple", exact: true })
    .click();
  const first = popup.locator(`[data-calendar-record="${plans[0]!.id}"]`);
  const allDay = popup.locator(`[data-calendar-record="${plans[2]!.id}"]`);
  await first.click();
  await allDay.click();
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await expect(allDay).toHaveAttribute("aria-pressed", "true");
  await popup.getByRole("button", { name: "Actions", exact: true }).click();
  await expect(popup.getByRole("menu")).toBeVisible();
  await popup.getByRole("menuitem", { name: "Copy", exact: true }).click();
  await expect(popup.locator(".calendar-notice-message")).toHaveText(
    "2 plans copied.",
  );
  await popup.getByRole("button", { name: "Actions", exact: true }).click();
  await popup.getByRole("menuitem", { name: "Delete", exact: true }).click();
  await expect(first).toHaveCount(0);
  await expect(allDay).toHaveCount(0);
  await popup.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(first).toBeVisible();
  await expect(allDay).toBeVisible();
});
