import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { Week } from "@168hours/contracts";

test("day, week and month calendars keep planning focused", async ({
  page,
}, testInfo) => {
  const headers = () => ({
    Origin: "http://localhost:3100",
    "Idempotency-Key": randomUUID(),
  });
  const signup = await page.request.post("/api/auth/sign-up/email", {
    headers: headers(),
    data: {
      name: "Calendar member",
      email: `calendar-${randomUUID()}@example.com`,
      password: "Synthetic-calendar-password-123",
    },
  });
  expect(signup.status()).toBe(200);
  const me = await (await page.request.get("/api/v1/me")).json();
  const preferences = await page.request.put("/api/v1/preferences", {
    headers: { ...headers(), "If-Match": `"${me.preferences.version}"` },
    data: {
      timezone: "America/Edmonton",
      weekStartsOn: 1,
      weightUnit: "kg",
      distanceUnit: "km",
    },
  });
  expect(preferences.status()).toBe(200);
  const category = await (
    await page.request.post("/api/v1/categories", {
      headers: headers(),
      data: { name: "Work", color: "#196b57" },
    })
  ).json();
  async function block(
    title: string,
    startsAt: string,
    endsAt: string,
    categoryId: string | null = null,
  ) {
    const response = await page.request.post("/api/v1/time-blocks", {
      headers: headers(),
      data: { title, startsAt, endsAt, categoryId },
    });
    expect(response.status()).toBe(201);
    return response.json();
  }
  const planned = await block(
    "Morning focus",
    "2026-09-07T15:00:00Z",
    "2026-09-07T16:00:00Z",
    category.id,
  );
  await block("Walk outside", "2026-09-07T15:30:00Z", "2026-09-07T16:30:00Z");
  await block("Quick note", "2026-09-07T18:00:00Z", "2026-09-07T18:05:00Z");
  for (let i = 1; i <= 4; i++)
    await block(
      `Busy block ${i}`,
      "2026-09-07T17:00:00Z",
      "2026-09-07T17:30:00Z",
    );
  await block(
    "Overnight reading",
    "2026-09-14T05:30:00Z",
    "2026-09-14T06:30:00Z",
  );
  const cardio = await page.request.post("/api/v1/cardio-activities", {
    headers: headers(),
    data: {
      activityType: "walk",
      title: "Recorded walk",
      startedAt: "2026-09-07T15:10:00Z",
      durationSeconds: 1200,
      linkedTimeBlockId: planned.id,
    },
  });
  expect(cardio.status()).toBe(201);
  const goalResponse = await page.request.post("/api/v1/goals", {
    headers: headers(),
    data: { title: "Plan a project" },
  });
  expect(goalResponse.status()).toBe(201);
  const goal = await goalResponse.json();
  await page.goto("/?date=2026-09-07");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  const views = page.getByRole("navigation", { name: "Calendar view" });
  const grid = page.getByRole("region", { name: "Weekly time grid" });
  const day = page.getByRole("region", { name: "Daily time grid" });
  const month = page.getByRole("region", { name: "Monthly calendar" });
  const monthCell = (date: string) => month.locator(`[data-date="${date}"]`);
  async function expectMonthCount(date: string, count: number) {
    await expect(
      monthCell(date).locator(".month-date, .month-compact-day"),
    ).toHaveAttribute(
      "aria-label",
      new RegExp(
        `(Day view for ${date}, ${count} records|Show ${count} records for ${date})`,
      ),
    );
  }
  async function openMonthDay(date: string) {
    const cell = monthCell(date);
    // ResizeObserver may switch the target from a link to a button after loading.
    await cell.locator(".month-date, .month-compact-day").click();
    const openDay = page
      .getByRole("dialog")
      .getByRole("link", { name: "Open Day view" });
    await expect(day.or(openDay)).toBeVisible();
    if (await openDay.isVisible()) await openDay.click();
  }
  async function auditAndCapture(name: string) {
    await expect(page).toHaveTitle("168Hours");
    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(name + ".png"),
      fullPage: true,
    });
  }
  await expect(nav.getByRole("link")).toHaveText([
    "Calendar",
    "Food",
    "Exercise",
    "Goals",
  ]);
  await expect(views.getByRole("link")).toHaveText(["Day", "Week", "Month"]);
  await expect(
    views.getByRole("link", { name: "Week", exact: true }),
  ).toHaveAttribute("aria-current", "true");
  await expect(grid).toBeVisible();
  const arrows = page.locator(".calendar-date-controls").getByRole("link");
  await expect(arrows).toHaveText(["", "Today", ""]);
  await expect(arrows.first()).toHaveAttribute("aria-label", "Previous week");
  await expect(arrows.last()).toHaveAttribute("aria-label", "Next week");
  await expect(
    page.getByRole("button", { name: "Calendar details", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("complementary", { name: "Calendar details" }),
  ).toHaveCount(0);
  const box = await page.locator(".calendar-surface").boundingBox();
  expect(box!.height).toBeGreaterThan(page.viewportSize()!.height * 0.75);
  await expect(
    page.getByRole("link", { name: "Settings", exact: true }),
  ).toBeHidden();
  await page.getByRole("button", { name: "Account menu" }).click();
  await expect(
    page.getByRole("link", { name: "Settings", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Account menu" }),
  ).toBeFocused();
  await expect(
    grid.getByRole("button", {
      name: /Morning focus.*overlapping.*linked record/,
    }),
  ).toBeVisible();
  await expect(
    grid.getByRole("button", { name: /Recorded walk.*recorded/ }),
  ).toBeVisible();
  await auditAndCapture("calendar-week");
  await expect(grid.getByText("Busy day", { exact: true })).toHaveCount(0);
  await expect(grid.getByRole("button", { name: /Quick note/ })).toBeVisible();
  await grid
    .getByRole("button", { name: /Show all records for 2026-09-07/ })
    .click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: /Busy block/ }),
  ).toHaveCount(4);
  await auditAndCapture("calendar-day-records");
  await page.keyboard.press("Escape");
  await expect(
    grid.getByRole("button", { name: /Show all records for 2026-09-07/ }),
  ).toBeFocused();
  await grid.getByRole("button", { name: /Morning focus.*planned/ }).click();
  await expect(
    page.getByRole("heading", { name: "Linked recorded time" }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Recorded walk/ })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Linked plan: Morning focus",
  );
  await page.getByRole("link", { name: "View activity" }).click();
  await expect(page).toHaveURL(/exercise\?tab=cardio/);
  await expect(
    nav.getByRole("link", { name: "Exercise", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("heading", { name: "Recorded walk" }),
  ).toBeVisible();
  await page.goto("/?date=2026-09-07");
  await page.getByRole("link", { name: "Next week" }).click();
  await expect(page).toHaveURL(/date=2026-09-14/);
  await page.reload();
  await expect(grid).toBeVisible();
  await views.getByRole("link", { name: "Day", exact: true }).click();
  await expect(
    day.getByRole("button", { name: /Overnight reading/ }),
  ).toContainText("Until 12:30 AM");
  await page.getByRole("link", { name: "Previous day" }).click();
  await expect(page).toHaveURL(/date=2026-09-13.*view=day/);
  await expect(
    day.getByRole("button", { name: /Overnight reading/ }),
  ).toBeVisible();
  await views.getByRole("link", { name: "Month", exact: true }).click();
  await expect(month).toBeVisible();
  await expectMonthCount("2026-09-13", 1);
  await expectMonthCount("2026-09-14", 1);
  await expect(month.locator(".month-day")).toHaveCount(35);
  await auditAndCapture("calendar-month");
  await monthCell("2026-09-07")
    .getByRole("button", { name: /Show .*records for 2026-09-07/ })
    .click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: /Busy block/ }),
  ).toHaveCount(4);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Quick note/ })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Edit block", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  if (testInfo.project.name === "desktop") {
    const viewport = page.viewportSize()!;
    await page.setViewportSize({ width: 1440, height: 1100 });
    await expect(monthCell("2026-09-07").locator(".month-preview")).toHaveCount(
      2,
    );
    await auditAndCapture("calendar-month-tall");
    await page.setViewportSize(viewport);
  }
  await page.getByRole("link", { name: "Previous month" }).click();
  await expect(page).toHaveURL(/date=2026-08-13.*view=month/);
  await expect(month.locator(".month-day")).toHaveCount(42);
  await expect(
    monthCell("2026-09-06").locator(".month-date, .month-compact-day"),
  ).toBeInViewport({ ratio: 1 });
  await page.reload();
  await expect(
    views.getByRole("link", { name: "Month", exact: true }),
  ).toHaveAttribute("aria-current", "true");
  await page.getByRole("link", { name: "Next month" }).click();
  await openMonthDay("2026-09-15");
  await expect(page).toHaveURL(/date=2026-09-15.*view=day/);
  await expect(day).toBeVisible();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByLabel("Start", { exact: true })).toHaveValue(
    "2026-09-15T09:00",
  );
  await page.getByLabel("Title", { exact: true }).fill("Month planning check");
  await page.getByRole("button", { name: "Create block", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await day.getByRole("button", { name: /Month planning check/ }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Edit block", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await auditAndCapture("calendar-day");
  await views.getByRole("link", { name: "Month", exact: true }).click();
  await expectMonthCount("2026-09-15", 1);
  await page.reload();
  await expectMonthCount("2026-09-15", 1);
  // A failed month row is never represented as an empty week.
  await page.route("**/api/v1/weeks/2026-10-05", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "UNAVAILABLE", message: "Could not load this week." },
      }),
    }),
  );
  await page.getByRole("link", { name: "Next month" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Could not load this week.",
  );
  await expect(month).toHaveCount(0);
  await page.unroute("**/api/v1/weeks/2026-10-05");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(month.locator(".month-day")).toHaveCount(35);
  await block(
    "Clock change reading",
    "2026-11-01T07:45:00Z",
    "2026-11-01T08:15:00Z",
  );
  await page.goto("/?date=2026-11-01");
  await expect(page.getByText("Clock change", { exact: true })).toBeVisible();
  await grid.getByRole("link", { name: "View day", exact: true }).click();
  await expect(
    day.getByRole("button", { name: /Clock change reading/ }),
  ).toContainText("1:45 AM MDT – 1:15 AM MST");
  await page.goto("/?date=2026-09-07");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByLabel("Start", { exact: true })).toHaveValue(
    "2026-09-07T09:00",
  );
  await page.getByLabel("Title", { exact: true }).fill("Keep this draft");
  await page.getByLabel("End", { exact: true }).fill("2026-09-07T08:00");
  await page.getByRole("button", { name: "Create block", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "End must be after start",
  );
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "Keep this draft",
  );
  await page.keyboard.press("Escape");

  // Quarter-hour placement, explicit resizing and duration-preserving moves.
  await views.getByRole("link", { name: "Day", exact: true }).click();
  await day
    .getByRole("button", {
      name: "Add block on 2026-09-07 at 14:00",
      exact: true,
    })
    .click({ position: { x: 20, y: 45 } });
  await expect(page.getByLabel("Start", { exact: true })).toHaveValue(
    "2026-09-07T14:30",
  );
  await expect(page.getByLabel("End", { exact: true })).toHaveValue(
    "2026-09-07T15:30",
  );
  await page.getByRole("button", { name: "30 min", exact: true }).click();
  await expect(page.getByLabel("End", { exact: true })).toHaveValue(
    "2026-09-07T15:00",
  );
  await page.getByLabel("Title", { exact: true }).fill("Quarter-hour plan");
  await page.getByText("More details", { exact: true }).click();
  await page.getByLabel("Category", { exact: true }).selectOption(category.id);
  await page.getByLabel("Goal (optional)").selectOption(goal.id);
  await page.getByLabel("Notes (optional)").fill("Bring the project draft.");
  await page.getByLabel("Start", { exact: true }).fill("2026-09-09T23:45");
  await expect(page.getByLabel("End", { exact: true })).toHaveValue(
    "2026-09-10T00:15",
  );
  await page.getByLabel("End", { exact: true }).fill("2026-09-10T00:30");
  await page.getByLabel("Start", { exact: true }).fill("2026-09-10T22:15");
  await expect(page.getByLabel("End", { exact: true })).toHaveValue(
    "2026-09-10T23:00",
  );
  await auditAndCapture("calendar-planning-form");
  await page.getByRole("button", { name: "Create block", exact: true }).click();
  await expect(page).toHaveURL(/date=2026-09-10.*view=day/);
  await day.getByRole("button", { name: /Quarter-hour plan.*planned/ }).click();
  await page.getByLabel("Start", { exact: true }).fill("2026-09-10T21:15");
  await expect(page.getByLabel("End", { exact: true })).toHaveValue(
    "2026-09-10T22:00",
  );
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const originWeek: Week = await (
    await page.request.get("/api/v1/weeks/2026-09-07")
  ).json();
  const original = originWeek.blocks.find(
    (block) => block.title === "Quarter-hour plan",
  )!;
  expect(original.startsAt).toBe("2026-09-11T03:15:00.000Z");
  const actual = await page.request.post("/api/v1/time-entries", {
    headers: headers(),
    data: {
      title: "Original recorded time",
      startsAt: original.startsAt,
      endsAt: original.endsAt,
      timeBlockId: original.id,
    },
  });
  expect(actual.status()).toBe(201);
  await page.reload();
  await day.getByRole("button", { name: /Quarter-hour plan.*planned/ }).click();
  await page.getByRole("button", { name: "Duplicate", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Duplicate block" }),
  ).toBeVisible();
  await expect(page.getByLabel("Start", { exact: true })).toHaveValue(
    "2026-09-11T21:15",
  );
  await expect(page.getByLabel("Category", { exact: true })).toHaveValue(
    category.id,
  );
  await expect(page.getByLabel("Goal (optional)")).toHaveValue(goal.id);
  await expect(page.getByLabel("Notes (optional)")).toHaveValue(
    "Bring the project draft.",
  );
  await expect(
    page.getByRole("heading", { name: "Linked recorded time" }),
  ).toHaveCount(0);
  const beforeCopy: Week = await (
    await page.request.get("/api/v1/weeks/2026-09-07")
  ).json();
  expect(beforeCopy.blocks).toHaveLength(originWeek.blocks.length);
  await page
    .getByLabel("Title", { exact: true })
    .fill("Copied quarter-hour plan");
  await page.getByLabel("Start", { exact: true }).fill("2026-09-21T07:15");
  await expect(page.getByLabel("End", { exact: true })).toHaveValue(
    "2026-09-21T08:00",
  );
  let lostCopy = false;
  await page.route("**/api/v1/time-blocks", async (route) => {
    if (route.request().method() === "POST" && !lostCopy) {
      lostCopy = true;
      expect(Object.keys(route.request().postDataJSON()).sort()).toEqual([
        "categoryId",
        "endsAt",
        "goalId",
        "notes",
        "startsAt",
        "title",
      ]);
      expect((await route.fetch()).status()).toBe(201);
      await route.abort("failed");
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Create block", exact: true }).click();
  await expect(page.getByLabel("Title", { exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Retry save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/date=2026-09-21.*view=day/);
  await expect(
    day.getByRole("button", { name: /Copied quarter-hour plan/ }),
  ).toHaveCount(1);
  const copiedWeek: Week = await (
    await page.request.get("/api/v1/weeks/2026-09-21")
  ).json();
  expect(copiedWeek.blocks).toHaveLength(1);
  expect(copiedWeek.entries).toHaveLength(0);
  expect(copiedWeek.blocks[0]).toMatchObject({
    title: "Copied quarter-hour plan",
    categoryId: category.id,
    goalId: goal.id,
    notes: original.notes,
  });
  expect(copiedWeek.blocks[0]!.id).not.toBe(original.id);
  const afterCopy: Week = await (
    await page.request.get("/api/v1/weeks/2026-09-07")
  ).json();
  expect(afterCopy.blocks.find((block) => block.id === original.id)).toEqual(
    original,
  );
  expect(
    afterCopy.entries.filter((entry) => entry.timeBlockId === original.id),
  ).toHaveLength(1);
  await day.getByRole("button", { name: /Copied quarter-hour plan/ }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete block", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    day.getByRole("button", { name: /Copied quarter-hour plan/ }),
  ).toHaveCount(0);

  // Date jumping and the live marker use the account timezone, not the browser zone.
  await page.getByRole("button", { name: /Jump to date,/ }).click();
  await page.getByLabel("Date", { exact: true }).fill("2026-12-31");
  await page.getByRole("button", { name: "Go to date" }).click();
  await expect(page).toHaveURL(/date=2026-12-31.*view=day/);
  await page.clock.setFixedTime(new Date("2026-09-21T19:20:00Z"));
  await page.goto("/?date=2026-09-07");
  const todayControl = page.getByRole("link", { name: "Today", exact: true });
  // The server clock is real; wait for the browser's injected clock after hydration.
  await expect(todayControl).toHaveAttribute(
    "href",
    "/?date=2026-09-21&view=week",
  );
  await todayControl.click();
  await expect(page).toHaveURL(/date=2026-09-21.*view=week/);
  await expect(
    grid.getByRole("img", { name: "Current time: 1:20 PM MDT" }),
  ).toBeInViewport();
  await auditAndCapture("calendar-current-time");
  const scroller = page.locator(".calendar-scroll");
  await scroller.evaluate((element) => {
    element.scrollTop = 850;
  });
  await expect
    .poll(() => scroller.evaluate((element) => element.scrollTop))
    .toBe(850);
  await views.getByRole("link", { name: "Month", exact: true }).click();
  await expect(month).toBeVisible();
  await views.getByRole("link", { name: "Week", exact: true }).click();
  await expect
    .poll(() => scroller.evaluate((element) => element.scrollTop))
    .toBe(850);
  await page.getByRole("link", { name: "Next week" }).click();
  await expect(page).toHaveURL(/date=2026-09-28/);
  await expect
    .poll(() => scroller.evaluate((element) => element.scrollTop))
    .toBe(850);
  await page.getByRole("link", { name: "Previous week" }).click();
  await expect(
    grid.getByRole("img", { name: "Current time: 1:20 PM MDT" }),
  ).toBeVisible();
  await page.clock.setFixedTime(new Date("2026-09-21T19:35:00Z"));
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await expect(
    grid.getByRole("img", { name: "Current time: 1:35 PM MDT" }),
  ).toBeVisible();
  await expect
    .poll(() => scroller.evaluate((element) => element.scrollTop))
    .toBe(850);
  await views.getByRole("link", { name: "Day", exact: true }).click();
  await expect
    .poll(() => scroller.evaluate((element) => element.scrollTop))
    .toBe(850);
  await expect(
    day.getByRole("img", { name: "Current time: 1:35 PM MDT" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Next day" }).click();
  await expect(page).toHaveURL(/date=2026-09-22/);
  await expect
    .poll(() => scroller.evaluate((element) => element.scrollTop))
    .toBe(850);
});
