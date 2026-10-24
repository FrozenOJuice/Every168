import { expect, test, type Page, type Locator } from "@playwright/test";
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
async function multiple(root: Page | Locator, enabled = true, touch = false) {
  const button = root.getByRole("button", { name: "Actions", exact: true });
  if (touch) await button.tap();
  else await button.click();
  const option = root.getByRole("menuitem", {
    name: enabled ? "Select multiple" : "Done selecting",
    exact: true,
  });
  if (touch) await option.tap();
  else await option.click();
}
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
  await expect(page.locator(".app-toast-message")).toHaveText(
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
  await multiple(page, true, true);
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
  await multiple(page, false, true);
  await heading(page, date).tap();
  await actions(page).tap();
  await menu(page)
    .getByRole("menuitem", { name: "Paste into day", exact: true })
    .tap();
  await expect(page.locator(".app-toast-message")).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).tap();
  await expect(page.locator(".calendar-interactions")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.getByRole("link", { name: "Month", exact: true }).tap();
  await expect(
    page.getByRole("region", { name: "Monthly calendar" }),
  ).toBeVisible();
  await multiple(page, true, true);
  await expect(
    page.locator('.calendar-actions-button[data-selecting="true"]'),
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
  await multiple(popup, true, false);
  const first = popup.locator(`[data-calendar-record="${plans[0]!.id}"]`);
  const allDay = popup.locator(`[data-calendar-record="${plans[2]!.id}"]`);
  await first.click();
  await allDay.click();
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await expect(allDay).toHaveAttribute("aria-pressed", "true");
  await popup.getByRole("button", { name: "Actions", exact: true }).click();
  await expect(popup.getByRole("menu")).toBeVisible();
  await popup.getByRole("menuitem", { name: "Copy", exact: true }).click();
  await expect(popup.locator(".app-toast-message")).toHaveText(
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

test("multi-select context menus preserve selected groups and replace them for unselected timed or all-day plans", async ({
  page,
}) => {
  const plans = await start(page);
  const first = plan(page, plans[0]!.id),
    second = plan(page, plans[1]!.id),
    allDay = plan(page, plans[2]!.id);
  await multiple(page, true, false);
  await first.click();
  await allDay.click();
  await first.click({ button: "right" });
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await expect(allDay).toHaveAttribute("aria-pressed", "true");
  await expect(
    menu(page).getByRole("menuitem", { name: "Edit", exact: true }),
  ).toHaveCount(0);
  await menu(page).getByRole("menuitem", { name: "Copy", exact: true }).click();
  await expect(page.locator(".app-toast-message")).toHaveText(
    "2 plans copied.",
  );
  await second.click({ button: "right" });
  await expect(second).toHaveAttribute("aria-pressed", "true");
  await expect(first).toHaveAttribute("aria-pressed", "false");
  await expect(allDay).toHaveAttribute("aria-pressed", "false");
  await expect(
    menu(page).getByRole("menuitem", { name: "Edit", exact: true }),
  ).toBeVisible();
  await menu(page).getByRole("menuitem", { name: "Copy", exact: true }).click();
  await expect(page.locator(".app-toast-message")).toHaveText("Plan copied.");
  await allDay.click({ button: "right" });
  await expect(allDay).toHaveAttribute("aria-pressed", "true");
  await expect(second).toHaveAttribute("aria-pressed", "false");
  await menu(page)
    .getByRole("menuitem", { name: "Delete", exact: true })
    .click();
  await expect(allDay).toHaveCount(0);
  await expect(first).toBeVisible();
  await expect(second).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(allDay).toBeVisible();
  await expect(
    page.locator('.calendar-actions-button[data-selecting="true"]'),
  ).toBeVisible();
});

test("keyboard date and view navigation clear plan selections and anchors without clearing the clipboard", async ({
  page,
}) => {
  const plans = await start(page, "week");
  const gridFirst = page.locator(
    `.grid-day [data-calendar-record="${plans[0]!.id}"]`,
  );
  const gridSecond = page.locator(
    `.grid-day [data-calendar-record="${plans[1]!.id}"]`,
  );
  const gridAllDay = page.locator(
    `[data-context-all-day] [data-calendar-record="${plans[2]!.id}"]`,
  );
  await gridFirst.press("Space");
  await gridAllDay.press("Control+Space");
  await page.keyboard.press("Control+c");
  await expect(page.locator(".app-toast-message")).toHaveText(
    "2 plans copied.",
  );
  await page
    .getByRole("link", { name: "Next week", exact: true })
    .press("Enter");
  await expect(heading(page, "2026-09-14")).toBeVisible();
  await expect(page.locator(".calendar-selection-summary")).toBeEmpty();
  await expect(
    page.locator('[data-calendar-record][aria-pressed="true"]'),
  ).toHaveCount(0);
  await actions(page).click();
  await expect(
    menu(page).getByRole("menuitem", { name: "Paste into day", exact: true }),
  ).toBeEnabled();
  await page.keyboard.press("Escape");
  await page
    .getByRole("link", { name: "Previous week", exact: true })
    .press("Enter");
  await expect(heading(page, date)).toBeVisible();
  await expect(page.locator(".calendar-selection-summary")).toBeEmpty();
  await gridSecond.press("Shift+Space");
  await expect(gridSecond).toHaveAttribute("aria-pressed", "true");
  await expect(gridFirst).toHaveAttribute("aria-pressed", "false");
  await expect(gridAllDay).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("link", { name: "Month", exact: true }).press("Enter");
  await expect(
    page.getByRole("region", { name: "Monthly calendar" }),
  ).toBeVisible();
  await expect(page.locator(".calendar-selection-summary")).toBeEmpty();
  await page.getByRole("link", { name: "Day", exact: true }).press("Enter");
  await expect(
    page.getByRole("region", { name: "Daily time grid" }),
  ).toBeVisible();
  await plan(page, plans[2]!.id).press("Space");
  await page
    .getByRole("link", { name: "Next day", exact: true })
    .press("Enter");
  await expect(heading(page, "2026-09-08")).toBeVisible();
  await expect(page.locator(".calendar-selection-summary")).toBeEmpty();
  await actions(page).click();
  await expect(
    menu(page).getByRole("menuitem", { name: "Paste into day", exact: true }),
  ).toBeEnabled();
});

test("Actions resolves selected plan data without a rendered plan anchor and retains precise slot destinations", async ({
  page,
}) => {
  const plans = await start(page);
  await plan(page, plans[0]!.id).press("Space");
  const style = await page.addStyleTag({
    content: `[data-calendar-record="${plans[0]!.id}"] {display:none !important;}`,
  });
  await actions(page).click();
  await expect(
    menu(page).getByRole("menuitem", { name: "Copy", exact: true }),
  ).toBeEnabled();
  await menu(page).getByRole("menuitem", { name: "Copy", exact: true }).click();
  await expect(page.locator(".app-toast-message")).toHaveText("Plan copied.");
  await style.evaluate((element) => element.remove());
  await slot(page, date, 10).focus();
  await page.keyboard.press("ArrowDown");
  await expect(selectedTime(page)).toHaveAttribute(
    "data-selected-time",
    `${date}T10:05`,
  );
  await actions(page).click();
  await menu(page)
    .getByRole("menuitem", { name: "Add plan here", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog", { name: "Add plan", exact: true })
      .getByLabel("Start", { exact: true }),
  ).toHaveValue(`${date}T10:05`);
  await page.keyboard.press("Escape");
  await heading(page, date).press("Space");
  await page.keyboard.press("Escape");
  await expect(heading(page, date)).toHaveAttribute("aria-pressed", "false");
});

test("compact toolbar keeps selection and Calendar tools reachable without an extra controls row", async ({
  page,
}, info) => {
  await start(page);
  const toolbar = page.locator(".calendar-toolbar");
  await expect(toolbar.locator(".calendar-toolbar-actions button")).toHaveCount(
    3,
  );
  await expect(
    toolbar.getByRole("button", { name: "Actions", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".calendar-surface > .calendar-selection-actions"),
  ).toHaveCount(0);
  await actions(page).press("Enter");
  await expect(
    menu(page).getByRole("menuitem", { name: "Select multiple", exact: true }),
  ).toBeVisible();
  await menu(page)
    .getByRole("menuitem", { name: "Calendar tools…", exact: true })
    .click();
  const tools = page.getByRole("dialog", {
    name: "Calendar tools",
    exact: true,
  });
  await expect(
    tools.getByRole("button", { name: /repeating plan/i }),
  ).toBeVisible();
  await expect(
    tools.getByRole("button", { name: /all-day plan/i }),
  ).toBeVisible();
  await expect(tools.getByRole("button", { name: /Templates/ })).toBeVisible();
  await expect(
    tools.getByRole("button", { name: /Quick actions/ }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(actions(page)).toBeFocused();
  for (const view of ["day", "week", "month"]) {
    await page
      .getByRole("link", {
        name: view[0]!.toUpperCase() + view.slice(1),
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("region", {
        name:
          view === "day"
            ? "Daily time grid"
            : view === "week"
              ? "Weekly time grid"
              : "Monthly calendar",
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `/private/tmp/calendar-compact-${info.project.name}-${view}.png`,
    });
  }
  if (info.project.name === "phone") {
    await page.setViewportSize({ width: 320, height: 740 });
    const button = await actions(page).boundingBox();
    const selector = await page
      .getByRole("navigation", { name: "Calendar view", exact: true })
      .boundingBox();
    expect(button!.x + button!.width).toBeLessThanOrEqual(selector!.x);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
