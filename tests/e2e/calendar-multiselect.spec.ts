import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("select several calendar plans without triggering a drag or single-plan action", async ({
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
          name: "Multi-select test",
          email: `multi-${randomUUID()}@example.com`,
          password: "Synthetic-calendar-password-123",
        },
      })
    ).status(),
  ).toBe(200);
  for (const [title, hour] of [
    ["Alpha plan", "15"],
    ["Beta plan", "17"],
    ["Gamma plan", "19"],
  ]) {
    expect(
      (
        await page.request.post("/api/v1/time-blocks", {
          headers: headers(),
          data: {
            title,
            startsAt: `2026-09-07T${hour}:00:00Z`,
            endsAt: `2026-09-07T${String(Number(hour) + 1).padStart(2, "0")}:00:00Z`,
          },
        })
      ).status(),
    ).toBe(201);
  }
  expect(
    (
      await page.request.post("/api/v1/calendar/items", {
        headers: headers(),
        data: {
          title: "Day marker",
          kind: "all_day",
          date: "2026-09-07",
          endDate: "2026-09-07",
        },
      })
    ).status(),
  ).toBe(201);

  await page.goto("/?date=2026-09-07&view=day");
  const grid = page.getByRole("region", { name: "Daily time grid" });
  const block = (title: string) =>
    grid.locator(".grid-record").getByRole("button", {
      name: new RegExp(`${title}.*planned`),
    });
  const allDay = grid.getByRole("button", {
    name: "Day marker, all day, 2026-09-07",
  });
  await block("Alpha plan").click();
  await expect(block("Alpha plan")).toHaveAttribute("aria-pressed", "true");
  await block("Beta plan").click({ modifiers: ["Meta"] });
  await expect(block("Alpha plan")).toHaveAttribute("aria-pressed", "true");
  await expect(block("Beta plan")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Meta+c");
  await expect(page.locator("[data-calendar-clipboard-status]")).toHaveText(
    "2 plans copied.",
  );
  await expect(page.locator(".app-toast")).toContainText("2 plans copied.");
  await expect(
    page.locator(".app-toast").getByRole("button", { name: "Undo" }),
  ).toHaveCount(0);
  await page.goto("/?date=2026-09-14&view=day");
  const destinationHeading = grid.getByRole("button", {
    name: "Select 2026-09-14",
  });
  await expect(destinationHeading).toBeVisible();
  await page.keyboard.press("Meta+v");
  await expect(page.locator("[data-calendar-clipboard-status]")).toHaveText(
    "Select the day heading or a five-minute time slice first.",
  );
  await destinationHeading.click();
  await page.keyboard.press("Meta+v");
  const paste = page.getByRole("dialog", { name: "Paste plans" });
  await expect(paste).toHaveCount(0);
  await expect(block("Alpha plan")).toBeVisible();
  const headingTime = await block("Alpha plan").getAttribute("aria-label");
  await page.keyboard.press("Meta+z");
  await expect(block("Alpha plan")).toHaveCount(0);
  await grid
    .getByRole("button", {
      name: "Select time on 2026-09-14 at 10:00",
    })
    .click({ position: { x: 20, y: 2 } });
  await page.keyboard.press("Meta+v");
  await expect(block("Alpha plan")).toBeVisible();
  expect(await block("Alpha plan").getAttribute("aria-label")).not.toEqual(
    headingTime,
  );
  await expect(block("Beta plan")).toBeVisible();
  await block("Alpha plan").click();
  await block("Beta plan").click({ modifiers: ["Meta"] });
  await page.keyboard.press("Delete");
  await expect(block("Alpha plan")).toHaveCount(0);
  await expect(block("Beta plan")).toHaveCount(0);
  await expect(page.locator(".app-toast")).toContainText("Plans deleted");
  await page
    .locator(".app-toast")
    .getByRole("button", { name: "Undo" })
    .click();
  await expect(block("Alpha plan")).toBeVisible();
  await expect(block("Beta plan")).toBeVisible();
  await page.keyboard.press("Meta+z");
  await expect(block("Alpha plan")).toHaveCount(0);
  await expect(block("Beta plan")).toHaveCount(0);

  await page.goto("/?date=2026-09-07&view=day");
  await block("Alpha plan").click();
  await block("Beta plan").click({ modifiers: ["Meta"] });
  await block("Beta plan").click({ modifiers: ["Meta"] });
  await expect(block("Beta plan")).toHaveAttribute("aria-pressed", "false");
  await block("Alpha plan").click();
  await block("Gamma plan").click({ modifiers: ["Shift"] });
  for (const title of ["Alpha plan", "Beta plan", "Gamma plan"])
    await expect(block(title)).toHaveAttribute("aria-pressed", "true");
  await allDay.click({ modifiers: ["Meta"] });
  await expect(allDay).toHaveAttribute("aria-pressed", "true");
  await block("Beta plan").click();
  await expect(block("Beta plan")).toHaveAttribute("aria-pressed", "true");
  await expect(block("Alpha plan")).toHaveAttribute("aria-pressed", "false");
  await expect(allDay).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("Escape");
  await expect(block("Beta plan")).toHaveAttribute("aria-pressed", "false");
  await block("Gamma plan").click({ modifiers: ["Shift"] });
  await expect(block("Gamma plan")).toHaveAttribute("aria-pressed", "true");
  await expect(block("Beta plan")).toHaveAttribute("aria-pressed", "false");
  await allDay.click();
  await block("Gamma plan").click({ modifiers: ["Shift"] });
  await expect(allDay).toHaveAttribute("aria-pressed", "true");
  for (const title of ["Alpha plan", "Beta plan", "Gamma plan"])
    await expect(block(title)).toHaveAttribute("aria-pressed", "true");

  await page.keyboard.press("Meta+c");
  await page.goto("/?date=2026-09-21&view=month");
  const targetDay = page
    .getByRole("region", { name: "Monthly calendar" })
    .locator('[data-date="2026-09-21"] .month-select-day');
  const targetBounds = await targetDay.boundingBox();
  expect(targetBounds).toBeTruthy();
  await targetDay.click({ position: { x: targetBounds!.width - 7, y: 7 } });
  await page.keyboard.press("Meta+v");
  await expect(paste).toHaveCount(0);
  await expect(targetDay).toHaveAttribute(
    "aria-label",
    "Select 2026-09-21, 4 records",
  );
  await page.keyboard.press("Meta+z");
  await expect(targetDay).toHaveAttribute(
    "aria-label",
    "Select 2026-09-21, 0 records",
  );

  await page.goto("/?date=2026-09-28&view=week");
  const destinationWeek = page.getByRole("region", {
    name: "Weekly time grid",
  });
  await destinationWeek
    .getByRole("button", { name: "Select 2026-09-28" })
    .click();
  await page.keyboard.press("Meta+v");
  await expect(paste).toHaveCount(0);
  await expect(
    destinationWeek.locator(".grid-record").getByRole("button", {
      name: /Alpha plan.*planned/,
    }),
  ).toBeVisible();
  await page.keyboard.press("Meta+z");

  await page.goto("/?date=2026-09-07&view=week");
  const week = page.getByRole("region", { name: "Weekly time grid" });
  const weekHeading = week.getByRole("button", {
    name: "Select 2026-09-07",
  });
  const weekBlock = (title: string) =>
    week.locator(".grid-record").getByRole("button", {
      name: new RegExp(`${title}.*planned`),
    });
  await weekHeading.click();
  await expect(weekHeading).toHaveAttribute("aria-pressed", "true");
  await weekBlock("Alpha plan").click();
  await expect(weekHeading).toHaveAttribute("aria-pressed", "false");
  await weekHeading.click();
  await expect(weekHeading).toHaveAttribute("aria-pressed", "true");
  await week
    .getByRole("button", { name: "Select time on 2026-09-07 at 10:00" })
    .click({ position: { x: 20, y: 2 } });
  await expect(weekHeading).toHaveAttribute("aria-pressed", "false");
  await weekBlock("Alpha plan").click();
  await weekBlock("Beta plan").click({ modifiers: ["Meta"] });
  await expect(weekBlock("Alpha plan")).toHaveAttribute("aria-pressed", "true");
  await expect(weekBlock("Beta plan")).toHaveAttribute("aria-pressed", "true");
  await weekBlock("Alpha plan").click();
  await page.keyboard.press("Meta+c");
  await page.goto("/?date=2026-09-28&view=week");
  await destinationWeek
    .getByRole("button", { name: "Select 2026-09-28" })
    .click();
  await page.keyboard.press("Meta+v");
  await expect(
    destinationWeek.locator(".grid-record").getByRole("button", {
      name: /Alpha plan.*planned/,
    }),
  ).toBeVisible();
  await page.keyboard.press("Meta+z");

  await page.goto("/?date=2026-09-07&view=day");
  await allDay.click();
  await block("Gamma plan").click({ modifiers: ["Shift"] });
  await page.keyboard.press("Delete");
  for (const title of ["Alpha plan", "Beta plan", "Gamma plan"])
    await expect(block(title)).toHaveCount(0);
  await expect(allDay).toHaveCount(0);
  await page.keyboard.press("Meta+z");
  for (const title of ["Alpha plan", "Beta plan", "Gamma plan"])
    await expect(block(title)).toBeVisible();
  await expect(allDay).toBeVisible();
});
