import { test, expect, type Page, type Locator } from "@playwright/test";
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import {
  fillCalendarField,
  selectCalendarChoice,
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
          name: "Calendar secondary forms",
          email: `secondary-${randomUUID()}@example.com`,
          password: "Synthetic-calendar-password-123",
        },
      })
    ).ok(),
  ).toBe(true);
  for (const [title, date] of [
    ["Study", "2026-09-07"],
    ["Study", "2026-09-08"],
    ["Study", "2026-09-09"],
  ]) {
    expect(
      (
        await page.request.post("/api/v1/time-blocks", {
          headers: headers(),
          data: {
            title,
            startsAt: `${date}T09:00:00Z`,
            endsAt: `${date}T10:00:00Z`,
          },
        })
      ).ok(),
    ).toBe(true);
  }
  await page.goto("/?date=2026-09-07&view=day");
  await expect(page.locator(".calendar-interactions")).toHaveAttribute(
    "aria-busy",
    "false",
  );
}
async function audit(page: Page, panel: Locator) {
  expect(
    (
      await new AxeBuilder({ page })
        .include(
          await panel.evaluate(
            (element) =>
              "." +
              (element.classList.contains("calendar-template-dialog")
                ? "calendar-template-dialog"
                : "calendar-search-popover"),
          ),
        )
        .analyze()
    ).violations,
  ).toEqual([]);
  const box = await panel.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
}

test("template review keeps apply settings and lists dated plans in a scrollable frame", async ({
  page,
}, info) => {
  if (info.project.name === "phone")
    await page.setViewportSize({ width: 320, height: 740 });
  await start(page);
  await page.getByRole("button", { name: "Actions", exact: true }).click();
  await page.getByRole("menuitem", { name: "Templates…", exact: true }).click();
  const dialog = page.locator("dialog.calendar-template-dialog");
  await dialog
    .getByRole("button", { name: "Save calendar as template", exact: true })
    .click();
  await dialog.getByLabel("Template name").fill("Study pattern");
  await selectCalendarChoice(dialog, "Save", "range");
  await fillCalendarField(dialog, "Through", "2026-09-09");
  await dialog
    .getByRole("button", { name: "Save template", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Use template", exact: true })
    .click();
  await fillCalendarField(dialog, "Apply to date", "2026-10-05");
  await dialog.getByLabel("Cycles", { exact: true }).fill("2");
  await dialog
    .getByRole("button", { name: "Preview template", exact: true })
    .click();
  await expect(dialog).toContainText("6 plans will be added");
  await expect(dialog.locator(".calendar-template-preview-day")).toHaveCount(6);
  await audit(page, dialog);
  await page.screenshot({ path: info.outputPath("template-review.png") });
  await dialog.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Apply to date", exact: true }),
  ).toHaveText("Oct 5, 2026");
  await expect(dialog.getByLabel("Cycles", { exact: true })).toHaveValue("2");
  await dialog
    .getByRole("button", { name: "Back to templates", exact: true })
    .click();
  await dialog
    .getByRole("button", {
      name: "Template actions for Study pattern",
      exact: true,
    })
    .click();
  await expect(
    dialog.getByRole("menuitem", { name: "Rename", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(
    (await (await page.request.get("/api/v1/weeks/2026-10-05")).json()).blocks,
  ).toHaveLength(0);
});

test("search dates use clearable shared pickers and Escape closes the picker first", async ({
  page,
}, info) => {
  if (info.project.name === "phone")
    await page.setViewportSize({ width: 320, height: 740 });
  await start(page);
  await page
    .getByRole("button", { name: "Search and filter calendar", exact: true })
    .click();
  const search = page.getByRole("dialog", {
    name: "Search calendar",
    exact: true,
  });
  await search.getByLabel("Title contains").fill("Study");
  await search.getByRole("button", { name: "Date range", exact: true }).click();
  await fillCalendarField(search, "From (optional)", "2026-09-08");
  await fillCalendarField(search, "Through (optional)", "2026-09-09");
  await search
    .getByRole("button", { name: "From (optional)", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(search).toBeVisible();
  await expect(
    search.getByRole("dialog", { name: "Choose day", exact: true }),
  ).toHaveCount(0);
  await search
    .getByRole("button", { name: "Search all dates", exact: true })
    .click();
  await expect(search.locator(".search-results li")).toHaveCount(2);
  await audit(page, search);
  await page.screenshot({ path: info.outputPath("calendar-search.png") });
  await search.getByRole("button", { name: "Clear from", exact: true }).click();
  await search
    .getByRole("button", { name: "Clear through", exact: true })
    .click();
  await expect(
    search.getByRole("button", { name: "From (optional)", exact: true }),
  ).toHaveText("Choose date");
  await search
    .getByRole("button", { name: "Search all dates", exact: true })
    .click();
  await expect(search.locator(".search-results li")).toHaveCount(3);
  await fillCalendarField(search, "From (optional)", "2026-09-09");
  await fillCalendarField(search, "Through (optional)", "2026-09-08");
  await search.getByRole("button", { name: "Date range", exact: true }).click();
  await search
    .getByRole("button", { name: "Search all dates", exact: true })
    .click();
  await expect(
    search.getByRole("button", { name: "Through (optional)", exact: true }),
  ).toBeVisible();
  await expect(search.getByRole("alert")).toContainText(
    "End date must follow start date.",
  );
  await search
    .getByRole("button", { name: "Filter visible calendar", exact: true })
    .click();
  await expect(search).toHaveCount(0);
});
