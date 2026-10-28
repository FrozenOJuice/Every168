import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("first release exposes Calendar, Fitness and Tasks without deferred entry points", async ({
  page,
}, info) => {
  test.skip(
    info.config.metadata.releaseScope !== "core",
    "Run with playwright.release.config.ts for the first-release boundary.",
  );
  const signup = await page.request.post("/api/auth/sign-up/email", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      name: "Release scope",
      email: `release-${randomUUID()}@example.com`,
      password: "Synthetic-release-password-123",
    },
  });
  expect(signup.ok()).toBe(true);
  await page.goto("/?date=2026-10-27&view=day");
  const navigation = page.getByRole("navigation", {
    name: "Main navigation",
    exact: true,
  });
  await expect(navigation.getByRole("link")).toHaveText([
    "Calendar",
    "Fitness",
    "Tasks",
  ]);
  await expect(page.locator(".assistant-launcher")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /^Quick actions on/ }),
  ).toHaveCount(0);
  await page
    .locator(".calendar-toolbar")
    .getByRole("button", { name: "Actions", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Calendar tools…", exact: true })
    .click();
  const tools = page.getByRole("dialog", {
    name: "Calendar tools",
    exact: true,
  });
  await expect(
    tools.getByRole("button", { name: /Quick actions/ }),
  ).toHaveCount(0);
  await expect(
    tools.getByRole("button", { name: /Add repeating plan/ }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await navigation.getByRole("link", { name: "Fitness", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "My workouts", exact: true }),
  ).toBeVisible();
  await navigation.getByRole("link", { name: "Tasks", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Quick task title", exact: true })
    .fill("First release task");
  await page
    .locator(".tasks-capture")
    .getByRole("button", { name: "Add task", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: /First release task/ }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("release-navigation.png"),
    fullPage: true,
  });
  for (const path of ["/food", "/food?view=recipe", "/assistant"]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "404", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".assistant-launcher")).toHaveCount(0);
  }
  for (const path of [
    "foods",
    "food-entries",
    "water-entries",
    "weight-entries",
    "dashboard",
  ]) {
    expect((await page.request.get(`/api/v1/${path}`)).status()).toBe(404);
  }
});
