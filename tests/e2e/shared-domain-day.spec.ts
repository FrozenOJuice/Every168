import { randomUUID } from "node:crypto";
import { expect, test, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.use({ actionTimeout: 10000 });
test("domains share a clean Day panel with consistent controls and recovered edits", async ({
  page,
}, info) => {
  const write = async (path: string, data: object, version?: number) => {
    const r = await page.request.post(`/api/v1/${path}`, {
      headers: {
        Origin: "http://localhost:3100",
        "Idempotency-Key": randomUUID(),
        ...(version ? { "If-Match": `"${version}"` } : {}),
      },
      data,
    });
    expect(r.ok()).toBe(true);
    return r.json();
  };
  await page.request.post("/api/__test/register", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      name: "Shared day",
      email: `day-${randomUUID()}@example.com`,
      password: "Synthetic-domain-password-123",
    },
  });
  const me = await (await page.request.get("/api/v1/me")).json();
  await page.request.put("/api/v1/preferences", {
    headers: {
      Origin: "http://localhost:3100",
      "Idempotency-Key": randomUUID(),
      "If-Match": `"${me.preferences.version}"`,
    },
    data: {
      timezone: "UTC",
      weekStartsOn: 1,
      weightUnit: "kg",
      distanceUnit: "km",
    },
  });
  const exercise = await write("exercises", {
    name: "Evening walk",
    loggingType: "duration",
  });
  const plan = await write("strength-plans", {
    title: "Evening walk",
    exercises: [
      { exerciseId: exercise.id, sets: [{ targetDurationSeconds: 1200 }] },
    ],
  });
  await write(
    `strength-plans/${plan.id}/schedule`,
    { startsAt: "2026-10-24T17:00:00Z", endsAt: "2026-10-24T18:00:00Z" },
    plan.version,
  );
  await write("time-blocks", {
    title: "Lunch with Alex",
    startsAt: "2026-10-24T12:00:00Z",
    endsAt: "2026-10-24T13:00:00Z",
  });
  await write("food-entries/quick", {
    food: { name: "Breakfast", servingAmount: 1, servingUnit: "serving" },
    quantity: 1,
    consumedAt: "2026-10-24T08:00:00Z",
  });
  await page.goto("/fitness?date=2026-10-24");
  await page
    .locator(".domain-day-panel .calendar-day-feed")
    .first()
    .waitFor({ state: "attached" });
  await page.clock.install({ time: new Date("2026-10-24T10:00:00Z") });
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  const mobile = info.project.name !== "desktop";
  const openDay = async (domain: string) => {
    await expect(
      page.getByRole("heading", { name: domain, exact: true }).first(),
    ).toBeAttached();
    if (mobile)
      await page.getByRole("button", { name: "Day", exact: true }).click();
    const surface = mobile
      ? page
          .getByRole("dialog", { name: "Your day", exact: true })
          .locator(".domain-day-panel")
      : page
          .getByRole("complementary", { name: `${domain} day panel` })
          .locator(".domain-day-panel");
    await expect(surface).toBeVisible();
    const frame = mobile
      ? page.getByRole("dialog", { name: "Your day", exact: true })
      : surface.locator("..");
    expect((await frame.boundingBox())!.width).toBeCloseTo(
      Math.min(350, page.viewportSize()!.width),
      0,
    );
    const viewportWidth = page.viewportSize()!.width;
    await expect(surface.locator(".domain-date-title")).toHaveCSS(
      "font-size",
      viewportWidth <= 360 ? "13px" : viewportWidth <= 700 ? "18px" : "20px",
    );
    return surface;
  };
  const closeDay = async () => {
    if (mobile)
      await page
        .getByRole("dialog", { name: "Your day", exact: true })
        .getByRole("button", { name: "Close dialog" })
        .click();
  };
  let panel = await openDay("Fitness");
  const dateButton = () =>
    panel.getByRole("button", { name: "October 24, 2026", exact: true });
  await expect(dateButton()).toBeVisible();
  await expect(
    panel.getByRole("heading", { name: "Your day", exact: true }),
  ).toHaveCount(0);
  await expect(
    panel.getByRole("link", { name: "Open full Calendar", exact: true }),
  ).toHaveCount(0);
  await expect(
    panel.getByRole("link", { name: "Open Calendar", exact: true }),
  ).toHaveCount(1);
  await expect(
    panel.getByText("Saturday, Oct 24", { exact: true }),
  ).toHaveCount(0);
  await expect(
    panel.getByRole("button", { name: "Today", exact: true }),
  ).toHaveClass("button");
  await expect(
    panel
      .getByRole("group", { name: "Choose a day", exact: true })
      .getByText("Tu", { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", { name: /Next.*Evening walk/ }),
  ).toBeVisible();
  await expect(panel.getByText("Lunch with Alex", { exact: true })).toHaveCount(
    0,
  );
  await expect(panel.getByText("Breakfast", { exact: true })).toHaveCount(0);
  await panel
    .getByRole("button", { name: "All activities", exact: true })
    .click();
  await expect(
    panel.getByRole("button", { name: /Next.*Lunch with Alex/ }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: info.outputPath("fitness-day-cleanup.png"),
    fullPage: true,
  });
  await panel.getByRole("button", { name: "Fitness", exact: true }).click();
  await panel.getByRole("button", { name: "Next day", exact: true }).click();
  await expect(
    panel.getByText("No Fitness plans or activity for this day.", {
      exact: true,
    }),
  ).toBeVisible();
  await panel.getByRole("button", { name: "Today", exact: true }).click();
  await expect(dateButton()).toBeVisible();
  await dateButton().click();
  const picker = page.getByRole("dialog", { name: "Choose day", exact: true });
  await expect(picker).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(picker).toHaveCount(0);
  await expect(dateButton()).toBeFocused();
  await dateButton().click();
  await picker
    .getByRole("button", { name: "Sunday, October 25, 2026", exact: true })
    .click();
  await expect(page).toHaveURL(/date=2026-10-25/);
  await closeDay();
  await navigation.getByRole("link", { name: "Tasks", exact: true }).click();
  panel = await openDay("Tasks");
  await expect(
    panel.getByRole("button", { name: "October 25, 2026", exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByText("No Tasks plans or activity for this day.", {
      exact: true,
    }),
  ).toBeVisible();
  await panel
    .getByRole("button", { name: "All activities", exact: true })
    .click();
  await expect(
    panel.getByText("No plans or activity for this day yet.", { exact: true }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await closeDay();
  await navigation.getByRole("link", { name: "Food", exact: true }).click();
  panel = await openDay("Food");
  await expect(
    panel.getByRole("button", { name: "October 25, 2026", exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByText("No Food plans or activity for this day.", { exact: true }),
  ).toBeVisible();
  const viewport = page.viewportSize()!;
  if (mobile) {
    await page.setViewportSize({ width: 320, height: viewport.height });
    await expect(panel.locator(".domain-date-title")).toHaveCSS(
      "font-size",
      "13px",
    );
    expect(
      (await page
        .getByRole("dialog", { name: "Your day", exact: true })
        .boundingBox())!.width,
    ).toBe(320);
    await page.screenshot({ path: info.outputPath("shared-day-320.png") });
  }
  const dateAppearance = (locator: Locator) =>
    locator.evaluate((element) => {
      const style = getComputedStyle(element);
      return [
        style.fontFamily,
        style.fontSize,
        style.fontWeight,
        style.padding,
        style.borderRadius,
        style.minHeight,
      ];
    });
  const domainDateStyle = await dateAppearance(
    panel.locator(".domain-date-title"),
  );
  const sharedStyle = await panel
    .getByRole("button", { name: "Today", exact: true })
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return [
        style.backgroundColor,
        style.borderColor,
        style.borderRadius,
        style.minHeight,
      ];
    });
  await panel.getByRole("link", { name: "Open Calendar", exact: true }).click();
  await expect(page).toHaveURL(/date=2026-10-25&view=day/);
  const calendarStyle = await page
    .getByRole("link", { name: "Today", exact: true })
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return [
        style.backgroundColor,
        style.borderColor,
        style.borderRadius,
        style.minHeight,
      ];
    });
  expect(sharedStyle).toEqual(calendarStyle);
  expect(await dateAppearance(page.locator(".calendar-date-title"))).toEqual(
    domainDateStyle,
  );
  if (!mobile)
    expect(
      (await page
        .locator(".calendar-day-layout > .calendar-day-feed")
        .boundingBox())!.width,
    ).toBe(350);
  if (mobile) await page.setViewportSize(viewport);
  await navigation.getByRole("link", { name: "Fitness", exact: true }).click();
  panel = await openDay("Fitness");
  await panel.getByRole("button", { name: "Today", exact: true }).click();
  await expect(dateButton()).toBeVisible();
  await closeDay();
  await page.getByRole("link", { name: "Create program", exact: true }).click();
  await page
    .getByLabel("Program name", { exact: true })
    .fill("Unsaved program");
  panel = await openDay("Fitness");
  await panel.getByRole("button", { name: /Next.*Evening walk/ }).dblclick();
  const planEditor = page.getByRole("dialog", {
    name: "Edit plan",
    exact: true,
  });
  await expect(planEditor).toBeVisible();
  await planEditor
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await closeDay();
  await expect(page.getByLabel("Program name", { exact: true })).toHaveValue(
    "Unsaved program",
  );
  panel = await openDay("Fitness");
  await panel.getByRole("link", { name: "Open Calendar", exact: true }).click();
  await expect(page).toHaveURL(/date=2026-10-24&view=day/);
  await page.goBack();
  await expect(page.getByLabel("Program name", { exact: true })).toHaveValue(
    "Unsaved program",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
