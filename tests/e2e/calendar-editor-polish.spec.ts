import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import {
  fillCalendarField,
  expectCalendarField,
  openCalendarEditorActions,
  clickCalendarEditorAction,
} from "./helpers/calendar-form";
test.use({ actionTimeout: 10000 });
const headers = () => ({
  Origin: "http://localhost:3100",
  "Idempotency-Key": randomUUID(),
});
async function start(page: Page) {
  expect(
    (
      await page.request.post("/api/__test/register", {
        headers: headers(),
        data: {
          name: "Calendar editor",
          email: `editor-${randomUUID()}@example.com`,
          password: "Synthetic-calendar-password-123",
        },
      })
    ).ok(),
  ).toBe(true);
  const response = await page.request.post("/api/v1/time-blocks", {
    headers: headers(),
    data: {
      title: "Saved plan",
      notes: "Original notes",
      startsAt: "2026-09-07T09:00:00Z",
      endsAt: "2026-09-07T10:00:00Z",
    },
  });
  expect(response.status()).toBe(201);
  const original = await response.json();
  await page.goto("/?date=2026-09-07&view=day");
  await expect(page.locator(".calendar-interactions")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page
    .getByRole("region", { name: "Daily time grid" })
    .getByRole("button", { name: /Saved plan.*planned/ })
    .dblclick();
  return {
    original,
    editor: page.getByRole("dialog", { name: "Edit plan", exact: true }),
  };
}

test("saved plans use the compact shared fields, header actions and bottom save/retry", async ({
  page,
}, info) => {
  if (info.project.name === "phone")
    await page.setViewportSize({ width: 320, height: 740 });
  const { original, editor } = await start(page);
  await expect(editor.getByLabel("Notes (optional)")).toBeVisible();
  await expect(editor.getByText("More details", { exact: true })).toHaveCount(
    0,
  );
  await expect(editor.locator('input[type="datetime-local"]')).toHaveCount(0);
  await openCalendarEditorActions(editor);
  await expect(
    editor.getByRole("menuitem", { name: "Delete plan", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(editor).toBeVisible();
  await expect(editor.getByRole("menu")).toHaveCount(0);
  await editor.getByLabel("Title", { exact: true }).fill("Changed plan");
  await editor.getByLabel("Notes (optional)").fill("Updated visible notes");
  await fillCalendarField(editor, "Start", "2026-09-07T17:45");
  await expectCalendarField(editor, "End", "2026-09-07T18:45");
  const footer = await editor.locator(".form-footer").boundingBox();
  const body = await editor.locator(".form-scroll-body").boundingBox();
  const panel = await editor.boundingBox();
  expect(body!.y + body!.height).toBeLessThanOrEqual(footer!.y + 1);
  expect(footer!.y + footer!.height).toBeGreaterThanOrEqual(
    panel!.y + panel!.height - 20,
  );
  expect(panel!.x + panel!.width).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  expect(
    (await new AxeBuilder({ page }).include(".calendar-event-editor").analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({ path: info.outputPath("saved-plan-editor.png") });
  const keys: string[] = [];
  await page.route(`**/api/v1/time-blocks/${original.id}`, async (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    keys.push(route.request().headers()["idempotency-key"]!);
    if (keys.length === 1) {
      expect((await route.fetch()).ok()).toBe(true);
      await route.abort("failed");
    } else await route.continue();
  });
  await editor.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    editor.getByRole("button", { name: "Plan actions", exact: true }),
  ).toBeDisabled();
  await expect(
    editor.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeDisabled();
  await editor.getByRole("button", { name: "Retry save", exact: true }).click();
  await expect(editor).toHaveCount(0);
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  const saved = await (
    await page.request.get(`/api/v1/time-blocks/${original.id}`)
  ).json();
  expect(saved).toMatchObject({
    title: "Changed plan",
    notes: "Updated visible notes",
    startsAt: "2026-09-07T17:45:00.000Z",
    endsAt: "2026-09-07T18:45:00.000Z",
    version: original.version + 1,
  });
});

test("cancel preserves the record and duplicate/delete remain independent undoable actions", async ({
  page,
}) => {
  const { original, editor } = await start(page);
  await editor.getByLabel("Notes (optional)").fill("Cancelled notes");
  await editor.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(editor).toHaveCount(0);
  expect(
    (
      await (
        await page.request.get(`/api/v1/time-blocks/${original.id}`)
      ).json()
    ).notes,
  ).toBe("Original notes");
  const originalButton = page
    .getByRole("region", { name: "Daily time grid" })
    .getByRole("button", { name: /Saved plan.*planned/ });
  await originalButton.dblclick();
  await openCalendarEditorActions(editor);
  await clickCalendarEditorAction(editor, "Duplicate");
  const duplicate = page.getByRole("dialog", {
    name: "Duplicate plan",
    exact: true,
  });
  await expect(duplicate.getByLabel("Notes (optional)")).toHaveValue(
    "Original notes",
  );
  await expect(
    duplicate.getByRole("button", { name: "Start date", exact: true }),
  ).toHaveText("Sep 8, 2026");
  await duplicate.getByLabel("Title", { exact: true }).fill("Copied plan");
  await duplicate.getByRole("button", { name: "Save", exact: true }).click();
  await expect(duplicate).toHaveCount(0);
  await page.goto("/?date=2026-09-07&view=day");
  await expect(page.locator(".calendar-interactions")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await originalButton.dblclick();
  await openCalendarEditorActions(editor);
  await clickCalendarEditorAction(editor, "Delete plan");
  await expect(editor).toHaveCount(0);
  await expect(originalButton).toHaveCount(0);
  await expect(page.locator(".calendar-interactions")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.keyboard.press("Meta+z");
  await expect(originalButton).toBeVisible();
  const week = await (
    await page.request.get("/api/v1/weeks/2026-09-07")
  ).json();
  expect(week.blocks).toHaveLength(2);
});
