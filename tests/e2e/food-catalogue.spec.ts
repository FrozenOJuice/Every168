import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { foodView } from "./helpers/food-navigation";
async function setup(page: Page) {
  const result = await page.request.post("/api/__test/register", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      name: "Food Phase 1",
      email: `food-v1-${randomUUID()}@example.com`,
      password: "Synthetic-food-v1-password-123",
    },
  });
  expect(result.ok()).toBe(true);
  await page.goto("/food?date=2026-11-03");
}
test("Today shows empty nutrition, optional targets and directly logged catalogue grams", async ({
  page,
}, info) => {
  if (info.project.name === "phone")
    await page.setViewportSize({ width: 320, height: 740 });
  await setup(page);
  const summary = page.getByRole("region", {
    name: "Daily nutrition",
    exact: true,
  });
  await expect(summary).toContainText("0 kcal");
  await expect(summary).toContainText("Target not set");
  await page
    .getByRole("link", { name: "Edit nutrition targets", exact: true })
    .click();
  const goals = page.getByRole("region", {
    name: "Nutrition targets",
    exact: true,
  });
  await goals.getByLabel("Calories (kcal)", { exact: true }).fill("2000");
  await goals.getByLabel("Protein (g)", { exact: true }).fill("100");
  await goals
    .getByRole("button", { name: "Save nutrition targets", exact: true })
    .click();
  await expect(goals).toHaveCount(0);
  await expect(summary).toContainText("Target 2,000 kcal");
  await expect(summary.getByRole("progressbar")).toHaveCount(2);
  await page.getByRole("button", { name: "Log food", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Log food", exact: true });
  await dialog
    .getByLabel("Find food, meals or recipes", { exact: true })
    .fill("cheese souffle");
  await dialog
    .getByRole("button", { name: "Review Cheese souffle", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Use food", exact: true }).click();
  await dialog.getByLabel("Amount eaten", { exact: true }).fill("50");
  await dialog.getByRole("button", { name: "Log food", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const entries = await (await page.request.get("/api/v1/food-entries")).json();
  expect(entries.items).toHaveLength(1);
  expect(entries.items[0]).toMatchObject({
    foodId: null,
    quantity: 0.5,
    caloriesSnapshot: 204,
    sourceSnapshot: { code: "2" },
  });
  expect(
    (await (await page.request.get("/api/v1/foods")).json()).items,
  ).toHaveLength(0);
  await expect(summary).toContainText("102 kcal");
  await page.getByRole("button", { name: "Edit entry", exact: true }).click();
  const correction = page.getByRole("dialog", {
    name: "Edit food entry",
    exact: true,
  });
  await expect(
    correction.getByLabel("Amount eaten (g)", { exact: true }),
  ).toHaveValue("50");
  await correction.getByLabel("Amount eaten (g)", { exact: true }).fill("75");
  await correction
    .getByRole("button", { name: "Save entry", exact: true })
    .click();
  await expect(correction).toHaveCount(0);
  await expect(summary).toContainText("153 kcal");

  await expect(
    page.getByRole("region", { name: "Breakfast", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("group", { name: "Food log date", exact: true }),
  ).toHaveCount(0);
  await expect(page).toHaveTitle("Every168");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: info.outputPath("food-today.png"),
    fullPage: info.project.name !== "phone",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("catalogue source portions scale correctly in logging and retained recipe drafts", async ({
  page,
}) => {
  await setup(page);
  await foodView(page, "Recipes");
  await page
    .getByRole("button", { name: "Create recipe", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Create recipe",
    exact: true,
  });
  await dialog
    .getByLabel("Recipe name", { exact: true })
    .fill("Shared catalogue recipe");
  await dialog
    .getByLabel("Find a food", { exact: true })
    .fill("cheese souffle");
  await dialog
    .getByRole("button", { name: "Review Cheese souffle", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Use food", exact: true }).click();
  await dialog
    .getByLabel("Amount of Cheese souffle · 100 g", { exact: true })
    .fill("2");
  await dialog
    .getByLabel("Unit for ingredient 1", { exact: true })
    .selectOption("415");
  await dialog.getByLabel("Recipe yield (portions)", { exact: true }).fill("4");
  await dialog.getByText("Add ingredient", { exact: true }).click();
  await dialog.getByLabel("Find a food", { exact: true }).fill("oats");
  await dialog.getByLabel("Find a food", { exact: true }).press("Enter");
  await expect(dialog.getByLabel("Recipe name", { exact: true })).toHaveValue(
    "Shared catalogue recipe",
  );

  await dialog
    .getByRole("button", { name: "Create recipe", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  const recipe = (
    await (await page.request.get("/api/v1/foods?kind=recipe")).json()
  ).items[0];
  expect(recipe.calories).toBeCloseTo(102.3876);
  expect(recipe.ingredients[0]).toMatchObject({
    foodId: null,
    quantity: 2.0076,
    source: { code: "2" },
  });
  await foodView(page, "Today");
  await page.getByRole("button", { name: "Log food", exact: true }).click();
  const log = page.getByRole("dialog", { name: "Log food", exact: true });
  await log
    .getByLabel("Find food, meals or recipes", { exact: true })
    .fill("cheese souffle");
  await log
    .getByRole("button", { name: "Review Cheese souffle", exact: true })
    .click();
  await log.getByRole("button", { name: "Use food", exact: true }).click();
  await log.getByLabel("Amount eaten", { exact: true }).fill("1");
  await log.getByLabel("Amount unit", { exact: true }).selectOption("341");
  await log.getByRole("button", { name: "Log food", exact: true }).click();
  await expect(log).toHaveCount(0);
  const entries = (
    await (await page.request.get("/api/v1/food-entries")).json()
  ).items;
  expect(entries[0].quantity).toBeCloseTo(0.40152);
});
test("uncertain target saves recover exactly once with their original revision", async ({
  page,
}) => {
  await setup(page);
  const keys: string[] = [];
  await page.route("**/api/v1/nutrition-goals", async (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    keys.push(route.request().headers()["idempotency-key"]!);
    const response = await route.fetch();
    expect(response.status()).toBe(200);
    if (keys.length === 1)
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "UNAVAILABLE", message: "Response lost after commit" },
        }),
      });
    else await route.fulfill({ response });
  });
  await page
    .getByRole("link", { name: "Edit nutrition targets", exact: true })
    .click();
  const dialog = page.getByRole("region", {
    name: "Nutrition targets",
    exact: true,
  });
  await dialog.getByLabel("Carbohydrates (g)", { exact: true }).fill("250");
  await dialog
    .getByRole("button", { name: "Save nutrition targets", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Retry save", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await page
    .getByRole("button", { name: "Retry saved change", exact: true })
    .click();
  await expect(
    page.getByRole("alert", { name: "Food save recovery", exact: true }),
  ).toHaveCount(0);
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  const goals = await (
    await page.request.get("/api/v1/nutrition-goals")
  ).json();
  expect(goals).toMatchObject({ version: 2, carbsG: 250, calories: null });
});
