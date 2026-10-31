import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";
import { adminBrowserFixture } from "../../apps/api/tests/admin-browser-fixtures";

test("fixed admin accounts manage users, review aggregates and audit safe retries", async ({
  page,
  playwright,
}, testInfo) => {
  const fixture = await adminBrowserFixture();
  const { email, password } = fixture;
  const memberContext = await playwright.request.newContext({
    baseURL: "http://localhost:3100",
    extraHTTPHeaders: { Origin: "http://localhost:3100" },
  });
  const memberEmail = "admin-target-" + randomUUID() + "@example.com";
  let memberId: string | undefined;
  try {
    const signup = await memberContext.post("/api/__test/register", {
      data: { name: "Admin target", email: memberEmail, password },
    });
    expect(signup.status()).toBe(200);
    memberId = (await signup.json()).user.id;
    await page.goto("/login");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      page.getByRole("navigation", { name: "Main navigation" }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Weekly time grid" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByRole("link", { name: "Admin", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Admin", exact: true }),
    ).toBeVisible({ timeout: 30000 });
    await expect(
      page.getByText("Total accounts", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Server errors", { exact: true }),
    ).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath("admin-overview.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Users", exact: true }).click();
    await page.getByLabel("Name, email or account ID").fill(memberEmail);
    await page
      .getByRole("button", { name: "Search users", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Admin target", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Suspend", exact: true }).click();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    expect((await memberContext.get("/api/v1/me")).status()).toBe(200);
    let dropped = false;
    const keys: string[] = [];
    await page.route("**/api/v1/admin/users/*/status", async (route) => {
      keys.push(route.request().headers()["idempotency-key"]!);
      if (!dropped) {
        dropped = true;
        const saved = await route.fetch();
        expect(saved.status()).toBe(200);
        await route.abort("failed");
      } else await route.continue();
    });
    await page.getByRole("button", { name: "Suspend", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Suspend account", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Retry same change", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
    await expect(
      page.getByRole("button", { name: "Reactivate", exact: true }),
    ).toBeVisible();
    expect((await memberContext.get("/api/v1/me")).status()).toBe(401);
    await page.unroute("**/api/v1/admin/users/*/status");
    await page.getByRole("button", { name: "Reactivate", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Reactivate account", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(
      (
        await memberContext.post("/api/auth/sign-in/email", {
          data: { email: memberEmail, password },
        })
      ).status(),
    ).toBe(200);
    await page
      .getByRole("button", { name: "Revoke sessions", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Revoke all sessions", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect((await memberContext.get("/api/v1/me")).status()).toBe(401);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath("admin-users.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Audit history", exact: true })
      .click();
    await expect(
      page
        .getByRole("heading", { name: "Account suspended", exact: true })
        .first(),
    ).toBeVisible();
    await expect(
      page
        .getByRole("heading", { name: "Sessions revoked", exact: true })
        .first(),
    ).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath("admin-audit.png"),
      fullPage: true,
    });
    expect(
      (
        await memberContext.post("/api/auth/sign-in/email", {
          data: { email: memberEmail, password },
        })
      ).status(),
    ).toBe(200);
    expect((await memberContext.get("/api/v1/admin/users")).status()).toBe(403);
    await page.getByRole("button", { name: "Users", exact: true }).click();
    await page
      .getByRole("button", { name: "Delete account", exact: true })
      .click();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    expect((await memberContext.get("/api/v1/me")).status()).toBe(200);
    await page
      .getByRole("button", { name: "Delete account", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    const confirm = dialog.getByRole("button", {
      name: "Delete account",
      exact: true,
    });
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel("Confirm account email").fill("wrong@example.com");
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel("Confirm account email").fill(memberEmail);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath("admin-delete-confirmation.png"),
      fullPage: true,
    });
    const deletionKeys: string[] = [];
    await page.route("**/api/v1/admin/users/*", async (route) => {
      if (route.request().method() !== "DELETE") return route.continue();
      deletionKeys.push(route.request().headers()["idempotency-key"]!);
      if (deletionKeys.length === 1) {
        expect((await route.fetch()).status()).toBe(200);
        await route.abort("failed");
      } else await route.continue();
    });
    await confirm.click();
    await expect(
      page.getByRole("button", { name: "Retry same change", exact: true }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Confirm account email")).toBeDisabled();
    await page
      .getByRole("button", { name: "Retry same change", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    expect(deletionKeys).toHaveLength(2);
    expect(deletionKeys[0]).toBe(deletionKeys[1]);
    await expect(
      page.getByText("No matching accounts.", { exact: true }),
    ).toBeVisible();
    expect((await memberContext.get("/api/v1/me")).status()).toBe(401);
    await page
      .getByRole("button", { name: "Audit history", exact: true })
      .click();
    await expect(
      page
        .getByRole("heading", { name: "Account deleted", exact: true })
        .first(),
    ).toBeVisible();
  } finally {
    await memberContext.dispose();
    await fixture.cleanup(memberId);
  }
});
