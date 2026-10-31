import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("public signup verifies its mailbox, resets and changes credentials with session revocation", async ({
  page,
}) => {
  const email = `public-account-${randomUUID()}@example.com`;
  const password = "Synthetic-public-password-123";
  const mail = async (kind: string) => {
    const response = await page.request.get(
      `/api/__test/mail?email=${encodeURIComponent(email)}`,
    );
    const messages = await response.json();
    return [...messages]
      .reverse()
      .find((m: { kind: string }) => m.kind === kind);
  };
  await page.goto("/signup");
  await page.getByLabel("Name", { exact: true }).fill("Public beta member");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Check your email");
  expect((await page.request.get("/api/v1/me")).status()).toBe(401);
  await expect(
    page.getByRole("link", { name: "Resend verification email", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("link", { name: "Resend verification email", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Resend verification email", exact: true }),
  ).toBeVisible();
  const verify = await mail("verify");
  await page.goto(`/verify-email#token=${verify.token}`);
  await page.getByRole("button", { name: "Verify email", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Email verified");
  await expect(page).toHaveURL(/\/verify-email$/);
  await page
    .getByRole("link", { name: "Back to sign in", exact: true })
    .click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
  await page.goto("/settings");
  await page.getByLabel("Current password", { exact: true }).fill(password);
  await page
    .getByLabel("New password", { exact: true })
    .fill("Changed-public-password-123");
  await page
    .getByRole("button", { name: "Change password", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login$/);
  await page
    .getByRole("link", { name: "Forgot password?", exact: true })
    .click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByRole("button", { name: "Send reset email", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("If this address");
  const reset = await mail("reset");
  await page.goto(`/reset-password#token=${reset.token}`);
  await page
    .getByLabel("New password", { exact: true })
    .fill("Reset-public-password-123");
  await page
    .getByRole("button", { name: "Reset password", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Password reset");
  await page
    .getByRole("link", { name: "Back to sign in", exact: true })
    .click();
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Reset-public-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
