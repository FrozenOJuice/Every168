import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.use({ actionTimeout: 10000 });

test("exercise details have a dedicated route and restore library context", async ({
  page,
}, info) => {
  const post = async (path: string, data: object) => {
    const response = await page.request.post(path, {
      headers: {
        Origin: "http://localhost:3100",
        "Idempotency-Key": randomUUID(),
      },
      data,
    });
    expect(response.ok()).toBe(true);
    return response.json();
  };
  await post("/api/__test/register", {
    name: "Detail tester",
    email: `details-${randomUUID()}@example.com`,
    password: "Synthetic-details-password-123",
  });
  const custom = await post("/api/v1/exercises", {
    name: "Custom movement",
    equipment: ["Dumbbells"],
    muscles: ["Legs"],
    notes: "First step.\nSecond step.",
  });
  await page.goto("/fitness");
  const search = page.getByRole("searchbox", {
    name: "Find an exercise",
    exact: true,
  });
  await search.fill("Squat");
  const squat = page.getByRole("button", { name: "Squat", exact: true });
  await squat.scrollIntoViewIfNeeded();
  const scroll = await page.evaluate(() => window.scrollY);
  await squat.click();
  await expect(page).toHaveURL(/\/fitness\/exercises\/catalog\//);
  await expect(
    page.getByRole("heading", { name: "Squat", level: 1, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "My workouts", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Your history", exact: true }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const actions = page.getByRole("button", {
    name: "Exercise actions",
    exact: true,
  });
  await actions.click();
  const menu = page.getByRole("menu", {
    name: "Exercise actions",
    exact: true,
  });
  await expect(
    menu.getByRole("menuitem", { name: "Duplicate exercise", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(
    menu.getByRole("menuitem", { name: "Hide from library", exact: true }),
  ).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(actions).toBeFocused();
  await page.screenshot({
    path: info.outputPath("exercise-details.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Back to Fitness", exact: true })
    .click();
  await expect(search).toHaveValue("Squat");
  await expect(squat).toBeFocused();
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeCloseTo(scroll, 0);
  await squat.click();
  await expect(page).toHaveURL(/\/fitness\/exercises\/catalog\//);
  await page.goBack();
  await expect(search).toHaveValue("Squat");
  await expect(squat).toBeFocused();

  await page.goto(`/fitness/exercises/${custom.id}`);
  await expect(
    page.getByRole("heading", {
      name: "Custom movement",
      level: 1,
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Custom movement",
      level: 1,
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("First step.\nSecond step.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Exercise actions", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Edit exercise", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Exercise name", exact: true }),
  ).toHaveValue("Custom movement");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Custom movement",
      level: 1,
      exact: true,
    }),
  ).toBeVisible();
});
