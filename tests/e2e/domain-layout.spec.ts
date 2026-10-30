import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.use({ actionTimeout: 10000 });
test("domains share a full-height day rail and Fitness separates training, library and progress", async ({
  page,
}, info) => {
  await page.request.post("/api/auth/sign-up/email", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      name: "Domain layout",
      email: `layout-${randomUUID()}@example.com`,
      password: "Synthetic-layout-password-123",
    },
  });
  let railBounds:
    { x: number; y: number; width: number; height: number } | undefined;
  for (const [path, name] of [
    ["food", "Food"],
    ["tasks", "Tasks"],
    ["fitness", "Fitness"],
  ] as const) {
    await page.goto(`/${path}?date=2026-10-23`);
    await expect(page.locator(".domain-workspace")).toBeVisible();
    await expect(
      page.locator(".domain-workspace-heading,.food-header"),
    ).toHaveCount(0);
    await expect(page.getByRole("heading", { name, exact: true })).toHaveClass(
      "sr-only",
    );
    if (info.project.name === "desktop") {
      const rail = page.getByRole("complementary", {
        name: `${name} day panel`,
      });
      const box = (await rail.boundingBox())!;
      expect(box.y).toBeCloseTo(0, 0);
      expect(box.height).toBeCloseTo(page.viewportSize()!.height, 0);
      if (railBounds) {
        expect(box.x).toBeCloseTo(railBounds.x, 0);
        expect(box.width).toBeCloseTo(railBounds.width, 0);
      }
      railBounds = box;
      await expect(
        rail.getByRole("heading", { name: "Your day", exact: true }),
      ).toBeVisible();
    } else {
      await page.getByRole("button", { name: "Day", exact: true }).click();
      const drawer = page.getByRole("dialog", {
        name: "Your day",
        exact: true,
      });
      await expect(drawer).toBeVisible();
      await drawer
        .getByRole("button", { name: "Close dialog", exact: true })
        .click();
    }
  }
  await expect(
    page.getByRole("complementary", { name: "Exercise library panel" }),
  ).toBeHidden();
  const views = page.getByRole("navigation", { name: "Fitness views" });
  await views.getByRole("link", { name: "Library", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Exercise library", exact: true }),
  ).toBeVisible();
  await views.getByRole("link", { name: "Progress", exact: true }).click();
  await expect(page).toHaveURL(/fitness\/progress/);
  await expect(
    page.getByRole("complementary", { name: "Exercise library panel" }),
  ).toBeHidden();
  await views.getByRole("link", { name: "Training", exact: true }).click();
  await expect(
    page.getByRole("group", { name: "Fitness side panel" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "My workouts", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("fitness-stacked.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "Create workout", exact: true }).click();
  await page
    .getByLabel("Workout name", { exact: true })
    .fill("Retain this draft");
  if (info.project.name === "phone")
    await page
      .getByRole("button", { name: "Add exercise", exact: true })
      .click();
  else
    await page
      .getByRole("searchbox", { name: "Find an exercise", exact: true })
      .focus();
  await expect(
    page.getByRole("searchbox", { name: "Find an exercise", exact: true }),
  ).toBeFocused();
  await expect(page.getByLabel("Workout name", { exact: true })).toHaveValue(
    "Retain this draft",
  );
  await page
    .getByRole("button", { name: "Back to workout", exact: true })
    .click();
  await expect(
    page.getByLabel("Workout name", { exact: true }),
  ).toBeInViewport();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
