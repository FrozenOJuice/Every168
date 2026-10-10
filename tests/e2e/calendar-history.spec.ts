import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { Block, Week } from "@168hours/contracts";

test("calendar history undoes several changes to the same block safely", async ({
  page,
}, testInfo) => {
  const headers = () => ({
    Origin: "http://localhost:3100",
    "Idempotency-Key": randomUUID(),
  });
  expect(
    (
      await page.request.post("/api/auth/sign-up/email", {
        headers: headers(),
        data: {
          name: "Calendar history",
          email: `history-${randomUUID()}@example.com`,
          password: "Synthetic-calendar-password-123",
        },
      })
    ).status(),
  ).toBe(200);
  await page.goto("/?date=2026-09-07&view=day");
  const grid = page.getByRole("region", { name: "Daily time grid" });
  await expect(grid).toBeVisible();
  const read = async () =>
    (await (await page.request.get("/api/v1/weeks/2026-09-07")).json()) as Week;
  const save = page.getByRole("button", { name: "Save", exact: true });
  const shortcut = testInfo.project.name === "desktop" ? "Meta+z" : "Control+z";
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("First title");
  await save.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const original = (await read()).blocks[0]!;
  const block = grid.locator(`button[data-calendar-record="${original.id}"]`);
  await block.dblclick();
  await page.getByLabel("Title", { exact: true }).fill("Second title");
  await save.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await block.dblclick();
  await page.getByLabel("Start", { exact: true }).fill("2026-09-07T11:05");
  await page.getByLabel("End", { exact: true }).fill("2026-09-07T12:10");
  await save.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const adjusted = (await read()).blocks[0]!;
  expect(adjusted.startsAt).not.toBe(original.startsAt);
  await block.click();
  await page.keyboard.press("Delete");
  await expect(block).toHaveCount(0);
  await expect(page.locator(".calendar-undo")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press(shortcut);
  await expect(page.getByText("Plan restored.", { exact: true })).toHaveClass(
    "sr-only",
  );
  await expect(block).toHaveAttribute("aria-pressed", "true");
  expect((await read()).blocks[0]).toMatchObject({
    title: adjusted.title,
    startsAt: adjusted.startsAt,
    endsAt: adjusted.endsAt,
  });
  const retryKeys: string[] = [];
  await page.route("**/api/v1/time-block-edits/*/undo", async (route) => {
    retryKeys.push(route.request().headers()["idempotency-key"]!);
    if (retryKeys.length === 1) {
      expect((await route.fetch()).status()).toBe(200);
      return route.abort("failed");
    }
    await route.continue();
  });
  await page.keyboard.press(shortcut);
  await page.getByRole("button", { name: "Retry same change" }).click();
  await expect(
    page.getByText("Plan edit undone.", { exact: true }),
  ).toHaveClass("sr-only");
  expect(retryKeys).toHaveLength(2);
  expect(retryKeys[0]).toBe(retryKeys[1]);
  await page.unroute("**/api/v1/time-block-edits/*/undo");
  expect((await read()).blocks[0]).toMatchObject({
    title: "Second title",
    startsAt: original.startsAt,
    endsAt: original.endsAt,
  });
  await page.keyboard.press(shortcut);
  await expect(block).toContainText("First title");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("calendar-history.png"),
    fullPage: true,
  });
  await page.keyboard.press(shortcut);
  await expect(block).toHaveCount(0);
  expect((await read()).blocks).toEqual([]);
  await page.keyboard.press(shortcut);
  expect((await read()).blocks).toEqual([]);

  // An external edit must not be overwritten by this visit's older action.
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Local plan");
  await save.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const local = (await read()).blocks[0]!;
  expect(
    (
      await page.request.put("/api/v1/time-blocks/" + local.id, {
        headers: { ...headers(), "If-Match": `"${local.version}"` },
        data: {
          title: "Other tab",
          startsAt: local.startsAt,
          endsAt: local.endsAt,
        },
      })
    ).status(),
  ).toBe(200);
  await page.keyboard.press(shortcut);
  await expect(
    page.locator(".calendar-interactions").getByRole("alert"),
  ).toContainText("changed");
  expect((await read()).blocks[0]).toMatchObject({
    title: "Other tab",
  } satisfies Partial<Block>);
});
