import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { Block, Week } from "@168hours/contracts";

test("calendar routines, date-only plans, reuse, search, quick actions and adjustments work together", async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  const headers = () => ({
    Origin: "http://localhost:3100",
    "Idempotency-Key": randomUUID(),
  });
  expect(
    (
      await page.request.post("/api/auth/sign-up/email", {
        headers: headers(),
        data: {
          name: "Calendar expansion",
          email: `expansion-${randomUUID()}@example.com`,
          password: "Synthetic-calendar-password-123",
        },
      })
    ).status(),
  ).toBe(200);
  const me = await (await page.request.get("/api/v1/me")).json();
  expect(
    (
      await page.request.put("/api/v1/preferences", {
        headers: { ...headers(), "If-Match": `"${me.preferences.version}"` },
        data: {
          timezone: "America/Edmonton",
          weekStartsOn: 1,
          weightUnit: "kg",
          distanceUnit: "km",
        },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await page.request.post("/api/v1/time-blocks", {
        headers: headers(),
        data: {
          title: "Drag me",
          startsAt: "2026-09-07T15:00:00Z",
          endsAt: "2026-09-07T16:00:00Z",
        },
      })
    ).status(),
  ).toBe(201);
  await page.goto("/?date=2026-09-07&view=day");
  const day = page.getByRole("region", { name: "Daily time grid" });
  await expect(day).toBeVisible();
  const dialog = page.getByRole("dialog");
  async function tool(name: string) {
    await page
      .getByRole("button", { name: "Calendar tools", exact: true })
      .click();
    await dialog.getByRole("button", { name: new RegExp("^" + name) }).click();
  }
  async function close() {
    await dialog
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
  }
  async function audit(name: string) {
    await expect(page).toHaveTitle("168Hours");
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(name + ".png"),
      fullPage: true,
    });
  }
  await tool("Add all-day plan");
  await page.getByLabel("Title", { exact: true }).fill("Conference");
  await page.getByLabel("Last day (inclusive)").fill("2026-09-08");
  await dialog
    .getByRole("button", { name: "Create plan", exact: true })
    .click();
  await expect(
    day.getByRole("button", { name: /Conference, all day/ }),
  ).toBeVisible();
  await tool("Add unscheduled plan");
  await page.getByLabel("Title", { exact: true }).fill("Read paper");
  await dialog
    .getByRole("button", { name: "Create plan", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await tool("Unscheduled plans");
  await dialog.getByRole("button", { name: /Read paper, unscheduled/ }).click();
  await dialog.getByRole("button", { name: "Schedule as time block" }).click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "Read paper",
  );
  await page.getByLabel("Start", { exact: true }).fill("2026-09-07T14:00");
  await dialog
    .getByRole("button", { name: "Create block", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(
    (await (await page.request.get("/api/v1/calendar/backlog")).json()).items,
  ).toHaveLength(0);
  await tool("Add repeating plan");
  await page.getByLabel("Title", { exact: true }).fill("Training routine");
  await page.getByLabel("Repeat through").fill("2026-09-11");
  await page.getByLabel("Start time", { exact: true }).fill("13:00");
  await dialog
    .getByRole("group", { name: "Repeat on" })
    .getByRole("button", { name: "Wed" })
    .click();
  await dialog
    .getByRole("group", { name: "Repeat on" })
    .getByRole("button", { name: "Fri" })
    .click();
  await audit("recurring-form");
  await dialog
    .getByRole("button", { name: "Create repeating plan", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("3 occurrences saved");
  await day.getByRole("button", { name: /Training routine.*planned/ }).click();
  await dialog.getByRole("button", { name: "Edit entire series" }).click();
  await page.getByLabel("Duration (minutes)").fill("30");
  await dialog.getByRole("button", { name: "Save entire series" }).click();
  await expect(dialog).toHaveCount(0);
  await tool("Copy and templates");
  await page.getByLabel("Copy", { exact: true }).selectOption("day");
  await page.getByLabel("Copy to").fill("2026-09-14");
  await dialog.getByRole("button", { name: "Preview copy" }).click();
  await expect(dialog).toContainText("4 plans will be added");
  await audit("copy-preview");
  await dialog.getByRole("button", { name: "Add these plans" }).click();
  await expect(page).toHaveURL(/date=2026-09-14/);
  await tool("Copy and templates");
  await dialog.getByRole("button", { name: "Templates", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Save calendar as template" })
    .click();
  await page.getByLabel("Template name").fill("Study day");
  await page.getByLabel("Save", { exact: true }).selectOption("day");
  await dialog
    .getByRole("button", { name: "Save template", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Use template" }).click();
  await page.getByLabel("Apply to date").fill("2026-09-21");
  await dialog.getByRole("button", { name: "Preview template" }).click();
  await dialog.getByRole("button", { name: "Add these plans" }).click();
  await expect(page).toHaveURL(/date=2026-09-21/);
  const week: Week = await (
    await page.request.get("/api/v1/weeks/2026-09-21")
  ).json();
  expect(week.blocks).toHaveLength(3);
  expect(week.entries).toHaveLength(0);
  await page
    .getByRole("button", { name: "Search and filter calendar" })
    .click();
  await page.getByLabel("Title contains").fill("Drag me");
  await page.getByLabel("Starts on or after (optional)").fill("2026-09-21");
  await dialog.getByRole("button", { name: "Search all dates" }).click();
  await expect(dialog.locator(".search-results li")).toHaveCount(1);
  await audit("calendar-search");
  await dialog.locator(".search-results button").click();
  await expect(page.getByLabel("Start", { exact: true })).toHaveValue(
    "2026-09-21T09:00",
  );
  await close();
  await page
    .getByRole("button", { name: "Search and filter calendar" })
    .click();
  await page.getByLabel("Title contains").fill("Training");
  await dialog.getByRole("button", { name: "Filter visible calendar" }).click();
  await expect(
    day.getByRole("button", { name: /Drag me.*planned/ }),
  ).toHaveCount(0);
  await page
    .locator(".calendar-status")
    .getByRole("button", { name: "Clear", exact: true })
    .click();
  await expect(
    day.getByRole("button", { name: /Drag me.*planned/ }),
  ).toHaveCount(1);
  await tool("Quick actions");
  await dialog.getByRole("button", { name: "Log water", exact: true }).click();
  await expect(page.getByLabel("Drank at")).toHaveValue("2026-09-21T12:00");
  await dialog.getByRole("button", { name: "Log water", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(
    (await (await page.request.get("/api/v1/water-entries")).json()).items,
  ).toHaveLength(1);
  await tool("Quick actions");
  await dialog.getByRole("button", { name: "Log cardio", exact: true }).click();
  await expect(page.getByLabel("Started at")).toHaveValue("2026-09-21T09:00");
  await close();
  await tool("Quick actions");
  await dialog
    .getByRole("button", { name: "Create goal", exact: true })
    .click();
  await expect(page.getByLabel("Target date (optional)")).toHaveValue(
    "2026-09-21",
  );
  await close();

  const original = week.blocks.find((b) => b.title === "Drag me")!;
  const record = () => day.getByRole("button", { name: /Drag me.*planned/ });
  const getBlock = async (): Promise<Block> =>
    (await page.request.get("/api/v1/time-blocks/" + original.id)).json();
  const touch = testInfo.project.name !== "desktop";
  async function drag(element: Locator, dy: number) {
    await expect(element).toBeVisible();
    await element.scrollIntoViewIfNeeded();
    const box = (await element.boundingBox())!;
    const x = box.x + box.width / 2,
      y = box.y + box.height / 2;
    if (touch) {
      const session = await page.context().newCDPSession(page);
      await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y }],
      });
      await session.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: y + dy }],
      });
      await session.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await session.detach();
    } else {
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x, y + dy, { steps: 4 });
      await page.mouse.up();
    }
  }
  if (touch) {
    await record().click();
    await dialog
      .getByRole("button", { name: "Move or resize on calendar" })
      .click();
    await expect(record()).toHaveClass(/drag-selected/);
  }
  let lost = false;
  const keys: string[] = [];
  await page.route("**/api/v1/time-blocks/" + original.id, async (route) => {
    if (route.request().method() === "PUT") {
      keys.push(route.request().headers()["idempotency-key"]!);
      if (!lost) {
        lost = true;
        expect((await route.fetch()).status()).toBe(200);
        await route.abort("failed");
        return;
      }
    }
    await route.continue();
  });
  await drag(record(), touch ? 36 : 72);
  await page.getByRole("button", { name: "Retry same change" }).click();
  await expect(
    page.getByRole("button", { name: "Retry same change" }),
  ).toHaveCount(0);
  expect(keys).toHaveLength(2);
  expect(keys[1]).toBe(keys[0]);
  await page.unroute("**/api/v1/time-blocks/" + original.id);
  const moved = await getBlock();
  expect(Date.parse(moved.endsAt) - Date.parse(moved.startsAt)).toBe(3600000);
  expect(Date.parse(moved.startsAt)).toBeGreaterThan(
    Date.parse(original.startsAt),
  );
  if (!touch) expect(moved.startsAt).toBe("2026-09-21T16:00:00.000Z");
  if (touch) {
    await page
      .getByRole("group", { name: "Adjust block" })
      .getByRole("button", { name: "Resize end", exact: true })
      .click();
    await drag(record(), 18);
  } else
    await drag(
      day
        .locator(".grid-record")
        .filter({ has: page.getByRole("button", { name: /Drag me.*planned/ }) })
        .locator(".resize-end"),
      18,
    );
  await expect
    .poll(async () => Date.parse((await getBlock()).endsAt))
    .toBeGreaterThan(Date.parse(moved.endsAt));
  if (!touch)
    expect(
      Date.parse((await getBlock()).endsAt) - Date.parse(moved.endsAt),
    ).toBe(900000);
  if (touch)
    await page
      .getByRole("group", { name: "Adjust block" })
      .getByRole("button", { name: "Done", exact: true })
      .click();
  if (!touch) {
    for (const cancellation of ["escape", "blur"]) {
      const beforeCancel = await getBlock();
      await record().evaluate((element) =>
        element.scrollIntoView({ block: "center", inline: "nearest" }),
      );
      const cancelled = (await record().boundingBox())!;
      await page.mouse.move(
        cancelled.x + cancelled.width / 2,
        cancelled.y + cancelled.height / 2,
      );
      await page.mouse.down();
      await page.mouse.move(
        cancelled.x + cancelled.width / 2,
        cancelled.y + cancelled.height / 2 + 36,
        { steps: 3 },
      );
      await expect(page.locator(".calendar-drag-label")).toBeVisible();
      if (cancellation === "escape") await page.keyboard.press("Escape");
      else await page.evaluate(() => window.dispatchEvent(new Event("blur")));
      await page.mouse.up();
      await expect(page.locator(".calendar-drag-label")).toHaveCount(0);
      expect((await getBlock()).version).toBe(beforeCancel.version);
    }
    const slot = day.getByRole("button", {
      name: "Add block on 2026-09-21 at 16:00",
      exact: true,
    });
    await slot.evaluate((element) =>
      element.scrollIntoView({ block: "center", inline: "nearest" }),
    );
    const box = (await slot.boundingBox())!;
    await page.mouse.move(box.x + 20, box.y + 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 20, box.y + 72, { steps: 4 });
    await page.mouse.up();
    await expect(page.getByLabel("Start", { exact: true })).toHaveValue(
      "2026-09-21T16:00",
    );
    await expect(page.getByLabel("End", { exact: true })).toHaveValue(
      "2026-09-21T17:00",
    );
    await close();
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page
      .getByRole("navigation", { name: "Calendar view" })
      .getByRole("link", { name: "Month", exact: true })
      .click();
    const month = page.getByRole("region", { name: "Monthly calendar" }),
      source = month
        .locator('[data-date="2026-09-21"]')
        .getByRole("button", { name: /Drag me.*planned/ }),
      target = month.locator('[data-date="2026-09-22"]');
    await expect(source).toBeVisible();
    const a = (await source.boundingBox())!,
      b = (await target.boundingBox())!;
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + 30, { steps: 5 });
    await page.mouse.up();
    await expect
      .poll(async () => (await getBlock()).startsAt.slice(0, 10))
      .toBe("2026-09-22");
  }
  await audit("calendar-expanded");
  if (!touch) {
    await page.setViewportSize({ width: 320, height: 740 });
    await page
      .getByRole("navigation", { name: "Calendar view" })
      .getByRole("link", { name: "Week", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "Weekly time grid" }),
    ).toBeVisible();
    for (const control of await page
      .locator(".calendar-toolbar")
      .getByRole("button")
      .all()) {
      const bounds = (await control.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
    }
    await audit("calendar-small-phone");
  }
});
