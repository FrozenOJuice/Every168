import { foodView } from "./helpers/food-navigation";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("Food navigation and reload complete without React suspension or hydration errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /use\(\)|suspend|hydrati|Rendered (more|fewer) hooks|uncached promise/i.test(
        message.text(),
      )
    )
      errors.push(message.text());
  });
  const registered = await page.request.post("/api/__test/register", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      name: "Food navigation",
      email: `food-navigation-${randomUUID()}@example.com`,
      password: "Synthetic-navigation-password-123",
    },
  });
  expect(registered.ok()).toBe(true);
  await page.goto("/?date=2026-11-02&view=week");
  const main = page.getByRole("navigation", {
    name: "Main navigation",
    exact: true,
  });
  await main.getByRole("link", { name: "Food", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: /^(Nutrition for .+|Today’s nutrition)$/,
    }),
  ).toBeVisible();
  for (const name of [
    "Foods",
    "Saved Meals",
    "Recipes",
    "Search past entries",
    "Today",
  ]) {
    await foodView(page, name);
    await expect(page).toHaveURL(/\/food\?/);
    await expect(
      page
        .getByRole("navigation", { name: "Food navigation" })
        .getByRole("link", {
          name: ["Foods", "Saved Meals", "Recipes"].includes(name)
            ? "Library"
            : "Today",
          exact: true,
        }),
    ).toHaveAttribute("aria-current", "page");
  }
  await main.getByRole("link", { name: "Fitness", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "My workouts", exact: true }),
  ).toBeVisible();
  await main.getByRole("link", { name: "Food", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: /^(Nutrition for .+|Today’s nutrition)$/,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: /^(Nutrition for .+|Today’s nutrition)$/,
    }),
  ).toBeVisible();
  await page.goto("/food?view=recipe&date=2026-11-03");
  await expect(
    page.getByRole("button", { name: "Create recipe", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
