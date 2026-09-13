import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type {
  FoodEntry,
  NutritionDaily,
  WaterDaily,
  WeightReview,
} from "@168hours/contracts";

test("a day of food, water and weight can be logged, corrected and reviewed", async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  if (testInfo.project.name === "desktop")
    await page.setViewportSize({ width: 1440, height: 1100 });
  const headers = (version?: number) => ({
    Origin: "http://localhost:3100",
    "Idempotency-Key": randomUUID(),
    ...(version ? { "If-Match": `"${version}"` } : {}),
  });
  expect(
    (
      await page.request.post("/api/auth/sign-up/email", {
        headers: headers(),
        data: {
          name: "Food slice",
          email: `food-${randomUUID()}@example.com`,
          password: "Synthetic-food-password-123",
        },
      })
    ).status(),
  ).toBe(200);
  const me = await (await page.request.get("/api/v1/me")).json();
  expect(
    (
      await page.request.put("/api/v1/preferences", {
        headers: headers(me.preferences.version),
        data: {
          timezone: "America/Edmonton",
          weekStartsOn: 1,
          weightUnit: "lb",
          distanceUnit: "km",
        },
      })
    ).status(),
  ).toBe(200);
  const date = "2026-09-12";
  await page.goto("/food?date=" + date);
  await expect(page).toHaveTitle("168Hours");
  const dialog = page.getByRole("dialog");
  const water = page.getByRole("region", { name: "Water", exact: true });
  const weight = page.getByRole("region", { name: "Weight", exact: true });
  const totals = page.getByRole("region", {
    name: "Daily nutrition",
    exact: true,
  });
  async function close() {
    await dialog
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
  }
  async function audit(name: string) {
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      if (
        !document.querySelector("dialog[open]") &&
        document.activeElement instanceof HTMLElement
      )
        document.activeElement.blur();
    });
    await page.screenshot({
      path: testInfo.outputPath(name + ".png"),
      fullPage: true,
    });
  }
  await expect(water.getByText("Not logged", { exact: true })).toBeVisible();
  await expect(weight.getByText("Not logged", { exact: true })).toBeVisible();
  await audit("food-empty");

  // A first-time user can create a definition without abandoning the logging flow.
  await page
    .getByRole("button", { name: "Add breakfast", exact: true })
    .click();
  await expect(page.getByLabel("Meal", { exact: true })).toHaveValue(
    "breakfast",
  );
  await page
    .getByRole("button", { name: "Create a food", exact: true })
    .click();
  await expect(page.getByLabel("Calories per serving (kcal)")).toHaveValue("");
  await page.getByLabel("Food name").fill("Label oats");
  await page.getByLabel("Serving amount", { exact: true }).fill("40");
  await page.getByLabel("Calories per serving (kcal)").fill("150");
  await page.getByLabel("Protein per serving (g)").fill("5");
  await page.getByLabel("Fat per serving (g)", { exact: true }).fill("0");
  await page.getByRole("button", { name: "Create food", exact: true }).click();
  await expect(dialog).toHaveAccessibleName("Log food");
  await expect(page.getByLabel("Saved food")).toHaveValue(/.+/);
  await expect(page.getByLabel("Meal", { exact: true })).toHaveValue(
    "breakfast",
  );
  await page.getByLabel("Quantity (servings)").fill("1.5");
  await page.getByLabel("Eaten at").fill(date + "T08:00");
  await audit("food-serving-form");
  const foodKeys: string[] = [];
  await page.route("**/api/v1/food-entries", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    foodKeys.push(route.request().headers()["idempotency-key"]!);
    const response = await route.fetch();
    if (foodKeys.length === 1) await route.abort("failed");
    else await route.fulfill({ response });
  });
  await dialog.getByRole("button", { name: "Log food", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Retry save", exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Retry save", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(foodKeys).toHaveLength(2);
  expect(foodKeys[1]).toBe(foodKeys[0]);
  await page.unroute("**/api/v1/food-entries");
  await expect(totals.getByText("225 kcal", { exact: true })).toBeVisible();
  await expect(totals.getByText(/unknown from 1 item/).first()).toBeVisible();
  const getDay = async (date: string): Promise<NutritionDaily> =>
    (await page.request.get("/api/v1/nutrition/daily?date=" + date)).json();
  const entry = (await getDay(date)).entries[0]!;
  expect((await getDay(date)).entries).toHaveLength(1);

  // Library updates affect future saved-food logs; old and repeated entries use snapshots.
  await page.getByRole("button", { name: "Food library", exact: true }).click();
  await expect(page).toHaveURL(/tab=library/);
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Calories per serving (kcal)").fill("200");
  await page.getByRole("button", { name: "Save food", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  page.once("dialog", (confirmation) => confirmation.accept());
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await page.getByLabel("Show archived").check();
  await expect(
    page.getByRole("button", { name: "Restore", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Restore", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Daily log", exact: true }).click();
  await expect(totals.getByText("225 kcal", { exact: true })).toBeVisible();

  const breakfast = page.getByRole("region", {
    name: "breakfast",
    exact: true,
  });
  await breakfast.getByRole("button", { name: "Edit", exact: true }).click();
  const elsewhere = await page.request.put("/api/v1/food-entries/" + entry.id, {
    headers: headers(entry.version),
    data: { quantity: 3, mealType: "breakfast", consumedAt: entry.consumedAt },
  });
  expect(elsewhere.status()).toBe(200);
  await page.getByLabel("Quantity (servings)").fill("2");
  await dialog.getByRole("button", { name: "Save entry", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Reload latest (discard edits)" }),
  ).toBeVisible();
  await expect(page.getByLabel("Quantity (servings)")).toHaveValue("2");
  await close();
  await page.reload();
  await breakfast.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Quantity (servings)").fill("2");
  await page.getByLabel("Eaten at").fill("2026-09-13T08:00");
  await dialog.getByRole("button", { name: "Save entry", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByLabel("Log date", { exact: true })).toHaveValue(
    "2026-09-13",
  );
  await expect(totals.getByText("300 kcal", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Previous day", exact: true }).click();
  await page.getByRole("button", { name: "Recent food", exact: true }).click();
  await page.getByLabel("Search food history").fill("Label oats");
  await dialog.getByRole("button", { name: "Log again", exact: true }).click();
  await expect(page.getByLabel("Eaten at")).toHaveValue(
    new RegExp("^" + date + "T"),
  );
  await page.getByLabel("Quantity (servings)").fill("0.5");
  await page.getByLabel("Meal", { exact: true }).selectOption("snack");
  await dialog.getByRole("button", { name: "Log food", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(totals.getByText("75 kcal", { exact: true })).toBeVisible();
  expect((await getDay(date)).entries[0]?.caloriesSnapshot).toBe(150);

  // Direct hydration shortcuts retain the original intent after a lost response.
  const jumps = page.getByRole("navigation", { name: "Daily log sections" });
  if (await jumps.isVisible()) {
    await jumps.getByRole("link", { name: "Water", exact: true }).click();
    const bounds = (await water
      .getByRole("button", { name: "+ 250 ml", exact: true })
      .boundingBox())!;
    expect(bounds.y).toBeGreaterThanOrEqual(64);
    expect(bounds.y + bounds.height).toBeLessThan(page.viewportSize()!.height);
  }
  await water.getByRole("button", { name: "+ 250 ml", exact: true }).click();
  await expect(water.locator(".measurement-total")).toContainText("250 ml");
  const waterKeys: string[] = [];
  await page.route("**/api/v1/water-entries", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    waterKeys.push(route.request().headers()["idempotency-key"]!);
    const response = await route.fetch();
    if (waterKeys.length === 1) await route.abort("failed");
    else await route.fulfill({ response });
  });
  await water.getByRole("button", { name: "+ 500 ml", exact: true }).click();
  await water
    .getByRole("button", { name: "Retry same change", exact: true })
    .click();
  await expect(water.locator(".measurement-total")).toContainText("750 ml");
  expect(waterKeys).toHaveLength(2);
  expect(waterKeys[1]).toBe(waterKeys[0]);
  await page.unroute("**/api/v1/water-entries");
  const getWater = async (): Promise<WaterDaily> =>
    (await page.request.get("/api/v1/hydration/daily?date=" + date)).json();
  expect((await getWater()).count).toBe(2);
  await water
    .getByRole("button", { name: "Edit", exact: true })
    .first()
    .click();
  await page.getByLabel("Water (ml)").fill("0.5");
  await dialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(page.getByLabel("Water (ml)")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.getByLabel("Water (ml)").fill("300");
  await dialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await water
    .getByRole("button", { name: "Water history", exact: true })
    .click();
  await expect(dialog.getByRole("listitem")).toHaveCount(2);
  await close();

  await weight.getByRole("button", { name: "Log weight", exact: true }).click();
  await page.getByLabel("Weight (lb)").fill("150");
  await page.getByLabel("Measured at").fill(date + "T07:00");
  await dialog.getByRole("button", { name: "Log weight", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(weight.locator(".measurement-total")).toContainText("150 lb");
  const getWeight = async (): Promise<WeightReview> =>
    (await page.request.get("/api/v1/body/weight-review?date=" + date)).json();
  expect((await getWeight()).latest?.weightKg).toBeCloseTo(68.0388555, 6);
  await weight.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Weight (lb)").fill("151");
  await dialog
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(weight.locator(".measurement-total")).toContainText("151 lb");
  await weight
    .getByRole("button", { name: "Weight history", exact: true })
    .click();
  await expect(dialog.getByRole("listitem")).toHaveCount(1);
  await close();
  await audit("food-populated");

  // Query failures remain distinct from empty logs and can recover without navigation.
  await page.route("**/api/v1/nutrition/daily?date=2026-09-11", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "NOT_READY", message: "Temporarily unavailable." },
      }),
    }),
  );
  await page.getByRole("link", { name: "Previous day", exact: true }).click();
  await expect(
    page.getByText("Temporarily unavailable.", { exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/v1/nutrition/daily?date=2026-09-11");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    totals.getByText("No food logged for this day yet."),
  ).toBeVisible();
  await expect(weight.locator(".measurement-total")).toContainText(
    "Not logged",
  );
  await page.getByRole("link", { name: "Next day", exact: true }).click();
  await expect(totals.getByText("75 kcal", { exact: true })).toBeVisible();
  if (testInfo.project.name === "desktop") {
    await page.setViewportSize({ width: 320, height: 740 });
    await audit("food-small-phone");
  }
  page.once("dialog", (confirmation) => confirmation.accept());
  await weight.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(weight.locator(".measurement-total")).toContainText(
    "Not logged",
  );
  page.once("dialog", (confirmation) => confirmation.accept());
  await page
    .getByRole("region", { name: "snack", exact: true })
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect(
    totals.getByText("No food logged for this day yet."),
  ).toBeVisible();
  const stored: FoodEntry = (await getDay("2026-09-13")).entries[0]!;
  expect(stored.quantity).toBe(2);
});
