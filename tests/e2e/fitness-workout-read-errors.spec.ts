import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("workout pagination and refresh failures retain cards and retry the failed read", async ({
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
    name: "Workout read errors",
    email: `workout-reads-${randomUUID()}@example.com`,
    password: "Synthetic-workout-password-123",
  });
  for (let index = 0; index < 8; index++)
    await post("/api/v1/strength-plans", {
      title: `Read test ${index}`,
      isDraft: true,
      exercises: [],
    });
  await page.clock.install();
  await page.goto("/fitness");
  const section = page.locator("#my-workouts");
  const cards = section.locator(".fitness-workout-card");
  const names = () => cards.locator("h3").allTextContents();
  await expect(cards).toHaveCount(info.project.name === "phone" ? 4 : 6);
  const before = await names();
  const grid = await section.locator(".fitness-cards").boundingBox();
  const search = await section
    .getByRole("searchbox", { name: "Search workouts", exact: true })
    .boundingBox();
  const more = section.getByRole("button", {
    name: "Load more workouts",
    exact: true,
  });
  const moreBox = await more.boundingBox();
  expect(search!.x).toBeCloseTo(grid!.x, 0);
  expect(search!.width).toBeCloseTo(grid!.width, 0);
  expect(moreBox!.x + moreBox!.width / 2).toBeCloseTo(
    grid!.x + grid!.width / 2,
    0,
  );
  await expect(more.locator("svg")).toHaveCount(0);
  await more.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: info.outputPath("workout-pagination-alignment.png"),
  });
  let failure: "cursor" | "all" | null = "cursor";
  await page.route("**/api/v1/strength-plans?**", async (route) => {
    if (
      failure === "all" ||
      (failure === "cursor" &&
        new URL(route.request().url()).searchParams.has("cursor"))
    )
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "UNAVAILABLE", message: "Synthetic read failure" },
        }),
      });
    else await route.continue();
  });
  await section
    .getByRole("button", { name: "Load more workouts", exact: true })
    .click();
  const retryMore = section.getByRole("button", {
    name: "Retry loading workouts",
    exact: true,
  });
  await expect(retryMore).toBeVisible();
  expect(await names()).toEqual(before);
  await expect(
    section.getByText("No saved workouts yet.", { exact: true }),
  ).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  failure = null;
  await retryMore.click();
  await expect(cards).toHaveCount(8);
  expect((await names()).slice(0, before.length)).toEqual(before);
  expect(new Set(await names()).size).toBe(8);
  await expect(retryMore).toHaveCount(0);
  const loaded = await names();
  failure = "all";
  await page.clock.fastForward(31000);
  await page.evaluate(() =>
    window.dispatchEvent(new Event("visibilitychange")),
  );
  const retryRefresh = section.getByRole("button", {
    name: "Retry refreshing workouts",
    exact: true,
  });
  await expect(retryRefresh).toBeVisible();
  expect(await names()).toEqual(loaded);
  failure = null;
  await retryRefresh.click();
  await expect(retryRefresh).toHaveCount(0);
  expect(await names()).toEqual(loaded);
  failure = "all";
  await page.reload();
  await expect(
    section.getByRole("button", { name: "Try again", exact: true }),
  ).toBeVisible();
  await expect(cards).toHaveCount(0);
  failure = null;
  await section.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(cards).toHaveCount(info.project.name === "phone" ? 4 : 6);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
