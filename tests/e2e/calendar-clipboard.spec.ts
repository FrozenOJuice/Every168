import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("copy selected days with gaps and paste one block at a selected time", async ({
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
          name: "Clipboard test",
          email: `clip-${randomUUID()}@example.com`,
          password: "Synthetic-calendar-password-123",
        },
      })
    ).status(),
  ).toBe(200);
  for (const [title, day] of [
    ["Monday shift", "07"],
    ["Thursday shift", "10"],
    ["Existing target", "15"],
  ]) {
    expect(
      (
        await page.request.post("/api/v1/time-blocks", {
          headers: headers(),
          data: {
            title,
            startsAt: `2026-09-${day}T15:00:00Z`,
            endsAt: `2026-09-${day}T16:00:00Z`,
          },
        })
      ).status(),
    ).toBe(201);
  }
  await page.goto("/?date=2026-09-07&view=month");
  const month = page.getByRole("region", { name: "Monthly calendar" });
  const day = (date: string) =>
    month.locator(`[data-date="${date}"] .month-select-day`);
  async function clickDay(date: string, modifiers: ("Meta" | "Shift")[] = []) {
    const bounds = await day(date).boundingBox();
    expect(bounds).toBeTruthy();
    await day(date).click({
      modifiers,
      position: { x: bounds!.width - 7, y: 7 },
    });
  }
  await clickDay("2026-09-07");
  await clickDay("2026-09-10", ["Meta"]);
  await expect(day("2026-09-07")).toHaveAttribute("aria-pressed", "true");
  await expect(day("2026-09-10")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Meta+c");
  await clickDay("2026-09-15");
  await page.keyboard.press("Meta+v");
  const dialog = page.getByRole("dialog", { name: "Paste plans" });
  await expect(dialog).toContainText("2 plans will be added");
  await expect(dialog).toContainText("2026-09-15");
  await expect(dialog).toContainText("2026-09-18");
  await dialog.getByRole("button", { name: "Paste plans" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(day("2026-09-15")).toHaveAttribute(
    "aria-label",
    "Select 2026-09-15, 2 records",
  );
  await expect(day("2026-09-18")).toHaveAttribute(
    "aria-label",
    "Select 2026-09-18, 1 records",
  );
  if (testInfo.project.name !== "phone") {
    await expect(month.locator('[data-date="2026-09-15"]')).toContainText(
      "Monday shift",
    );
    await expect(month.locator('[data-date="2026-09-15"]')).toContainText(
      "Existing target",
    );
  }
  await page.keyboard.press("Meta+z");
  await expect(day("2026-09-15")).toHaveAttribute(
    "aria-label",
    "Select 2026-09-15, 1 records",
  );
  await expect(day("2026-09-18")).toHaveAttribute(
    "aria-label",
    "Select 2026-09-18, 0 records",
  );

  await clickDay("2026-09-07");
  await clickDay("2026-09-10", ["Shift"]);
  for (const date of ["07", "08", "09", "10"])
    await expect(day(`2026-09-${date}`)).toHaveAttribute(
      "aria-pressed",
      "true",
    );

  const first = await day("2026-09-20").boundingBox();
  const last = await day("2026-09-22").boundingBox();
  expect(first && last).toBeTruthy();
  await page.mouse.move(
    first!.x + first!.width / 2,
    first!.y + first!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(last!.x + last!.width / 2, last!.y + last!.height / 2, {
    steps: 8,
  });
  await page.mouse.up();
  for (const date of ["20", "21", "22"])
    await expect(day(`2026-09-${date}`)).toHaveAttribute(
      "aria-pressed",
      "true",
    );

  await page.goto("/?date=2026-09-07&view=week");
  const weekDay = page.getByRole("button", { name: "Select 2026-09-08" });
  await weekDay.click();
  await expect(weekDay).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/view=week/);
  await weekDay.dblclick();
  await expect(page).toHaveURL(/date=2026-09-08&view=day/);

  await page.goto("/?date=2026-09-07&view=day");
  const grid = page.getByRole("region", { name: "Daily time grid" });
  await grid.getByRole("button", { name: /Monday shift.*planned/ }).click();
  await page.keyboard.press("Meta+c");
  await page.goto("/?date=2026-09-07&view=month");
  await clickDay("2026-09-07");
  await page.keyboard.press("Meta+v");
  await expect(page.locator("[data-calendar-clipboard-status]")).toContainText(
    "Nothing pasted",
  );
  await page.goto("/?date=2026-09-16&view=day");
  await grid
    .getByRole("button", { name: "Select time on 2026-09-16 at 10:00" })
    .click({ position: { x: 20, y: 11 } });
  await expect(page.locator("[data-selected-time]")).toHaveAttribute(
    "data-selected-time",
    "2026-09-16T10:10",
  );
  await page.keyboard.press("Meta+v");
  await expect(
    grid.getByRole("button", { name: /Monday shift.*planned/ }),
  ).toBeVisible();
  await page.keyboard.press("Meta+z");
  await expect(
    grid.getByRole("button", { name: /Monday shift.*planned/ }),
  ).toHaveCount(0);
});
