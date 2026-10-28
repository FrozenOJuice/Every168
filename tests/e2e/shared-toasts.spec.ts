import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("recovery toast pauses for interaction, expires without losing edits and keeps discard reachable", async ({
  page,
}, info) => {
  const response = await page.request.post("/api/auth/sign-up/email", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      name: "Toast workflow",
      email: `toast-${randomUUID()}@example.com`,
      password: "Synthetic-toast-password-123",
    },
  });
  expect(response.ok()).toBe(true);
  await page.clock.install();
  await page.goto("/fitness/workout/new");
  const title = page.getByLabel("Workout name", { exact: true });
  const toast = page.locator(".app-toast");
  await title.fill("Recovered workout");
  await page.reload();
  await expect(title).toHaveValue("Recovered workout");
  await expect(toast.getByRole("status")).toHaveText("Draft restored");
  await expect(page.locator(".fitness-builder-recovery")).toHaveCount(0);
  await toast.hover();
  await page.clock.fastForward(6500);
  await expect(toast).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const bounds = (await toast.boundingBox())!;
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(
    page.viewportSize()!.width - 8,
  );
  if (page.viewportSize()!.width <= 900) {
    const nav = (await page
      .getByRole("navigation", { name: "Main navigation" })
      .boundingBox())!;
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(nav.y);
    const footer = (await page
      .locator(".fitness-builder-footer")
      .boundingBox())!;
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(footer.y - 8);
  }
  await page.screenshot({
    path: info.outputPath("draft-restored-toast.png"),
    fullPage: true,
  });
  await title.hover();
  await toast.getByRole("button", { name: "Discard", exact: true }).focus();
  await page.clock.fastForward(6500);
  await expect(toast).toBeVisible();
  await title.click();
  await page.clock.fastForward(5100);
  await expect(toast).toHaveCount(0);
  await expect(title).toHaveValue("Recovered workout");
  await page
    .getByRole("button", { name: "Workout actions", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Discard recovered changes", exact: true })
    .click();
  await expect(title).toHaveValue("");
  await expect(title).toBeFocused();
  await title.fill("Retained after dismissal");
  await page.reload();
  await expect(toast).toBeVisible();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Food", exact: true })
    .click();
  await expect(toast).toHaveCount(0);
  await page.goBack();
  await expect(title).toHaveValue("Retained after dismissal");
  await toast
    .getByRole("button", { name: "Dismiss notification", exact: true })
    .click();
  await expect(toast).toHaveCount(0);
  await expect(title).toHaveValue("Retained after dismissal");
  await page
    .getByRole("button", { name: "Workout actions", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Discard recovered changes", exact: true })
    .click();
  await page.reload();
  await expect(title).toHaveValue("");
  await expect(toast).toHaveCount(0);
});
