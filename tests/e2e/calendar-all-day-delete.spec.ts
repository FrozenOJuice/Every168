import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("delete one all-day plan from selection or editor and undo without confirmation", async ({
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
          name: "All-day deletion test",
          email: `all-day-delete-${randomUUID()}@example.com`,
          password: "Synthetic-calendar-password-123",
        },
      })
    ).status(),
  ).toBe(200);
  const created = await page.request.post("/api/v1/calendar/items", {
    headers: headers(),
    data: {
      title: "All-day trip",
      kind: "all_day",
      date: "2026-09-07",
      endDate: "2026-09-09",
      notes: "Preserve the whole trip",
    },
  });
  expect(created.status()).toBe(201);
  const item = await created.json();
  let confirmations = 0;
  page.on("dialog", async (dialog) => {
    confirmations++;
    await dialog.dismiss();
  });
  const shortcut = testInfo.project.name === "phone" ? "Control" : "Meta";
  const notice = page.locator(".calendar-notice");
  const views =
    testInfo.project.name === "desktop"
      ? ["day", "week", "month"]
      : ["day", "week"];
  for (const view of views) {
    await page.goto(`/?date=2026-09-07&view=${view}`);
    const region = page.getByRole("region", {
      name:
        view === "day"
          ? "Daily time grid"
          : view === "week"
            ? "Weekly time grid"
            : "Monthly calendar",
    });
    const plan = region.locator(`[data-calendar-record="${item.id}"]`).first();
    for (const key of ["Delete", "Backspace"]) {
      await plan.click();
      await expect(plan).toHaveAttribute("aria-pressed", "true");
      await page.keyboard.press(key);
      await expect(plan).toHaveCount(0);
      await expect(notice).toContainText("Plan deleted");
      if (key === "Delete")
        await notice.getByRole("button", { name: "Undo", exact: true }).click();
      else await page.keyboard.press(`${shortcut}+z`);
      await expect(plan).toBeVisible();
    }
    await plan.dblclick();
    const editor = page.getByRole("dialog", { name: "Edit all-day plan" });
    await expect(editor).toBeVisible();
    // Backspace inside an editor must keep editing text, not delete the plan.
    await editor.getByLabel("Title", { exact: true }).fill("All-day trips");
    await editor.getByLabel("Title", { exact: true }).press("Backspace");
    await expect(editor.getByLabel("Title", { exact: true })).toHaveValue(
      "All-day trip",
    );
    const retryKeys: string[] = [];
    if (view === "day") {
      await page.route("**/api/v1/calendar/selection/delete", async (route) => {
        retryKeys.push(route.request().headers()["idempotency-key"]!);
        if (retryKeys.length === 1) {
          expect((await route.fetch()).status()).toBe(200);
          return route.abort("failed");
        }
        await route.continue();
      });
    }
    await editor
      .getByRole("button", { name: "Delete plan", exact: true })
      .click();
    await expect(editor).toHaveCount(0);
    if (view === "day") {
      const retry = page.getByRole("button", { name: "Retry same change" });
      await expect(retry).toBeVisible();
      await expect(page.locator(".calendar-interactions")).toHaveAttribute(
        "aria-busy",
        "true",
      );
      await page.keyboard.press(`${shortcut}+z`);
      await expect(retry).toBeVisible();
      await retry.click();
      await expect(retry).toHaveCount(0);
      expect(retryKeys).toHaveLength(2);
      expect(retryKeys[0]).toBe(retryKeys[1]);
      await page.unroute("**/api/v1/calendar/selection/delete");
    }
    await expect(plan).toHaveCount(0);
    await expect(page.locator(".calendar-interactions")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    await page.keyboard.press(`${shortcut}+z`);
    await expect(plan).toBeVisible();
    const restored = await page.request.get(
      `/api/v1/calendar/items/${item.id}`,
    );
    expect(restored.status()).toBe(200);
    expect(await restored.json()).toMatchObject({
      title: item.title,
      date: item.date,
      endDate: item.endDate,
      notes: item.notes,
    });
  }
  // Undoing deletion must advance the pasted item's revision so the previous
  // paste can still be undone as the next action.
  await page.goto("/?date=2026-09-07&view=day");
  const grid = page.getByRole("region", { name: "Daily time grid" });
  await grid.locator(`[data-calendar-record="${item.id}"]`).click();
  await page.keyboard.press(`${shortcut}+c`);
  await page.goto("/?date=2026-09-14&view=day");
  await grid
    .getByRole("button", { name: "Select 2026-09-14", exact: true })
    .click();
  await page.keyboard.press(`${shortcut}+v`);
  await expect(grid.locator(".date-record")).toHaveCount(1);
  const copy = grid.locator(".date-record");
  await copy.click();
  await page.keyboard.press("Delete");
  await expect(grid.locator(".date-record")).toHaveCount(0);
  await expect(page.locator(".calendar-interactions")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.keyboard.press(`${shortcut}+z`);
  await expect(grid.locator(".date-record")).toHaveCount(1);
  await expect(page.locator(".calendar-interactions")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.keyboard.press(`${shortcut}+z`);
  await expect(grid.locator(".date-record")).toHaveCount(0);
  expect(
    (await page.request.get(`/api/v1/calendar/items/${item.id}`)).status(),
  ).toBe(200);
  expect(confirmations).toBe(0);
});
