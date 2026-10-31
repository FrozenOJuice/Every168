import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.use({ actionTimeout: 10000 });
test("History shows actual session context, retains loaded results and restores browsing after a summary", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const write = async (
    path: string,
    data: object,
    method: "post" | "put" = "post",
    version = 1,
  ) => {
    const response = await page.request[method](path, {
      headers: {
        Origin: "http://localhost:3100",
        "Idempotency-Key": randomUUID(),
        "If-Match": `"${version}"`,
      },
      data,
    });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  };
  await write("/api/__test/register", {
    name: "History list",
    email: `history-list-${randomUUID()}@example.com`,
    password: "Synthetic-history-password-123",
  });
  const me = await (await page.request.get("/api/v1/me")).json();
  await write(
    "/api/v1/preferences",
    {
      timezone: "America/Edmonton",
      weekStartsOn: 1,
      weightUnit: "kg",
      distanceUnit: "km",
    },
    "put",
    me.preferences.version,
  );
  const exercise = await write("/api/v1/exercises", {
    name: "Bench press",
    loggingType: "reps_load",
  });
  for (let n = 0; n < 12; n++) {
    const startedAt =
      n === 0
        ? "2026-10-29T00:30:00Z"
        : `2026-10-${String(28 - Math.floor(n / 3)).padStart(2, "0")}T${["18", "12", "09"][n % 3]}:00:00Z`;
    const session = await write("/api/v1/strength-workouts", {
      title: [
        "Leg day - Strength and mobility",
        "Leg day",
        "Leg day - Recovery",
      ][n % 3],
      startedAt,
    });
    await write(
      `/api/v1/strength-workouts/${session.id}`,
      {
        title: session.title,
        startedAt,
        endedAt: new Date(
          Date.parse(startedAt) + 2700000 + (n === 0 ? 24474 : 0),
        ).toISOString(),
        exercises: [
          {
            exerciseId: exercise.id,
            sets: [
              { reps: 12, weightKg: 50, completed: true },
              { reps: 999, weightKg: 999, completed: false, skipped: true },
              { reps: 888, weightKg: 888, completed: false },
            ],
          },
        ],
      },
      "put",
      session.version,
    );
  }
  await write("/api/v1/strength-workouts", {
    title: "Active mobility",
    startedAt: "2026-10-29T18:00:00Z",
  });
  await page.goto("/fitness/history");
  const rows = page.locator(".fitness-history-item");
  await expect(rows).toHaveCount(10);
  await expect(
    page.getByRole("button", { name: "Workout status", exact: true }),
  ).toHaveCount(0);
  await expect(rows.first()).toContainText("1 exercise · 1 completed set");
  await expect(
    rows.first().locator(".fitness-history-timing > span"),
  ).toHaveText("45m 24s");
  await expect(rows.first().locator("time")).toHaveText("6:30 PM");
  await expect(rows.nth(1).locator("time")).toHaveText("6:00 AM");
  await expect(page.locator(".fitness-history-day")).toHaveCount(4);
  await expect(
    page.getByRole("heading", { name: "Wednesday, Oct 28, 2026", exact: true }),
  ).toHaveCount(1);
  await expect(
    page
      .getByRole("region", { name: "Workout history", exact: true })
      .getByText("Active mobility", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Weekly totals", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Weekly totals", exact: true }),
  ).toBeVisible();
  const search = page.getByRole("searchbox", {
    name: "Search workouts",
    exact: true,
  });
  const searchBox = (await search.boundingBox())!;
  const listBox = (await page
    .locator(".fitness-history-groups")
    .boundingBox())!;
  expect(searchBox.width).toBeCloseTo(listBox.width, 0);
  await search.fill("Nothing matches");
  await expect(
    page.getByText("No workouts match your search.", { exact: true }),
  ).toBeVisible();
  await search.fill("Leg day");
  await expect(rows).toHaveCount(10);
  let fail = true;
  await page.route("**/api/v1/strength-workouts?**", async (route) => {
    if (new URL(route.request().url()).searchParams.has("cursor") && fail)
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "UNAVAILABLE", message: "History unavailable." },
        }),
      });
    else await route.continue();
  });
  await page
    .getByRole("button", { name: "Load older workouts", exact: true })
    .click();
  await expect(
    page.getByText("Couldn’t load older workouts.", { exact: true }),
  ).toBeVisible();
  await expect(rows).toHaveCount(10);
  fail = false;
  await page
    .getByRole("button", { name: "Retry loading workouts", exact: true })
    .click();
  await expect(rows).toHaveCount(12);
  await expect(page.locator(".fitness-history-day")).toHaveCount(4);
  const lastId = await rows.last().getAttribute("data-session-id");
  await rows.last().scrollIntoViewIfNeeded();
  const scroll = await page.evaluate(() => window.scrollY);
  await rows.last().click();
  await expect(page).toHaveURL(/returnHistory=/);
  await page.reload();
  await expect(
    page.getByRole("link", { name: "Back to History", exact: true }),
  ).toHaveCSS("font-weight", "600");
  await page
    .getByRole("link", { name: "Back to History", exact: true })
    .click();
  await expect(search).toHaveValue("Leg day");
  await expect(rows).toHaveCount(12);
  await expect(page.locator(`[data-session-id="${lastId}"]`)).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBeCloseTo(scroll, -1);
  await expect(page.locator(".fitness-week-totals")).toBeVisible();
  const weeklyBox = (await page
    .getByRole("region", { name: "Weekly totals", exact: true })
    .boundingBox())!;
  expect(weeklyBox.y).toBeGreaterThan((await rows.last().boundingBox())!.y);
  await page
    .getByRole("button", { name: "Previous week", exact: true })
    .click();
  await expect(page).toHaveURL(/search=Leg\+day.*date=/);
  await expect(search).toHaveValue("Leg day");
  await expect(
    page.getByRole("button", { name: "Choose week", exact: true }),
  ).toHaveText("Oct 19 - 25, 2026");
  const totals = page.locator(".fitness-week-totals");
  await expect(
    totals.locator("div").filter({ hasText: "Workout time" }).locator("dd"),
  ).toHaveText("2h 15m");
  await expect(page.getByText("Weight volume", { exact: true })).toHaveCount(0);
  await expect(
    page.locator(".fitness-history-weekly .fitness-progress-metrics"),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Choose week", exact: true }).click();
  await expect(page.locator(".calendar-date-picker")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Choose week", exact: true }),
  ).toBeFocused();
  if (info.project.name === "phone")
    await page.setViewportSize({ width: 320, height: 844 });
  const toolbar = (await page.locator(".fitness-week-toolbar").boundingBox())!;
  const thisWeek = (await page
    .getByRole("button", { name: "This week", exact: true })
    .boundingBox())!;
  expect(thisWeek.x + thisWeek.width).toBeLessThanOrEqual(toolbar.x);
  expect(thisWeek.y + thisWeek.height / 2).toBeCloseTo(
    toolbar.y + toolbar.height / 2,
    0,
  );
  const weekHeading = (await page
    .locator(".fitness-week-heading")
    .boundingBox())!;
  expect(toolbar.x + toolbar.width).toBeCloseTo(
    weekHeading.x + weekHeading.width,
    0,
  );

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: info.outputPath("history-weekly.png"),
    fullPage: true,
  });
  await page
    .getByRole("heading", { name: "Workout history", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("history-list.png") });
  await page.goto("/fitness/history?date=2026-10-26");
  await expect(
    page.getByRole("button", { name: "Choose week", exact: true }),
  ).toHaveText("Oct 26 - Nov 1, 2026");
  await page.goto("/fitness/history?date=2026-12-28");
  await expect(
    page.getByRole("button", { name: "Choose week", exact: true }),
  ).toHaveText("Dec 28, 2026 - Jan 3, 2027");
  await expect(
    page.getByText("No finished workouts this week.", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".fitness-week-totals")).toHaveCount(0);
});
