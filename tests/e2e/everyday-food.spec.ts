import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function setup(page: Page) {
  const headers = (version?: number) => ({
    Origin: "http://localhost:3100",
    "Idempotency-Key": randomUUID(),
    ...(version ? { "If-Match": `"${version}"` } : {}),
  });
  const write = async (
    path: string,
    data: object,
    version?: number,
    method: "post" | "put" = "post",
  ) => {
    const response = await page.request[method](path, {
      headers: headers(version),
      data,
    });
    expect(response.ok()).toBe(true);
    return response.json();
  };
  await write("/api/auth/sign-up/email", {
    name: "Everyday Food",
    email: `food-${randomUUID()}@example.com`,
    password: "Synthetic-food-password-123",
  });
  const me = await (await page.request.get("/api/v1/me")).json();
  await write(
    "/api/v1/preferences",
    { timezone: "UTC", weekStartsOn: 1, weightUnit: "kg", distanceUnit: "km" },
    me.preferences.version,
    "put",
  );
  await page.goto("/food?date=2026-10-23");
  return { write };
}
async function view(page: Page, name: string) {
  await page
    .getByRole("navigation", { name: "Food navigation" })
    .getByRole("link", { name, exact: true })
    .click();
}
const dialog = (page: Page) => page.getByRole("dialog");

test("create food, recipe and saved meal, adjust a logged meal and retain historical nutrition", async ({
  page,
}, info) => {
  await setup(page);
  await view(page, "Food library");
  await page.getByRole("button", { name: "Create food", exact: true }).click();
  await dialog(page).getByLabel("Food name", { exact: true }).fill("Rice");
  await dialog(page).getByLabel("Calories (kcal)", { exact: true }).fill("100");
  await dialog(page).getByLabel("Fat (g)", { exact: true }).fill("0");
  await dialog(page)
    .getByRole("button", { name: "Create food", exact: true })
    .click();
  await expect(dialog(page)).toHaveCount(0);
  await view(page, "Recipes");
  await page
    .getByRole("button", { name: "Create recipe", exact: true })
    .click();
  await dialog(page)
    .getByLabel("Recipe name", { exact: true })
    .fill("Rice pot");
  await dialog(page)
    .getByRole("button", { name: /Rice.*100 g/ })
    .click();
  await dialog(page)
    .getByLabel("Servings of Rice · 100 g", { exact: true })
    .fill("5");
  await dialog(page)
    .getByLabel("Recipe yield (portions)", { exact: true })
    .fill("2");
  await dialog(page)
    .getByLabel("Instructions (optional)", { exact: true })
    .fill("Cook, then divide into two portions.");
  await dialog(page)
    .getByRole("button", { name: "Create recipe", exact: true })
    .click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(
    page.getByText("250 kcal per serving", { exact: true }),
  ).toBeVisible();
  await view(page, "Saved meals");
  await page.getByRole("button", { name: "Create meal", exact: true }).click();
  await dialog(page)
    .getByLabel("Meal name", { exact: true })
    .fill("Rice lunch");
  await dialog(page)
    .getByRole("button", { name: /Rice pot.*1 serving/ })
    .click();
  await dialog(page)
    .getByLabel("Servings of Rice pot · 1 serving", { exact: true })
    .fill("0.5");
  await dialog(page).getByText("Add ingredient", { exact: true }).click();
  await dialog(page)
    .getByRole("button", { name: /^Rice.*100 g/ })
    .click();
  await dialog(page)
    .getByRole("button", { name: "Save meal", exact: true })
    .click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(
    page.getByText("225 kcal per serving", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Favourite Rice lunch", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Favourite Rice lunch", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Log meal", exact: true }).click();
  await dialog(page)
    .getByLabel("Eaten at", { exact: true })
    .fill("2026-10-23T12:00");
  await dialog(page)
    .getByLabel("Meal label (optional)", { exact: true })
    .selectOption("lunch");
  await dialog(page)
    .getByText("Adjust ingredient amounts for this entry", { exact: true })
    .click();
  await dialog(page)
    .getByLabel("Servings of Rice pot (1 serving each)", { exact: true })
    .fill("1");
  await dialog(page)
    .getByRole("button", { name: "Log food", exact: true })
    .click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Rice lunch", exact: true }),
  ).toBeVisible();
  const totals = page.locator(".food-daily-grid > div > section > details");
  await expect(totals).toContainText("350 kcal");
  await expect(totals).toContainText("0 g");
  await view(page, "Food library");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await dialog(page).getByLabel("Calories (kcal)", { exact: true }).fill("200");
  await dialog(page)
    .getByRole("button", { name: "Save food", exact: true })
    .click();
  await expect(dialog(page)).toHaveCount(0);
  await view(page, "Daily log");
  await expect(totals).toContainText("350 kcal");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("food-day.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Copy entry", exact: true }).click();
  await dialog(page)
    .getByLabel("Number of servings (1 serving each)", { exact: true })
    .fill("2");
  await dialog(page)
    .getByLabel("Eaten at", { exact: true })
    .fill("2026-10-24T12:00");
  await dialog(page)
    .getByRole("button", { name: "Log food", exact: true })
    .click();
  await expect(page).toHaveURL(/date=2026-10-24/);
  await expect(totals).toContainText("700 kcal");
  await page.getByRole("button", { name: "Edit entry", exact: true }).click();
  await dialog(page)
    .getByLabel("Number of servings (1 serving each)", { exact: true })
    .fill("0.5");
  await dialog(page)
    .getByRole("button", { name: "Save entry", exact: true })
    .click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(totals).toContainText("175 kcal");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete entry", exact: true }).click();
  await expect(
    page.getByText("No food recorded for this day.", { exact: true }),
  ).toBeVisible();
});

test("quick entries, unknown nutrition, water and weight, history and archive are usable", async ({
  page,
}, info) => {
  const { write } = await setup(page);
  await write("/api/v1/foods", {
    name: "Coffee",
    servingAmount: 1,
    servingUnit: "item",
    calories: 0,
  });
  await page.getByRole("button", { name: "Log food", exact: true }).click();
  await dialog(page)
    .getByRole("button", { name: "Quick entry", exact: true })
    .click();
  await dialog(page)
    .getByLabel("Food name", { exact: true })
    .fill("Restaurant dinner");
  await dialog(page)
    .getByLabel("Eaten at", { exact: true })
    .fill("2026-10-23T18:00");
  await dialog(page)
    .getByRole("button", { name: "Log food", exact: true })
    .click();
  await expect(dialog(page)).toHaveCount(0);
  const totals = page.locator(".food-daily-grid > div > section > details");
  await expect(totals).toContainText("Unknown");
  expect(
    (await (await page.request.get("/api/v1/foods?search=Restaurant")).json())
      .items,
  ).toEqual([]);
  await page.getByRole("button", { name: "+ 250 ml", exact: true }).click();
  await expect(page.locator(".food-water .measurement-total")).toContainText(
    "250 ml",
  );
  await page.getByRole("button", { name: "Log weight", exact: true }).click();
  await dialog(page).getByLabel("Weight (kg)", { exact: true }).fill("75");
  await dialog(page)
    .getByRole("button", { name: "Log weight", exact: true })
    .click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(page.locator(".food-weight .measurement-total")).toContainText(
    "75 kg",
  );
  await view(page, "History");
  await page
    .getByLabel("Search recorded foods", { exact: true })
    .fill("Restaurant");
  await expect(
    page.getByRole("heading", { name: "Restaurant dinner", exact: true }),
  ).toBeVisible();
  await view(page, "Food library");
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Coffee", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Archived", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Log food", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Restore", exact: true }).click();
  await page.getByRole("button", { name: "Archived", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Coffee", exact: true }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: info.outputPath("food-library.png"),
    fullPage: true,
  });
});

test("forms validate, protect unsaved changes and retry uncertain logs without duplicates", async ({
  page,
}) => {
  await setup(page);
  await view(page, "Food library");
  await page.getByRole("button", { name: "Create food", exact: true }).click();
  await dialog(page)
    .getByRole("button", { name: "Create food", exact: true })
    .click();
  await expect(
    dialog(page).getByLabel("Food name", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  await dialog(page)
    .getByLabel("Food name", { exact: true })
    .fill("Unsaved food");
  page.once("dialog", (d) => d.dismiss());
  await dialog(page)
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await expect(dialog(page)).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await dialog(page)
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await expect(dialog(page)).toHaveCount(0);
  await view(page, "Daily log");
  await page.getByRole("button", { name: "Log food", exact: true }).click();
  await dialog(page)
    .getByRole("button", { name: "Quick entry", exact: true })
    .click();
  await dialog(page)
    .getByLabel("Food name", { exact: true })
    .fill("Retry dinner");
  await dialog(page)
    .getByLabel("Eaten at", { exact: true })
    .fill("2026-10-23T18:00");
  const keys: string[] = [];
  let first = true;
  await page.route("**/api/v1/food-entries/quick", async (route) => {
    keys.push(route.request().headers()["idempotency-key"]!);
    const response = await route.fetch();
    if (first) {
      first = false;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "UNAVAILABLE", message: "Connection interrupted." },
        }),
      });
    } else await route.fulfill({ response });
  });
  await dialog(page)
    .getByRole("button", { name: "Log food", exact: true })
    .click();
  await expect(
    dialog(page).getByRole("button", { name: "Retry save", exact: true }),
  ).toBeVisible();
  await dialog(page)
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await expect(dialog(page)).toBeVisible();
  await dialog(page)
    .getByRole("button", { name: "Retry save", exact: true })
    .click();
  await expect(dialog(page)).toHaveCount(0);
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  const history = await (
    await page.request.get("/api/v1/food-entries?search=Retry")
  ).json();
  expect(history.items).toHaveLength(1);
});
