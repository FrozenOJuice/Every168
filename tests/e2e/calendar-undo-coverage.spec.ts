import { saveCalendarPlan } from "./helpers/calendar-form";
import {
  fillCalendarField,
  selectCalendarRepeat,
  showCalendarNotes,
} from "./helpers/calendar-form";
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
  await fillCalendarField(dialog, "Last day", "2026-09-09");
  await showCalendarNotes(dialog);
  await dialog
    .getByLabel("Notes (optional)")
    .fill("Remember the prior details");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
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
  await fillCalendarField(dialog, "Start", "2026-09-07T09:00");
  await fillCalendarField(dialog, "End", "2026-09-07T10:00");
  await selectCalendarRepeat(dialog, "daily");
  await fillCalendarField(dialog, "Repeat through", "2026-09-09");
  await saveCalendarPlan(dialog);
  await expect(plan("Original series")).toBeVisible();
  await plan("Original series").dblclick();
  await dialog
    .getByLabel("Title", { exact: true })
    .fill("Individual exception");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(plan("Individual exception")).toBeVisible();
  await plan("Individual exception").dblclick();
  await dialog
    .getByRole("button", { name: "Edit repeating rule", exact: true })
    .click();
  await dialog.getByLabel("Replace individual edits", { exact: true }).check();
  await dialog.getByLabel("Title", { exact: true }).fill("Revised series");
  await fillCalendarField(dialog, "Repeat through", "2026-09-08");
  await dialog
    .getByRole("button", { name: "Save entire series", exact: true })
    .click();
  await expect(plan("Revised series")).toBeVisible();
  await plan("Revised series").dblclick();
  await dialog
    .getByRole("button", { name: "Edit repeating rule", exact: true })
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
  const dialog = page.getByRole("dialog");
  for (const [action, path] of [
    ["Log water", "water-entries"],
    ["Log weight", "weight-entries"],
  ]) {
    await page.getByRole("button", { name: "Actions", exact: true }).click();
    await page
      .getByRole("menuitem", { name: "Calendar tools…", exact: true })
      .click();
    await dialog.getByRole("button", { name: /^Quick actions/ }).click();
    await dialog.getByRole("button", { name: action, exact: true }).click();
    if (path === "weight-entries")
      await dialog.getByLabel(/^Weight \(/).fill("75");
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
    const notice = page.locator(".app-toast");
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
