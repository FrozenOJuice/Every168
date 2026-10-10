import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("copy ranges and apply multi-day templates from separate Calendar tools", async ({
  page,
}) => {
  const headers = () => ({
    Origin: "http://localhost:3100",
    "Idempotency-Key": randomUUID(),
  });
  expect(
    (
      await page.request.post("/api/auth/sign-up/email", {
        headers: headers(),
        data: {
          name: "Copy test",
          email: `copy-${randomUUID()}@example.com`,
          password: "Synthetic-calendar-password-123",
        },
      })
    ).status(),
  ).toBe(200);
  for (const [title, date] of [
    ["Work day one", "2026-09-07"],
    ["Work day three", "2026-09-09"],
  ]) {
    expect(
      (
        await page.request.post("/api/v1/time-blocks", {
          headers: headers(),
          data: {
            title,
            startsAt: date + "T15:00:00Z",
            endsAt: date + "T16:00:00Z",
          },
        })
      ).status(),
    ).toBe(201);
  }
  await page.goto("/?date=2026-09-07&view=day");
  const dialog = page.getByRole("dialog");
  async function tool(name: string) {
    await page
      .getByRole("button", { name: "Calendar tools", exact: true })
      .click();
    await dialog.getByRole("button", { name: new RegExp("^" + name) }).click();
  }
  await tool("Copy plans");
  await dialog.getByLabel("Copy", { exact: true }).selectOption("range");
  await dialog.getByLabel("Through").fill("2026-09-10");
  await dialog.getByLabel("Copy to").fill("2026-09-14");
  await dialog.getByRole("button", { name: "Preview copy" }).click();
  await expect(dialog).toContainText("2 plans will be added");
  await dialog.getByRole("button", { name: "Add these plans" }).click();
  await expect(page).toHaveURL(/date=2026-09-14/);
  await tool("Templates");
  await dialog
    .getByRole("button", { name: "Save calendar as template" })
    .click();
  await dialog.getByLabel("Template name").fill("Shift pattern");
  await dialog.getByLabel("Save", { exact: true }).selectOption("range");
  await dialog.getByLabel("Source date").fill("2026-09-07");
  await dialog.getByLabel("Through").fill("2026-09-10");
  await dialog.getByRole("button", { name: "Save template" }).click();
  await expect(dialog).toContainText("4-day template");
  await dialog.getByRole("button", { name: "Use template" }).click();
  await dialog.getByLabel("Apply to date").fill("2026-10-05");
  await dialog.getByLabel("Cycles").fill("2");
  await dialog.getByRole("button", { name: "Preview template" }).click();
  await expect(dialog).toContainText("4 plans will be added");
  await dialog.getByRole("button", { name: "Add these plans" }).click();
  await expect(page).toHaveURL(/date=2026-10-05/);
  await page.goto("/?date=2026-09-07&view=day");
  await page
    .getByRole("region", { name: "Daily time grid" })
    .getByRole("button", { name: /Work day one.*planned/ })
    .dblclick();
  await dialog.getByText("Actions", { exact: true }).click();
  await dialog.getByRole("button", { name: "Copy…" }).click();
  await expect(dialog.getByLabel("Copy", { exact: true })).toHaveValue(
    "single",
  );
  await dialog.getByLabel("Copy to").fill("2026-10-12");
  await dialog.getByRole("button", { name: "Preview copy" }).click();
  await expect(dialog).toContainText("1 plan will be added");
  await dialog.getByRole("button", { name: "Add these plans" }).click();
  await expect(page).toHaveURL(/date=2026-10-12/);
});
