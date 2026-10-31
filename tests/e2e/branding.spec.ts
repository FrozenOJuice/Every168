import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("Every168 identity is consistent across account access and the authenticated shell", async ({
  page,
}) => {
  for (const route of [
    "/login",
    "/signup",
    "/forgot-password",
    "/verify-email",
    "/reset-password",
  ]) {
    await page.goto(route);
    await expect(page).toHaveTitle("Every168");
    const brand = page.getByRole("link", {
      name: "Every168 home",
      exact: true,
    });
    await expect(brand).toBeVisible();
    await expect(brand).toHaveAttribute("href", "/");
    await expect(page.locator("body")).not.toContainText(/168\s*Hours/i);
    expect(
      await page
        .locator(".brand-mark")
        .evaluate((image) => (image as HTMLImageElement).naturalWidth),
    ).toBeGreaterThan(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await expect(page.locator('meta[name="application-name"]')).toHaveAttribute(
    "content",
    "Every168",
  );
  const iconHref = await page
    .locator('link[rel="icon"][type="image/svg+xml"]')
    .getAttribute("href");
  const icon = await page.request.get(iconHref!);
  expect(icon.ok()).toBe(true);
  expect(await icon.text()).toContain("Every168");
  const appleHref = await page
    .locator('link[rel="apple-touch-icon"]')
    .getAttribute("href");
  expect((await page.request.get(appleHref!)).ok()).toBe(true);
  expect((await page.request.get("/favicon.ico")).ok()).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

  const registered = await page.request.post("/api/__test/register", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      name: "Brand review",
      email: `brand-${randomUUID()}@example.com`,
      password: "Synthetic-brand-password-123",
    },
  });
  expect(registered.ok()).toBe(true);
  await page.goto("/");
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
  const brand = page.getByRole("link", { name: "Every168 home", exact: true });
  await expect(brand).toBeVisible();
  const fits = await brand.evaluate((element) => {
    const parent = element.parentElement!.getBoundingClientRect();
    const bounds = element.getBoundingClientRect();
    return bounds.left >= parent.left && bounds.right <= parent.right;
  });
  expect(fits).toBe(true);
  await brand.focus();
  await expect(brand).toBeFocused();
  await expect(page.locator("body")).not.toContainText(/168\s*Hours/i);
});
