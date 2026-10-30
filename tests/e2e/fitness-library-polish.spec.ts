import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("library explains visibility and empty states and extends every sort without reshuffling", async ({
  page,
}, info) => {
  test.setTimeout(90000);
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
  await post("/api/auth/sign-up/email", {
    name: "Library polish",
    email: `library-polish-${randomUUID()}@example.com`,
    password: "Synthetic-library-password-123",
  });
  if (info.project.name === "phone")
    await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/fitness/exercises");
  const library = page.locator("#exercises");
  const hidden = library.getByRole("button", { name: "Hidden", exact: true });
  const favourites = library.getByRole("button", {
    name: "Favourites",
    exact: true,
  });
  await expect(hidden).toHaveText("Hidden");
  expect(await hidden.evaluate((node) => getComputedStyle(node).color)).toBe(
    await favourites.evaluate((node) => getComputedStyle(node).color),
  );
  await hidden.click();
  await expect(
    library.getByRole("heading", {
      name: "No hidden or archived exercises",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    library.getByText(
      "Showing hidden built-ins and archived custom exercises.",
      { exact: false },
    ),
  ).toBeVisible();
  await favourites.click();
  await expect(
    library.getByRole("heading", { name: "No hidden favourites", exact: true }),
  ).toBeVisible();
  await hidden.click();
  await expect(
    library.getByRole("heading", {
      name: "No favourite exercises yet",
      exact: true,
    }),
  ).toBeVisible();
  await favourites.click();
  await library
    .getByRole("searchbox", { name: "Find an exercise" })
    .fill("No matching synthetic movement");
  await expect(
    library.getByRole("heading", {
      name: "No matching exercises",
      exact: true,
    }),
  ).toBeVisible();
  await library.getByRole("button", { name: "Clear all", exact: true }).click();
  for (let index = 0; index < 33; index++) {
    await post("/api/v1/exercises", {
      name:
        index === 32
          ? "Élan movement"
          : `A movement ${String(index).padStart(2, "0")}`,
      loggingType: "reps",
    });
  }
  await page.reload();
  const cards = library.locator(".fitness-library-card");
  const names = () =>
    cards.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("aria-label")),
    );
  const more = library.getByRole("button", {
    name: "Show more exercises",
    exact: true,
  });
  for (const sort of ["Name A–Z", "Name Z–A", "Recently added"]) {
    if (sort !== "Name A–Z") {
      await library.getByRole("button", { name: /^Filters/ }).click();
      await library
        .getByRole("button", { name: "Sort exercises", exact: true })
        .click();
      await page.getByRole("option", { name: sort, exact: true }).click();
      await library.getByRole("button", { name: /^Filters/ }).click();
    }
    await expect(more).toBeVisible();
    await expect(cards.first()).toBeVisible();
    const before = await names();
    expect(before.length).toBeGreaterThan(0);
    await more.click();
    await expect(more).toHaveCount(0);
    await expect(cards).toHaveCount(49);
    expect((await names()).slice(0, before.length)).toEqual(before);
    if (sort === "Recently added") {
      expect((await names()).slice(0, 33)).toEqual(
        expect.arrayContaining(["Élan movement", "A movement 00"]),
      );
    }
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await library.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("exercise-library.png") });
});
