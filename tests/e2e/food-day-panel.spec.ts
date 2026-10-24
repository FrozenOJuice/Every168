import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("Food keeps a shared Calendar day beside its workspace", async ({
  page,
}, info) => {
  const write = async (path: string, data: object, version?: number) => {
    const response = await page.request[version ? "put" : "post"](path, {
      headers: {
        Origin: "http://localhost:3100",
        "Idempotency-Key": randomUUID(),
        ...(version ? { "If-Match": `"${version}"` } : {}),
      },
      data,
    });
    expect(response.ok()).toBe(true);
    return response.json();
  };
  await write("/api/auth/sign-up/email", {
    name: "Food workspace",
    email: `food-day-${randomUUID()}@example.com`,
    password: "Synthetic-food-password-123",
  });
  const me = await (await page.request.get("/api/v1/me")).json();
  await write(
    "/api/v1/preferences",
    { timezone: "UTC", weekStartsOn: 1, weightUnit: "kg", distanceUnit: "km" },
    me.preferences.version,
  );
  const porridge = await write("/api/v1/foods", {
    name: "Porridge with blueberries",
    servingAmount: 1,
    servingUnit: "serving",
    calories: 320,
    proteinG: 14,
    carbsG: 48,
    fatG: 9,
    fiberG: 6,
    favourite: true,
  });
  const bowl = await write("/api/v1/foods", {
    name: "Chicken & rice bowl",
    servingAmount: 1,
    servingUnit: "serving",
    calories: 540,
    proteinG: 38,
    carbsG: 62,
    fatG: 16,
    fiberG: 8,
    favourite: true,
  });
  for (const [food, time, mealType] of [
    [porridge, "08:00", "breakfast"],
    [bowl, "12:30", "lunch"],
  ] as const)
    await write("/api/v1/food-entries", {
      foodId: food.id,
      quantity: 1,
      consumedAt: `2026-10-23T${time}:00Z`,
      mealType,
    });
  await write("/api/v1/water-entries", {
    amountMl: 500,
    consumedAt: "2026-10-23T09:30:00Z",
  });
  await write("/api/v1/weight-entries", {
    weightKg: 75,
    measuredAt: "2026-10-23T07:00:00Z",
  });
  await write("/api/v1/time-blocks", {
    title: "Evening walk",
    startsAt: "2026-10-23T17:00:00Z",
    endsAt: "2026-10-23T17:45:00Z",
  });
  await write("/api/v1/food-preparations", {
    name: "Weekend breakfast",
    kind: "recipe",
    ingredients: [{ foodId: porridge.id, quantity: 4 }],
    yieldServings: 4,
    instructions: "Warm gently and serve with fresh berries.",
  });
  await page.goto("/food?date=2026-10-23");
  const mobile = info.project.name !== "desktop";
  const main = page.locator(".food-main");
  await expect(main.getByText("860 kcal", { exact: true })).toBeVisible();
  await page.clock.install({ time: new Date("2026-10-23T14:00:00Z") });
  // Refresh the already-mounted day clock after changing the test time.
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: info.outputPath("food-workspace.png"),
    fullPage: true,
  });
  if (mobile)
    await page.getByRole("button", { name: "Day", exact: true }).click();
  const panel = mobile
    ? page.getByRole("dialog", { name: "Your day", exact: true })
    : page.getByRole("complementary", { name: "Food day panel" });
  await expect(
    panel.getByRole("button", { name: /Porridge with blueberries/ }),
  ).toBeVisible();
  await expect(panel.getByText("Evening walk", { exact: true })).toHaveCount(0);
  await panel
    .getByRole("button", { name: "All activities", exact: true })
    .click();
  await expect(
    panel.getByRole("button", { name: /Next.*Evening walk/ }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: info.outputPath("food-all-activities.png"),
    fullPage: true,
  });
  await panel
    .getByRole("button", { name: "October 23, 2026", exact: true })
    .click();
  const picker = page.getByRole("dialog", { name: "Choose day", exact: true });
  await expect(picker).toBeVisible();
  await picker
    .getByRole("button", { name: "Saturday, October 24, 2026", exact: true })
    .click();
  await expect(page).toHaveURL(/date=2026-10-24/);
  await expect(
    panel.getByText("No plans or activity for this day yet."),
  ).toBeVisible();
  await panel.getByRole("button", { name: "Today", exact: true }).click();
  await expect(page).toHaveURL(/date=2026-10-23/);
  // A Calendar food record opens its canonical entry, including on a phone.
  await panel
    .getByRole("button", { name: /Porridge with blueberries/ })
    .click();
  const editor = page.getByRole("dialog", {
    name: "Edit food entry",
    exact: true,
  });
  await expect(
    editor.getByRole("heading", {
      name: "Porridge with blueberries",
      exact: true,
    }),
  ).toBeVisible();
  await editor.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("navigation", { name: "Food navigation" })
    .getByRole("link", { name: "Recipes", exact: true })
    .click();
  await expect(
    main.getByRole("heading", { name: "Weekend breakfast", exact: true }),
  ).toBeVisible();
  if (!mobile)
    await expect(
      panel.getByRole("button", { name: /Porridge with blueberries/ }),
    ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("food-recipes.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  if (mobile)
    await page.getByRole("button", { name: "Day", exact: true }).click();
  await panel.getByRole("link", { name: "Open Calendar", exact: true }).click();
  await expect(page).toHaveURL(/\/?date=2026-10-23&view=day/);
  await expect(
    page.getByRole("region", { name: "Day activity", exact: true }),
  ).toBeVisible();
});
