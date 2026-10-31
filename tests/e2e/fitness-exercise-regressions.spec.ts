import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function setup(page: Page) {
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
    name: "Exercise regression",
    email: `exercise-regression-${randomUUID()}@example.com`,
    password: "Synthetic-regression-password-123",
  });
  return post;
}

test("detail favourites immediately update their revision and the actions menu toggles closed", async ({
  page,
}) => {
  const post = await setup(page);
  const exercise = await post("/api/v1/exercises", {
    name: "Toggle movement",
    loggingType: "reps_load",
  });
  await page.goto(`/fitness/exercises/${exercise.id}`);
  await page
    .getByRole("button", { name: "Favourite Toggle movement", exact: true })
    .click();
  const starred = page.getByRole("button", {
    name: "Unfavourite Toggle movement",
    exact: true,
  });
  await expect(starred).toHaveAttribute("aria-pressed", "true");
  await starred.click();
  await expect(
    page.getByRole("button", {
      name: "Favourite Toggle movement",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "false");
  const actions = page.getByRole("button", {
    name: "Exercise actions",
    exact: true,
  });
  await actions.click();
  await expect(actions).toHaveAttribute("aria-expanded", "true");
  await actions.click();
  await expect(actions).toHaveAttribute("aria-expanded", "false");
  await expect(
    page.getByRole("menu", { name: "Exercise actions", exact: true }),
  ).toHaveCount(0);
  await actions.focus();
  await page.keyboard.press("Enter");
  await expect(actions).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(actions).toHaveAttribute("aria-expanded", "false");
  await expect(actions).toBeFocused();
  await actions.click();
  await page
    .getByRole("menuitem", { name: "Edit exercise", exact: true })
    .click();
  await page
    .getByLabel("Exercise name", { exact: true })
    .fill("Revised movement");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Revised movement", exact: true }),
  ).toBeVisible();
  const saved = await (
    await page.request.get(`/api/v1/exercises/${exercise.id}`)
  ).json();
  expect(saved.favourite).toBe(false);
  expect(saved.name).toBe("Revised movement");
  await page.reload();
  await expect(
    page.getByRole("button", {
      name: "Favourite Revised movement",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "false");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("failed later exercise pages keep the loaded cards and retry appends without reshuffling", async ({
  page,
}, info) => {
  const post = await setup(page);
  for (let index = 0; index < 31; index++)
    await post("/api/v1/exercises", {
      name: `Audit movement ${String(index).padStart(2, "0")}`,
      loggingType: "reps",
    });
  await page.goto("/fitness/exercises");
  const library = page.locator("#exercises");
  const cards = library.locator(".fitness-library-card");
  const names = () =>
    cards.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("aria-label")),
    );
  await expect(cards.first()).toBeVisible();
  const before = await names();
  expect(before.length).toBeGreaterThan(0);
  let failLater = true;
  await page.route("**/api/v1/exercises?**", async (route) => {
    if (failLater && new URL(route.request().url()).searchParams.has("cursor"))
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "UNAVAILABLE", message: "Synthetic page failure" },
        }),
      });
    else await route.continue();
  });
  await library
    .getByRole("button", { name: "Show more exercises", exact: true })
    .click();
  const retry = library.getByRole("button", {
    name: "Retry loading exercises",
    exact: true,
  });
  await expect(retry).toBeVisible();
  expect(await names()).toEqual(before);
  await expect(
    library.getByRole("heading", {
      name: "No matching exercises",
      exact: true,
    }),
  ).toHaveCount(0);
  await retry.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: info.outputPath("exercise-pagination-retry.png"),
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  failLater = false;
  await retry.click();
  await expect(cards).toHaveCount(47);
  expect((await names()).slice(0, before.length)).toEqual(before);
  expect(new Set(await names()).size).toBe(47);
  await expect(retry).toHaveCount(0);
  await expect(
    library.getByRole("button", { name: "Show more exercises", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
