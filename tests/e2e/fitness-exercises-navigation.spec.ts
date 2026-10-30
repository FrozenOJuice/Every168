import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.use({ actionTimeout: 10000 });
test("Exercises is its own Fitness tab and returns from details to the retained library", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const post = async (path: string, data: object) => {
    const response = await page.request.post(path, {
      headers: {
        Origin: "http://localhost:3100",
        "Idempotency-Key": randomUUID(),
      },
      data,
    });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  };
  await post("/api/auth/sign-up/email", {
    name: "Exercise navigation",
    email: `exercise-nav-${randomUUID()}@example.com`,
    password: "Synthetic-exercise-password-123",
  });
  for (let index = 0; index < 33; index++)
    await post("/api/v1/exercises", {
      name: `Navigation press ${String(index).padStart(2, "0")}`,
      equipment: ["Barbell"],
      muscles: ["Chest"],
      loggingType: "reps_load",
      favourite: true,
    });
  if (info.project.name === "phone")
    await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/fitness");
  const tabs = page.getByRole("navigation", {
    name: "Fitness views",
    exact: true,
  });
  await expect(tabs.getByRole("link")).toHaveText([
    "Training",
    "Exercises",
    "History",
  ]);
  await expect(
    tabs.getByRole("link", { name: "Training", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("heading", { name: "My workouts", exact: true }),
  ).toBeVisible();
  await expect(page.locator("#exercises")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Jump to section", exact: true }),
  ).toHaveCount(0);
  await tabs.getByRole("link", { name: "Exercises", exact: true }).click();
  await expect(page).toHaveURL(/\/fitness\/exercises$/);
  await expect(
    tabs.getByRole("link", { name: "Exercises", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  const library = page.locator("#exercises");
  const cards = library.locator(".fitness-library-card");
  const search = library.getByRole("searchbox", {
    name: "Find an exercise",
    exact: true,
  });
  await expect(
    library.getByRole("heading", { name: "Exercise library", exact: true }),
  ).toBeVisible();
  await search.fill("Navigation press");
  const favourites = library.getByRole("button", {
    name: "Favourites",
    exact: true,
  });
  await favourites.click();
  await expect(favourites).toHaveAttribute("aria-pressed", "true");
  await library
    .getByRole("button", { name: "Show more exercises", exact: true })
    .click();
  await expect(cards).toHaveCount(33);
  const last = cards.last();
  const name = await last.getAttribute("aria-label");
  await last.scrollIntoViewIfNeeded();
  const scroll = await page.evaluate(() => window.scrollY);
  await last.click();
  await expect(page).toHaveURL(/\/fitness\/exercises\/[0-9a-f-]+$/);
  await expect(
    tabs.getByRole("link", { name: "Exercises", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("heading", { name: name!, exact: true }),
  ).toBeVisible();
  await page.reload();
  const back = page.getByRole("button", {
    name: "Back to Exercises",
    exact: true,
  });
  await expect(back).toHaveCSS("font-weight", "600");
  await back.click();
  await expect(page).toHaveURL(/\/fitness\/exercises$/);
  await expect(search).toHaveValue("Navigation press");
  await expect(favourites).toHaveAttribute("aria-pressed", "true");
  await expect(cards).toHaveCount(33);

  await expect(
    library.getByRole("button", { name: name!, exact: true }),
  ).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBeCloseTo(scroll, -1);
  await search.scrollIntoViewIfNeeded();
  await library
    .getByRole("button", { name: "Create exercise", exact: true })
    .click();
  const creator = page.getByRole("region", {
    name: "Create exercise",
    exact: true,
  });
  await expect(
    creator.getByLabel("Exercise name", { exact: true }),
  ).toBeFocused();
  await creator.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    library.getByRole("button", { name: "Create exercise", exact: true }),
  ).toBeFocused();
  if (info.project.name === "phone") {
    await tabs.scrollIntoViewIfNeeded();
    expect(
      await tabs.evaluate((node) => node.scrollWidth <= node.clientWidth),
    ).toBe(true);
    const day = (await page
      .getByRole("button", { name: "Day", exact: true })
      .boundingBox())!;
    const lastTab = (await tabs
      .getByRole("link", { name: "History", exact: true })
      .boundingBox())!;
    expect(lastTab.x + lastTab.width).toBeLessThanOrEqual(day.x);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: info.outputPath("exercises-tab.png") });
});
