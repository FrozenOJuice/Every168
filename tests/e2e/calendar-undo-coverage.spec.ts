import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

const headers = () => ({
  Origin: "http://localhost:3100",
  "Idempotency-Key": randomUUID(),
});
async function signUp(page: Page) {
  expect(
    (
      await page.request.post("/api/auth/sign-up/email", {
        headers: headers(),
        data: {
          name: "Calendar undo coverage",
          email: `undo-coverage-${randomUUID()}@example.com`,
          password: "Synthetic-calendar-password-123",
        },
      })
    ).status(),
  ).toBe(200);
  await page.goto("/?date=2026-09-07&view=day");
  await expect(
    page.getByRole("region", { name: "Daily time grid" }),
  ).toBeVisible();
}

test("undo all-day creation, edits and deletion in sequence", async ({
  page,
}) => {
  await signUp(page);
  const dialog = page.getByRole("dialog");
  const grid = page.getByRole("region", { name: "Daily time grid" });
  const plan = (title: string) =>
    grid.getByRole("button", {
      name: `${title}, all day, 2026-09-07`,
      exact: true,
    });
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await dialog
    .getByLabel("Title", { exact: true })
    .fill("Original all-day plan");
  await dialog.getByLabel("All day", { exact: true }).check();
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(plan("Original all-day plan")).toBeVisible();
  await plan("Original all-day plan").dblclick();
  await dialog.getByLabel("Title", { exact: true }).fill("Edited all-day plan");
  await dialog.getByLabel("Spans multiple days", { exact: true }).check();
  await dialog.getByLabel("Last day", { exact: true }).fill("2026-09-09");
  await dialog.getByText("More details", { exact: true }).click();
  await dialog
    .getByLabel("Notes (optional)")
    .fill("Remember the prior details");
  await dialog.getByRole("button", { name: "Save plan", exact: true }).click();
  await expect(plan("Edited all-day plan")).toBeVisible();
  await plan("Edited all-day plan").click();
  await page.keyboard.press("Delete");
  await expect(plan("Edited all-day plan")).toHaveCount(0);
  await expect(page.locator(".calendar-interactions")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.keyboard.press("Meta+z");
  await expect(plan("Edited all-day plan")).toBeVisible();
  await expect(page.locator(".calendar-interactions")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.keyboard.press("Meta+z");
  await expect(plan("Original all-day plan")).toBeVisible();
  const items = await (
    await page.request.get(
      "/api/v1/calendar/items?from=2026-09-07&to=2026-09-09",
    )
  ).json();
  expect(items).toHaveLength(1);
  expect(items[0]).toMatchObject({
    title: "Original all-day plan",
    endDate: "2026-09-07",
    notes: null,
  });
  await expect(page.locator(".calendar-interactions")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.keyboard.press("Meta+z");
  await expect(plan("Original all-day plan")).toHaveCount(0);
});

test("undo whole-series deletion and edits, occurrence edit, then creation", async ({
  page,
}) => {
  await signUp(page);
  const dialog = page.getByRole("dialog");
  const grid = page.getByRole("region", { name: "Daily time grid" });
  const plan = (title: string) =>
    grid
      .locator(".grid-record")
      .getByRole("button", { name: new RegExp(`${title}.*planned`) });
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await dialog.getByLabel("Title", { exact: true }).fill("Original series");
  await dialog.getByLabel("Start", { exact: true }).fill("2026-09-07T09:00");
  await dialog.getByLabel("End", { exact: true }).fill("2026-09-07T10:00");
  await dialog.getByLabel("Repeat", { exact: true }).selectOption("daily");
  await dialog.getByLabel("Repeat through", { exact: true }).fill("2026-09-09");
  await dialog
    .getByRole("button", { name: "Create repeating plan", exact: true })
    .click();
  await expect(plan("Original series")).toBeVisible();
  await plan("Original series").dblclick();
  await dialog
    .getByLabel("Title", { exact: true })
    .fill("Individual exception");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(plan("Individual exception")).toBeVisible();
  await plan("Individual exception").dblclick();
  await dialog
    .getByRole("button", { name: "Edit entire series", exact: true })
    .click();
  await dialog.getByLabel("Title", { exact: true }).fill("Revised series");
  await dialog.getByLabel("Repeat through", { exact: true }).fill("2026-09-08");
  await dialog
    .getByRole("button", { name: "Save entire series", exact: true })
    .click();
  await expect(plan("Revised series")).toBeVisible();
  await plan("Revised series").dblclick();
  await dialog
    .getByRole("button", { name: "Edit entire series", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Delete entire series", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(plan("Revised series")).toHaveCount(0);
  await expect(page.locator(".calendar-interactions")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.keyboard.press("Meta+z");
  await expect(plan("Revised series")).toBeVisible();
  await expect(page.locator(".calendar-interactions")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.keyboard.press("Meta+z");
  await expect(plan("Individual exception")).toBeVisible();
  await expect(page.locator(".calendar-interactions")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.keyboard.press("Meta+z");
  await expect(plan("Original series")).toBeVisible();
  await expect(page.locator(".calendar-interactions")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.keyboard.press("Meta+z");
  await expect(plan("Original series")).toHaveCount(0);
  expect(
    (await (await page.request.get("/api/v1/weeks/2026-09-07")).json()).blocks,
  ).toHaveLength(0);
});

test("undo activity logged through Calendar quick actions at its source", async ({
  page,
}) => {
  await signUp(page);
  const food = await page.request.post("/api/v1/foods", {
    headers: headers(),
    data: {
      name: "Undo test food",
      servingAmount: 1,
      servingUnit: "item",
      calories: 100,
    },
  });
  expect(food.status()).toBe(201);
  const foodId = (await food.json()).id;
  const dialog = page.getByRole("dialog");
  for (const [action, path] of [
    ["Log water", "water-entries"],
    ["Log weight", "weight-entries"],
    ["Log food", "food-entries"],
    ["Log cardio", "cardio-activities"],
    ["Start workout", "strength-workouts"],
  ]) {
    await page
      .getByRole("button", { name: "Calendar tools", exact: true })
      .click();
    await dialog.getByRole("button", { name: /^Quick actions/ }).click();
    await dialog.getByRole("button", { name: action, exact: true }).click();
    if (path === "weight-entries")
      await dialog.getByLabel(/^Weight \(/).fill("75");
    if (path === "food-entries")
      await dialog
        .getByLabel("Saved food", { exact: true })
        .selectOption(foodId);
    const response = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/api/v1/${path}`) &&
        r.request().method() === "POST" &&
        r.status() === 201,
    );
    await dialog.getByRole("button", { name: action, exact: true }).click();
    const record = await (await response).json();
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/view=day/);
    const notice = page.locator(".calendar-notice");
    await expect(
      notice.getByRole("button", { name: "Undo", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".calendar-interactions")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    await page.keyboard.press("Control+z");
    await expect
      .poll(async () =>
        (await page.request.get(`/api/v1/${path}/${record.id}`)).status(),
      )
      .toBe(404);
    expect(
      (
        await (
          await page.request.get(
            "/api/v1/calendar/activity?from=2026-09-07&to=2026-09-07",
          )
        ).json()
      ).entries,
    ).toHaveLength(0);
  }
});
