import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

test("Calendar brings plans, sessions and moments together with quick creation and safe retries", async ({
  page,
}, testInfo) => {
  const headers = () => ({
    Origin: "http://localhost:3100",
    "Idempotency-Key": randomUUID(),
  });
  const signup = await page.request.post("/api/auth/sign-up/email", {
    headers: headers(),
    data: {
      name: "Day feed member",
      email: `feed-${randomUUID()}@example.com`,
      password: "Synthetic-calendar-password-123",
    },
  });
  expect(signup.status()).toBe(200);
  const me = await (await page.request.get("/api/v1/me")).json();
  expect(
    (
      await page.request.put("/api/v1/preferences", {
        headers: { ...headers(), "If-Match": `"${me.preferences.version}"` },
        data: {
          timezone: "UTC",
          weekStartsOn: 1,
          weightUnit: "kg",
          distanceUnit: "km",
        },
      })
    ).status(),
  ).toBe(200);
  const post = async (path: string, data: object) => {
    const response = await page.request.post("/api/v1/" + path, {
      headers: headers(),
      data,
    });
    expect(response.status()).toBe(201);
    return response.json();
  };
  await post("time-blocks", {
    title: "Morning plan",
    startsAt: "2026-10-07T09:00:00Z",
    endsAt: "2026-10-07T10:00:00Z",
  });
  await post("time-blocks", {
    title: "Current plan",
    startsAt: "2026-10-07T15:30:00Z",
    endsAt: "2026-10-07T16:30:00Z",
  });
  await post("time-blocks", {
    title: "Later plan",
    startsAt: "2026-10-07T17:00:00Z",
    endsAt: "2026-10-07T18:00:00Z",
  });
  await post("time-blocks", {
    title: "Evening plan",
    startsAt: "2026-10-07T21:00:00Z",
    endsAt: "2026-10-07T22:00:00Z",
  });
  for (const minute of [0, 15, 30])
    await post("water-entries", {
      amountMl: 250,
      consumedAt: `2026-10-07T10:${String(minute).padStart(2, "0")}:00Z`,
    });
  const food = await post("foods", {
    name: "Recorded lunch",
    servingAmount: 1,
    servingUnit: "item",
    calories: 300,
  });
  await post("food-entries", {
    foodId: food.id,
    consumedAt: "2026-10-07T12:00:00Z",
    quantity: 1,
  });
  await post("cardio-activities", {
    title: "Recorded walk",
    activityType: "walk",
    startedAt: "2026-10-07T13:00:00Z",
    durationSeconds: 1800,
  });
  await page.clock.install({ time: new Date("2026-10-07T16:00:00Z") });
  await page.goto("/?date=2026-10-07&view=day");
  const feed = page.getByRole("region", { name: "Day activity", exact: true });
  await expect(feed).toBeVisible();
  await expect(
    feed.getByRole("heading", { name: "Your day", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".daily-grid .calendar-grid-head")).toHaveCount(1);
  if (testInfo.project.name === "desktop") {
    const period = (await page.locator(".calendar-period").boundingBox())!;
    const sidebar = (await feed.boundingBox())!;
    const tools = (await page.locator(".calendar-view-tools").boundingBox())!;
    const toolbar = (await page.locator(".calendar-toolbar").boundingBox())!;
    const views = (await page
      .getByRole("navigation", { name: "Calendar view" })
      .boundingBox())!;
    const today = (await page
      .getByRole("link", { name: "Today", exact: true })
      .boundingBox())!;
    expect(views.x + views.width / 2).toBeCloseTo(
      toolbar.x + toolbar.width / 2,
      0,
    );
    expect(today.x).toBeGreaterThan(views.x + views.width);
    await expect(page.locator(".calendar-toolbar-actions button")).toHaveText([
      "Add",
      "",
      "",
    ]);
    await expect(
      page.locator(".calendar-toolbar-actions button").nth(1),
    ).toHaveAttribute("aria-label", "Search and filter calendar");
    await expect(
      page.locator(".calendar-toolbar-actions button").nth(2),
    ).toHaveAttribute("aria-label", "Calendar tools");
    expect(period.x).toBeCloseTo(sidebar.x, 0);
    expect(period.width).toBeCloseTo(sidebar.width, 0);
    expect(tools.x + tools.width).toBeLessThanOrEqual(period.x);
  }

  await expect(
    feed.getByRole("heading", { name: "Earlier", exact: true }),
  ).toBeVisible();
  await expect(
    feed.getByRole("heading", { name: "Now", exact: true }),
  ).toBeVisible();
  await expect(
    feed.getByRole("heading", { name: "Coming up", exact: true }),
  ).toBeVisible();
  await expect(
    feed.getByRole("button", { name: /Next.*Later plan/ }),
  ).toBeVisible();
  const comingUp = feed
    .getByRole("heading", { name: "Coming up", exact: true })
    .locator("..");
  await expect(
    comingUp.getByRole("button", { name: /Evening plan/ }),
  ).toBeVisible();
  await expect(
    comingUp.getByRole("button", { name: /Later plan/ }),
  ).toHaveCount(0);
  await expect(feed.getByRole("link", { name: /Recorded walk/ })).toHaveCount(
    1,
  );
  await expect(feed.getByRole("button", { name: /Recorded walk/ })).toHaveCount(
    0,
  );
  await feed.getByText(/3 Water moments/).click();
  await expect(feed.getByRole("link", { name: /Water.*250 ml/ })).toHaveCount(
    3,
  );
  await expect(
    feed.getByRole("link", { name: /Recorded lunch/ }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("calendar-day-feed.png"),
    fullPage: true,
  });
  await expect(page.locator(".calendar-caption, .calendar-legend")).toHaveCount(
    0,
  );
  const day = page.getByRole("region", { name: "Daily time grid" });
  const slot = day.getByRole("button", {
    name: "Select time on 2026-10-07 at 19:00",
    exact: true,
  });
  await slot.scrollIntoViewIfNeeded();
  await slot.click({ position: { x: 15, y: 16 } });
  const dialog = page.getByRole("dialog");
  async function expectCreationOptions() {
    await expect(
      dialog.getByRole("button", { name: "Record", exact: true }),
    ).toHaveCount(0);
    await expect(
      dialog.getByRole("button", { name: "Plan", exact: true }),
    ).toHaveCount(0);
    const details = dialog.getByText("More details", { exact: true });
    await details.click();
    await expect(dialog.getByLabel("Category", { exact: true })).toHaveCount(0);
    await expect(dialog.getByLabel("Goal (optional)")).toHaveCount(0);
    await expect(dialog.getByLabel("Notes (optional)")).toBeVisible();
    await details.click();
    const otherPlans = dialog.getByText("Other plans", { exact: true });
    await otherPlans.click();
    await expect(
      dialog.getByRole("link", { name: "Unscheduled plans" }),
    ).toBeVisible();
    await expect(
      dialog.getByLabel("All day", { exact: true }),
    ).not.toBeChecked();
    await expect(dialog.getByLabel("Repeat", { exact: true })).toHaveValue(
      "never",
    );
    await otherPlans.click();
  }
  await expect(dialog).toHaveCount(0);
  await expect(slot).toHaveAttribute("aria-pressed", "true");
  await expect(day.locator("[data-selected-time]")).toHaveAttribute(
    "data-selected-time",
    "2026-10-07T19:15",
  );
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(dialog.getByLabel("Start", { exact: true })).toHaveValue(
    "2026-10-07T19:15",
  );
  await expect(dialog.getByLabel("End", { exact: true })).toHaveValue(
    "2026-10-07T20:15",
  );
  await page.keyboard.press("Escape");
  await expect(day.locator("[data-selected-time]")).toHaveCount(0);
  await slot.dblclick({ position: { x: 15, y: 16 } });
  await expect(dialog.getByLabel("Start", { exact: true })).toHaveValue(
    "2026-10-07T19:15",
  );
  await expect(
    dialog.getByLabel("Category", { exact: true }),
  ).not.toBeVisible();
  await expect(dialog).toHaveAttribute("aria-modal", "false");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(dialog.getByLabel("Title", { exact: true })).toBeFocused();
  await expectCreationOptions();
  await dialog.getByLabel("Repeat", { exact: true }).selectOption("weekly");
  await dialog.getByLabel("Repeat through").fill("2026-10-21");
  await expect(dialog.locator(".calendar-repeat-preview")).toContainText(
    "plans will be added",
  );
  await dialog.getByLabel("Repeat", { exact: true }).selectOption("custom");
  await dialog.getByLabel("Every", { exact: true }).fill("2");
  await expect(dialog.locator(".calendar-repeat-preview")).toContainText(
    "Every 2 weeks",
  );
  await dialog.getByLabel("Repeat", { exact: true }).selectOption("never");
  await expect(day.locator("[data-calendar-draft]")).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const panel = (await dialog.boundingBox())!;
  if (testInfo.project.name === "desktop")
    expect(panel.height).toBeLessThan(410);
  expect(panel.x).toBeGreaterThanOrEqual(0);
  expect(panel.x + panel.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  expect(panel.y + panel.height).toBeLessThanOrEqual(
    page.viewportSize()!.height,
  );
  await page.screenshot({
    path: testInfo.outputPath("plan-popover.png"),
    fullPage: true,
  });
  const dismissSlotBounds = (await slot.boundingBox())!;
  await page.mouse.click(
    dismissSlotBounds.x + dismissSlotBounds.width - 4,
    dismissSlotBounds.y + 16,
  );
  await expect(dialog).toHaveCount(0);
  await expect(day.locator("[data-calendar-draft]")).toHaveCount(0);
  await expect(slot).toHaveAttribute("aria-pressed", "false");
  await expect(day.locator("[data-selected-time]")).toHaveCount(0);
  await slot.click({ position: { x: 15, y: 16 } });
  await expect(slot).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(dialog.getByLabel("Start", { exact: true })).toHaveValue(
    "2026-10-07T16:00",
  );
  const draft = day.locator("[data-calendar-draft]");
  await expect(draft).toBeInViewport();
  await dialog.getByLabel("Title", { exact: true }).fill("Toolbar draft");
  await expect(draft).toContainText("Toolbar draft");
  await dialog.getByLabel("Start", { exact: true }).fill("2026-10-07T11:05");
  await dialog.getByLabel("End", { exact: true }).fill("2026-10-07T11:35");
  await expect(draft).toContainText("11:05 AM - 11:35 AM");
  await expect(draft).toHaveCSS("height", "30px");
  await page.keyboard.press("Escape");
  await expect(draft).toHaveCount(0);
  expect(
    (await (await page.request.get("/api/v1/weeks/2026-10-05")).json()).blocks,
  ).toHaveLength(4);
  await page.getByRole("button", { name: "Calendar tools" }).click();
  await dialog.getByRole("button", { name: /^Quick actions/ }).click();
  await dialog.getByRole("button", { name: "Log water", exact: true }).click();
  await dialog.getByLabel("Drank at", { exact: true }).fill("2026-10-07T19:15");
  const keys: string[] = [];
  await page.route("**/api/v1/water-entries", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    keys.push(route.request().headers()["idempotency-key"]!);
    if (keys.length === 1) {
      expect((await route.fetch()).status()).toBe(201);
      await route.abort("failed");
    } else await route.continue();
  });
  await dialog.getByRole("button", { name: "Log water", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Retry save", exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Retry save", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  await page.unroute("**/api/v1/water-entries");
  await expect(feed.getByRole("link", { name: /Water.*7:15/ })).toHaveCount(1);
  // Verify the point log created no accounting duration.
  const week = await (
    await page.request.get("/api/v1/weeks/2026-10-05")
  ).json();
  expect(week.entries).toHaveLength(1);
  const activity = await (
    await page.request.get(
      "/api/v1/calendar/activity?from=2026-10-07&to=2026-10-07",
    )
  ).json();
  const added = activity.entries.find(
    (entry: { source: { type: string }; occurredAt: string }) =>
      entry.source.type === "water_entry" && entry.occurredAt.includes("19:15"),
  );
  expect(added.endsAt).toBeNull();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await dialog.getByLabel("Title", { exact: true }).fill("Simple new plan");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    feed.getByRole("button", { name: /Simple new plan.*planned/ }),
  ).toBeVisible();
  await feed
    .getByRole("button", { name: /Simple new plan.*planned/ })
    .dblclick();
  await expect(dialog).toHaveAttribute("aria-modal", "false");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(
    dialog.getByLabel("Category", { exact: true }),
  ).not.toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Delete block", exact: true }),
  ).not.toBeVisible();
  if (testInfo.project.name === "desktop")
    expect((await dialog.boundingBox())!.height).toBeLessThan(310);
  await dialog.getByLabel("Title", { exact: true }).fill("Edited compact plan");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("edit-plan-tab.png"),
    fullPage: true,
  });
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    feed.getByRole("button", { name: /Edited compact plan.*planned/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Week", exact: true }).click();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.locator("[data-calendar-draft]")).toBeInViewport();
  await page.keyboard.press("Escape");
  const otherDaySlot = page.getByRole("button", {
    name: "Select time on 2026-10-08 at 19:00",
    exact: true,
  });
  await otherDaySlot.click({ position: { x: 15, y: 16 } });
  await expect(dialog).toHaveCount(0);
  await expect(otherDaySlot).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(dialog.getByLabel("Start", { exact: true })).toHaveValue(
    "2026-10-08T19:15",
  );
  await expect(dialog.getByLabel("End", { exact: true })).toHaveValue(
    "2026-10-08T20:15",
  );
  await expectCreationOptions();
  await dialog.getByLabel("Title", { exact: true }).fill("Carried title");
  await dialog.getByLabel("All day", { exact: true }).check();
  await expect(page.locator("[data-calendar-draft]")).toHaveCount(0);
  await expect(dialog.getByLabel("Title", { exact: true })).toHaveValue(
    "Carried title",
  );
  await expect(dialog.getByLabel("Start", { exact: true })).toHaveCount(0);
  await expect(dialog.getByLabel("Date", { exact: true })).toHaveValue(
    "2026-10-08",
  );
  await page.keyboard.press("Escape");
  await otherDaySlot.click({ position: { x: 15, y: 16 } });
  await page.keyboard.press("Escape");
  await expect(otherDaySlot).toHaveAttribute("aria-pressed", "false");
  await otherDaySlot.click({ position: { x: 15, y: 16 } });
  await page.getByRole("link", { name: "Day", exact: true }).click();
  await expect(page).toHaveURL(/date=2026-10-08&view=day/);
  await expect(page.locator("[data-selected-time]")).toHaveCount(0);
  await page.getByRole("link", { name: "Week", exact: true }).click();
  await expect(page).toHaveURL(/date=2026-10-08&view=week/);
  await expect(page.locator("[data-selected-time]")).toHaveCount(0);
  const marker = page.getByRole("button", {
    name: "Show moments for 2026-10-07",
    exact: true,
  });
  await expect(marker).toBeVisible();
  await marker.click();
  await expect(
    dialog.getByRole("link", { name: /Recorded lunch/ }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Month", exact: true }).click();
  await expect(page).toHaveURL(/date=2026-10-08&view=month/);
  await expect(
    page.getByRole("region", { name: "Monthly calendar" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(dialog.getByLabel("Start", { exact: true })).toHaveValue(
    "2026-10-08T16:00",
  );
  await expect(page.locator(".month-add")).toHaveCount(0);
  const selectedDay = page.getByRole("button", {
    name: "Select 2026-10-09, 0 records",
    exact: true,
  });
  const dismissDay = page.getByRole("button", {
    name: "Select 2026-10-04, 0 records",
    exact: true,
  });
  const dismissDayBounds = (await dismissDay.boundingBox())!;
  await page.mouse.click(
    dismissDayBounds.x + dismissDayBounds.width - 2,
    dismissDayBounds.y + 10,
  );
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("[data-calendar-draft]")).toHaveCount(0);
  await expect(dismissDay).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.locator('.month-select-day[aria-pressed="true"]'),
  ).toHaveCount(0);
  await selectedDay.click();
  await expect(selectedDay).toHaveAttribute("aria-pressed", "true");
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(dialog.getByLabel("Start", { exact: true })).toHaveValue(
    "2026-10-09T16:00",
  );
  await expect(dialog.getByLabel("End", { exact: true })).toHaveValue(
    "2026-10-09T17:00",
  );
  await expect(
    page.locator('[data-calendar-draft="2026-10-09"]'),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  const doubleDay = page.getByRole("button", {
    name: "Select 2026-10-10, 0 records",
    exact: true,
  });
  await doubleDay.dblclick();
  await expect(page).toHaveURL(/date=2026-10-10&view=day/);
  await expect(dialog).toHaveCount(0);
  await page.getByRole("link", { name: "Month", exact: true }).click();
  await selectedDay.focus();
  await page.keyboard.press("Space");
  await expect(selectedDay).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/date=2026-10-09&view=day/);
  await expect(dialog).toHaveCount(0);
  await page.goto("/?date=2026-10-08&view=month");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(dialog.getByLabel("Start", { exact: true })).toHaveValue(
    "2026-10-08T16:00",
  );
  await expectCreationOptions();
  await dialog.getByLabel("Title", { exact: true }).fill("Month draft");
  await expect(
    page.locator('[data-calendar-draft="2026-10-08"]'),
  ).toContainText("Month draft");
  await expect(
    page.locator('[data-calendar-draft="2026-10-08"]'),
  ).toBeInViewport();
  const monthDraft = (await page
    .locator('[data-calendar-draft="2026-10-08"]')
    .boundingBox())!;
  const monthDay = (await page
    .locator('.month-day[data-date="2026-10-08"]')
    .boundingBox())!;
  expect(monthDraft.y + monthDraft.height).toBeLessThanOrEqual(
    monthDay.y + monthDay.height,
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("calendar-moments-month.png"),
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-calendar-draft]")).toHaveCount(0);
});
