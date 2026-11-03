import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { foodView } from "./helpers/food-navigation";
test("Food exposes Today and Library with one shared dated Calendar panel", async ({
  page,
}, info) => {
  await page.request.post("/api/__test/register", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      name: "Food organisation",
      email: `food-org-${randomUUID()}@example.com`,
      password: "Synthetic-food-org-password-123",
    },
  });
  await page.goto("/food?date=2026-10-23");
  const nav = page.getByRole("navigation", {
    name: "Food navigation",
    exact: true,
  });
  await expect(nav.getByRole("link")).toHaveText(["Today", "Library"]);
  await expect(
    page.getByRole("link", { name: /^(Planner|Groceries)$/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Daily nutrition", exact: true }),
  ).toContainText("0 kcal");
  await foodView(page, "Foods");
  await expect(
    page
      .getByRole("navigation", { name: "Library sections", exact: true })
      .getByRole("link"),
  ).toHaveText(["Foods", "Recipes", "Saved Meals"]);
  for (const section of ["Recipes", "Saved Meals", "Foods"]) {
    await foodView(page, section);
    await expect(page).toHaveURL(/date=2026-10-23/);
  }
  await foodView(page, "Search past entries");
  await expect(
    page.getByRole("heading", { name: "Search past entries", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to Today", exact: true }).click();
  if (info.project.name !== "desktop")
    await page.getByRole("button", { name: "Day", exact: true }).click();
  const panel =
    info.project.name === "desktop"
      ? page.getByRole("complementary", { name: "Food day panel", exact: true })
      : page.getByRole("dialog", { name: "Your day", exact: true });
  await panel.getByRole("button", { name: "Next day", exact: true }).click();
  await expect(page).toHaveURL(/date=2026-10-24/);
});
