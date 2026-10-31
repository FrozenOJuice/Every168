import {
  fillCalendarField,
  openCalendarEditorActions,
  selectCalendarChoice,
} from "./helpers/calendar-form";
import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("templates and keyboard copying work without the Copy plans form", async ({
  page,
}) => {
  const headers = () => ({
    Origin: "http://localhost:3100",
    "Idempotency-Key": randomUUID(),
  });
  expect(
    (
      await page.request.post("/api/__test/register", {
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
    await page.getByRole("button", { name: "Actions", exact: true }).click();
    await expect(
      page.getByRole("menuitem", { name: "Calendar tools…", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("menuitem", { name: name + "…", exact: true }).click();
  }
  const dayGrid = page.getByRole("region", { name: "Daily time grid" });
  await tool("Templates");
  await dialog
    .getByRole("button", { name: "Save calendar as template" })
    .click();
  await dialog.getByLabel("Template name").fill("Shift pattern");
  await selectCalendarChoice(dialog, "Save", "range");
  await fillCalendarField(dialog, "Source date", "2026-09-07");
  await fillCalendarField(dialog, "Through", "2026-09-10");
  await dialog.getByRole("button", { name: "Save template" }).click();
  await expect(dialog).toContainText("4-day template");
  await dialog.getByRole("button", { name: "Use template" }).click();
  await fillCalendarField(dialog, "Apply to date", "2026-10-05");
  await dialog.getByLabel("Cycles").fill("2");
  await dialog.getByRole("button", { name: "Preview template" }).click();
  await expect(dialog).toContainText("4 plans will be added");
  const applyKeys: string[] = [];
  await page.route("**/api/v1/calendar/templates/*/apply", async (route) => {
    applyKeys.push(route.request().headers()["idempotency-key"]!);
    if (applyKeys.length === 1) {
      expect((await route.fetch()).ok()).toBe(true);
      await route.abort("failed");
    } else await route.continue();
  });
  await dialog.getByRole("button", { name: "Apply template" }).click();
  await expect(
    dialog.getByRole("button", { name: "Back", exact: true }),
  ).toBeDisabled();
  await dialog
    .getByRole("button", { name: "Retry same change", exact: true })
    .click();
  expect(applyKeys).toHaveLength(2);
  expect(applyKeys[0]).toBe(applyKeys[1]);
  await expect(page).toHaveURL(/date=2026-10-05/);
  await expect(page.locator(".app-toast")).toContainText("Template applied");
  const applied = (
    await (await page.request.get("/api/v1/weeks/2026-10-05")).json()
  ).blocks;
  expect(applied).toHaveLength(4);
  // Template undo survives refresh and restores the same plans through redo.
  await page.reload();
  await expect(page.locator(".calendar-interactions")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.keyboard.press("Meta+z");
  await expect(
    dayGrid.getByRole("button", { name: /Work day one.*planned/ }),
  ).toHaveCount(0);
  await expect
    .poll(
      async () =>
        (await (await page.request.get("/api/v1/weeks/2026-10-05")).json())
          .blocks.length,
    )
    .toBe(0);
  expect(
    (await (await page.request.get("/api/v1/weeks/2026-10-12")).json()).blocks,
  ).toHaveLength(0);
  await expect(page.locator(".calendar-interactions")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.reload();
  await expect(page.locator(".calendar-interactions")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.keyboard.press("Meta+Shift+z");
  await expect
    .poll(
      async () =>
        (await (await page.request.get("/api/v1/weeks/2026-10-05")).json())
          .blocks.length,
    )
    .toBe(4);
  expect(
    (await (await page.request.get("/api/v1/weeks/2026-10-05")).json()).blocks
      .map((b: { id: string }) => b.id)
      .sort(),
  ).toEqual(applied.map((b: { id: string }) => b.id).sort());
  await page.goto("/?date=2026-09-07&view=day");
  await page
    .getByRole("region", { name: "Daily time grid" })
    .getByRole("button", { name: /Work day one.*planned/ })
    .dblclick();
  await openCalendarEditorActions(dialog);
  await expect(dialog.getByRole("button", { name: "Copy…" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  expect(
    (
      await page.request.post("/api/v1/calendar/items", {
        headers: headers(),
        data: {
          title: "Conference",
          kind: "all_day",
          date: "2026-09-07",
          endDate: "2026-09-07",
        },
      })
    ).status(),
  ).toBe(201);
  await page.goto("/?date=2026-09-07&view=day");
  await dayGrid
    .getByRole("button", { name: "Conference, all day, 2026-09-07" })
    .dblclick();
  await expect(dialog.getByRole("button", { name: "Copy…" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  const conference = dayGrid.getByRole("button", {
    name: "Conference, all day, 2026-09-07",
  });
  await conference.click();
  await expect(conference).toHaveAttribute("aria-pressed", "true");
  await expect(conference).toHaveClass(/date-selected/);
  await page.keyboard.press("Meta+c");
  await page.goto("/?date=2026-10-01&view=month");
  const monthDay = page
    .getByRole("region", { name: "Monthly calendar" })
    .locator('[data-date="2026-10-14"] .month-select-day');
  const monthDayBounds = await monthDay.boundingBox();
  expect(monthDayBounds).toBeTruthy();
  await monthDay.click({
    position: { x: monthDayBounds!.width - 7, y: 7 },
  });
  await page.keyboard.press("Meta+v");
  const pasteDialog = page.getByRole("dialog", { name: "Paste plans" });
  await expect(pasteDialog).toHaveCount(0);
  await expect(monthDay).toHaveAttribute(
    "aria-label",
    "Select 2026-10-14, 1 records",
  );
  await page.keyboard.press("Meta+z");
  await page.goto("/?date=2026-10-14&view=day");
  await expect(
    dayGrid.getByRole("button", { name: "Conference, all day, 2026-10-14" }),
  ).toHaveCount(0);

  await page.goto("/?date=2026-10-15&view=day");
  const destinationHeading = dayGrid.getByRole("button", {
    name: "Select 2026-10-15",
  });
  await expect(destinationHeading).toBeVisible();
  await page.keyboard.press("Meta+v");
  await expect(page.locator("[data-calendar-clipboard-status]")).toHaveText(
    "Select the day heading before pasting.",
  );
  await destinationHeading.click();
  await page.keyboard.press("Meta+v");
  await expect(pasteDialog).toHaveCount(0);
  await expect(
    dayGrid.getByRole("button", { name: "Conference, all day, 2026-10-15" }),
  ).toBeVisible();
  await page.keyboard.press("Meta+z");
  await expect(
    dayGrid.getByRole("button", { name: "Conference, all day, 2026-10-15" }),
  ).toHaveCount(0);
});
