import { randomUUID } from "node:crypto";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function setup(page: Page) {
  const result = await page.request.post("/api/__test/register", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      name: "Food design",
      email: `food-design-${randomUUID()}@example.com`,
      password: "Synthetic-food-design-password-123",
    },
  });
  expect(result.ok()).toBe(true);
  await page.goto("/food?date=2026-10-23");
}
test("Today gives fibre equal metric emphasis and opens a full workspace target editor", async ({
  page,
}, info) => {
  if (info.project.name === "phone")
    await page.setViewportSize({ width: 320, height: 740 });
  await setup(page);
  const summary = page.getByRole("region", {
    name: "Daily nutrition",
    exact: true,
  });
  await expect(summary.getByRole("article")).toHaveCount(5);
  const fibre = summary.getByRole("article", { name: "Fibre", exact: true }),
    protein = summary.getByRole("article", { name: "Protein", exact: true });
  await expect(fibre).toContainText("0 g");
  const appearance = async (selector: typeof fibre) =>
    selector.locator(".food-consumed strong").evaluate((e) => {
      const s = getComputedStyle(e);
      return { font: s.fontSize, weight: s.fontWeight, color: s.color };
    });
  expect(await appearance(fibre)).toEqual(await appearance(protein));
  const p = await protein.boundingBox(),
    f = await fibre.boundingBox();
  expect(p).not.toBeNull();
  expect(f).not.toBeNull();
  if (info.project.name === "desktop") expect(f!.y).toBe(p!.y);
  else expect(f!.y).toBeGreaterThan(p!.y);
  await page
    .getByRole("link", { name: "Edit nutrition targets", exact: true })
    .click();
  await expect(page).toHaveURL(/view=targets&date=2026-10-23/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const editor = page.getByRole("region", {
    name: "Nutrition targets",
    exact: true,
  });
  await expect(
    editor.getByRole("heading", { name: "Energy", exact: true }),
  ).toBeVisible();
  await expect(
    editor.getByRole("heading", { name: "Macronutrients", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Food navigation", exact: true })
      .getByRole("link", { name: "Today", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page).toHaveTitle("Every168");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: info.outputPath("food-targets-workspace.png"),
    fullPage: info.project.name !== "phone",
  });
  await editor.getByLabel("Protein (g)", { exact: true }).fill("120");
  await page
    .getByRole("navigation", { name: "Food navigation", exact: true })
    .getByRole("link", { name: "Library", exact: true })
    .click();
  let confirm = page.getByRole("dialog", {
    name: "Discard changes?",
    exact: true,
  });
  await confirm
    .getByRole("button", { name: "Keep editing", exact: true })
    .click();
  await expect(editor.getByLabel("Protein (g)", { exact: true })).toHaveValue(
    "120",
  );
  await editor.getByRole("button", { name: "Cancel", exact: true }).click();
  confirm = page.getByRole("dialog", { name: "Discard changes?", exact: true });
  await confirm
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
  await expect(page).toHaveURL(/view=day&date=2026-10-23/);
  expect(
    (await (await page.request.get("/api/v1/nutrition-goals")).json()).proteinG,
  ).toBeNull();
  await page
    .getByRole("link", { name: "Edit nutrition targets", exact: true })
    .click();
  await editor.getByLabel("Calories (kcal)", { exact: true }).fill("2100");
  await editor
    .getByRole("button", { name: "Save nutrition targets", exact: true })
    .click();
  await expect(summary).toContainText("Target 2,100 kcal");
  await expect(page).toHaveURL(/view=day&date=2026-10-23/);
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: info.outputPath("food-today-metrics.png"),
    fullPage: info.project.name !== "phone",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("partial fibre stays visible and background target refresh cannot replace the editor revision", async ({
  page,
}) => {
  await setup(page);
  for (const food of [
    {
      name: "Known nutrition",
      servingAmount: 1,
      servingUnit: "serving",
      calories: 100,
      fiberG: 3,
      fatG: 0,
    },
    { name: "Unknown nutrition", servingAmount: 1, servingUnit: "serving" },
  ]) {
    const result = await page.request.post("/api/v1/food-entries/quick", {
      headers: {
        Origin: "http://localhost:3100",
        "Idempotency-Key": randomUUID(),
      },
      data: { food, quantity: 1, consumedAt: "2026-10-23T12:00:00Z" },
    });
    expect(result.status()).toBe(201);
  }
  await page.reload();
  const fibre = page.getByRole("article", { name: "Fibre", exact: true });
  await expect(fibre.locator("strong")).toHaveText("3+");
  await expect(fibre).toContainText("Partial known total");
  await page
    .getByRole("link", { name: "Edit nutrition targets", exact: true })
    .click();
  const editor = page.getByRole("region", {
    name: "Nutrition targets",
    exact: true,
  });
  await editor.getByLabel("Protein (g)", { exact: true }).fill("120");
  const outside = await page.request.put("/api/v1/nutrition-goals", {
    headers: {
      Origin: "http://localhost:3100",
      "Idempotency-Key": randomUUID(),
      "If-Match": '"1"',
    },
    data: { calories: 2300 },
  });
  expect(outside.status()).toBe(200);
  await page.clock.install();
  await page.clock.fastForward(31000);
  const refresh = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/nutrition-goals") &&
      r.request().method() === "GET",
  );
  await page.evaluate(() =>
    window.dispatchEvent(new Event("visibilitychange")),
  );
  expect((await (await refresh).json()).version).toBe(2);
  await expect(editor.getByLabel("Protein (g)", { exact: true })).toHaveValue(
    "120",
  );
  const rejected = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/nutrition-goals") &&
      r.request().method() === "PUT",
  );
  await editor
    .getByRole("button", { name: "Save nutrition targets", exact: true })
    .click();
  const response = await rejected;
  expect(response.status()).toBe(409);
  expect(response.request().headers()["if-match"]).toBe('"1"');
  await expect(
    editor.getByRole("button", {
      name: "Reload latest (discard edits)",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    (await (await page.request.get("/api/v1/nutrition-goals")).json()).calories,
  ).toBe(2300);
});
