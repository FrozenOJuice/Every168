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
  await expect(dialog.getByLabel("Category", { exact: true })).toHaveCount(0);
  await expect(dialog.getByLabel("Goal (optional)")).toHaveCount(0);
  await expect(dialog.getByLabel("All day", { exact: true })).toBeChecked();
  await page.getByLabel("Title", { exact: true }).fill("Conference");
  await expect(dialog.getByLabel("Date", { exact: true })).toHaveValue(
    "2026-09-07",
  );
  await dialog.getByLabel("Spans multiple days").check();
  await page.getByLabel("Last day", { exact: true }).fill("2026-09-08");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    day.getByRole("button", { name: /Conference, all day/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Calendar tools" }).click();
  await expect(
    dialog.getByRole("button", { name: "Add unscheduled plan" }),
  ).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "Unscheduled plans" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("link", { name: "Unscheduled", exact: true }).click();
  await expect(page).toHaveURL(/\/unscheduled$/);
  await page.getByRole("button", { name: "Add plan" }).click();
  const itemEditor = page.getByRole("dialog", {
    name: "Add unscheduled plan",
  });
  await itemEditor.getByLabel("Title", { exact: true }).fill("Read paper");
  await itemEditor
    .getByRole("button", { name: "Create plan", exact: true })
    .click();
  await expect(itemEditor).toHaveCount(0);
  await audit("unscheduled-plans");
  await page.getByRole("button", { name: /Read paper, unscheduled/ }).click();
  await page
    .getByRole("dialog", { name: "Edit unscheduled plan" })
    .getByRole("button", { name: "Schedule as time block" })
    .click();
  const schedule = page.getByRole("dialog", { name: "Schedule plan" });
  await expect(schedule.getByLabel("Title", { exact: true })).toHaveValue(
    "Read paper",
  );
  await schedule.getByLabel("Start", { exact: true }).fill("2026-09-07T14:00");
  await schedule.getByLabel("End", { exact: true }).fill("2026-09-07T15:00");
  await schedule.getByRole("button", { name: "Create block" }).click();
  await expect(schedule).toHaveCount(0);
  await expect(page).toHaveURL(/date=2026-09-07&view=day/);
  expect(
    (await (await page.request.get("/api/v1/calendar/backlog")).json()).items,
  ).toHaveLength(0);
  await tool("Add repeating plan");
  await expect(dialog.getByLabel("Category", { exact: true })).toHaveCount(0);
  await expect(dialog.getByLabel("Goal (optional)")).toHaveCount(0);
  await page.getByLabel("Title", { exact: true }).fill("Training routine");
  await expect(page.getByLabel("Repeat", { exact: true })).toHaveValue(
    "weekly",
  );
  await page.getByLabel("Start", { exact: true }).fill("2026-09-07T13:00");
  await page.getByLabel("End", { exact: true }).fill("2026-09-07T14:00");
  await page.getByLabel("Repeat through").fill("2026-09-11");
  await dialog
    .getByRole("group", { name: "Repeat on" })
    .getByRole("button", { name: "Wed" })
    .click();
  await dialog
    .getByRole("group", { name: "Repeat on" })
    .getByRole("button", { name: "Fri" })
    .click();
  await expect(dialog.locator(".calendar-repeat-preview")).toContainText(
    "3 plans will be added",
  );
  await audit("recurring-form");
  await dialog
    .getByRole("button", { name: "Create repeating plan", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("3 occurrences saved");
  await day
    .getByRole("button", { name: /Training routine.*planned/ })
    .dblclick();
  await dialog.getByRole("button", { name: "Edit repeating rule" }).click();
  await page.getByLabel("Duration (minutes)").fill("30");
  await dialog.getByRole("button", { name: "Save entire series" }).click();
  await expect(dialog).toHaveCount(0);
  await day
    .getByRole("button", { name: "Select 2026-09-07", exact: true })
    .click();
  await page.keyboard.press("Meta+c");
  await expect(page.locator(".calendar-notice")).toContainText("1 day copied.");
  await page.goto("/?date=2026-09-14&view=day");
  await day
    .getByRole("button", { name: "Select 2026-09-14", exact: true })
    .click();
  await page.keyboard.press("Meta+v");
  await expect(page.locator(".calendar-notice")).toContainText("Plans pasted");
  await tool("Templates");
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
  const searchButton = page.getByRole("button", {
    name: "Search and filter calendar",
  });
  await searchButton.click();
  await expect(dialog).toHaveAttribute("aria-modal", "false");
  await expect(searchButton).toHaveAttribute("aria-expanded", "true");
  await expect(
    dialog.getByRole("button", { name: "Close dialog" }),
  ).toHaveCount(0);
  await searchButton.click();
  await expect(dialog).toHaveCount(0);
  await searchButton.click();
  const searchPanel = await dialog.boundingBox();
  expect(searchPanel).not.toBeNull();
  expect(searchPanel!.x).toBeGreaterThanOrEqual(0);
  expect(searchPanel!.x + searchPanel!.width).toBeLessThanOrEqual(
    page.viewportSize()!.width,
  );
  await page.mouse.click(
    searchPanel!.x + searchPanel!.width / 2,
    searchPanel!.y + searchPanel!.height + 12,
  );
  await expect(dialog).toHaveCount(0);
  await expect(searchButton).toHaveAttribute("aria-expanded", "false");
  await searchButton.click();
  await page.getByLabel("Title contains").fill("Drag me");
  await dialog.getByText("Date range", { exact: true }).click();
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
  await expect(
    dialog.getByRole("button", { name: "Create goal", exact: true }),
  ).toHaveCount(0);
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
    const beforeResize = (await record().boundingBox())!;
    async function checkResize() {
      if (Math.abs(dy) !== 5) return;
      await expect
        .poll(async () => (await record().boundingBox())!.height)
        .toBeCloseTo(beforeResize.height + dy, 0);
      await expect(record()).not.toHaveClass(/drag-source/);
      await expect(page.locator(".calendar-moving-block")).toHaveCount(0);
    }
    const x = (await element.getAttribute("class"))?.includes("resize-end")
        ? box.x + box.width - 4
        : box.x + box.width / 2,
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
      await checkResize();
      await session.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await session.detach();
    } else {
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x, y + dy, { steps: 4 });
      if (dy === 60) {
        const moving = page.locator(".calendar-moving-block");
        await expect(moving).toBeVisible();
        await expect(moving.locator(".calendar-drag-hint")).toHaveText(
          "Escape to cancel",
        );
        await expect(page.locator(".calendar-drag-label")).toHaveCount(0);
        await expect(element).toHaveClass(/drag-source/);
        const originalBox = (await element.boundingBox())!;
        const movingBox = (await moving.boundingBox())!;
        expect(originalBox.y).toBeCloseTo(box.y, 0);
        const column = (await day
          .locator('[data-drag-day="2026-09-21"]')
          .boundingBox())!;
        expect(movingBox.y - column.y).toBeCloseTo(10 * 60, 0);
        expect(movingBox.x).toBeCloseTo(column.x + 2, 0);
        await page.mouse.move(x + 15, y + dy + 1);
        const withinSlot = (await moving.boundingBox())!;
        expect(withinSlot.x).toBeCloseTo(movingBox.x, 0);
        expect(withinSlot.y).toBeCloseTo(movingBox.y, 0);
        expect((await getBlock()).version).toBe(original.version);
        await page.screenshot({
          path: testInfo.outputPath("moving-block.png"),
        });
      }
      await checkResize();
      await page.mouse.up();
      await expect(page.locator(".calendar-moving-block")).toHaveCount(0);
    }
  }
  await record().click();
  await expect(record()).toHaveAttribute("aria-pressed", "true");
  await expect(record()).toHaveCSS("background-color", "rgb(25, 107, 87)");
  await expect(dialog).toHaveCount(0);
  await record().dblclick();
  await expect(dialog).toHaveAttribute("aria-modal", "false");
  await close();
  await record().focus();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeVisible();
  await close();
  if (touch) {
    await page.keyboard.press("Escape");
    await record().tap();
    await expect(record()).toHaveClass(/drag-selected/);
    await expect(dialog).toHaveCount(0);
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
  await drag(record(), touch ? 30 : 60);
  await page.getByRole("button", { name: "Retry same change" }).click();
  await expect(
    page.getByRole("button", { name: "Retry same change" }),
  ).toHaveCount(0);
  await expect(page.getByText("Plan updated.", { exact: true })).toHaveClass(
    "sr-only",
  );
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
    await record().dblclick();
    await dialog.getByText("Actions", { exact: true }).click();
    await dialog
      .getByRole("button", { name: "Move or resize on calendar" })
      .click();
    await page
      .getByRole("group", { name: "Adjust block" })
      .getByRole("button", { name: "Resize end", exact: true })
      .click();
    await drag(record(), 5);
  } else
    await drag(
      day
        .locator(".grid-record")
        .filter({ has: page.getByRole("button", { name: /Drag me.*planned/ }) })
        .locator(".resize-end"),
      5,
    );
  await expect
    .poll(async () => Date.parse((await getBlock()).endsAt))
    .toBeGreaterThan(Date.parse(moved.endsAt));
  if (!touch)
    expect(
      Date.parse((await getBlock()).endsAt) - Date.parse(moved.endsAt),
    ).toBe(300000);
  if (touch)
    await page
      .getByRole("group", { name: "Adjust block" })
      .getByRole("button", { name: "Done", exact: true })
      .click();
  if (!touch) {
    const resizeStart = day
      .locator(".grid-record")
      .filter({ has: page.getByRole("button", { name: /Drag me.*planned/ }) })
      .locator(".resize-start");
    await resizeStart.scrollIntoViewIfNeeded();
    const before = (await record().boundingBox())!;
    const handle = (await resizeStart.boundingBox())!;
    const beforeVersion = (await getBlock()).version;
    await page.mouse.move(handle.x + 4, handle.y + handle.height / 2);
    await page.mouse.down();
    await page.mouse.move(handle.x + 4, handle.y + handle.height / 2 + 5);
    await expect
      .poll(async () => (await record().boundingBox())!.height)
      .toBeCloseTo(before.height - 5, 0);
    expect((await record().boundingBox())!.y).toBeCloseTo(before.y + 5, 0);
    expect((await getBlock()).version).toBe(beforeVersion);
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect
      .poll(async () => (await record().boundingBox())!.height)
      .toBeCloseTo(before.height, 0);
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
        cancelled.y + cancelled.height / 2 + 30,
        { steps: 3 },
      );
      await expect(
        page.locator(".calendar-moving-block .calendar-drag-hint"),
      ).toHaveText("Escape to cancel");
      if (cancellation === "escape") await page.keyboard.press("Escape");
      else await page.evaluate(() => window.dispatchEvent(new Event("blur")));
      await page.mouse.up();
      await expect(page.locator(".calendar-moving-block")).toHaveCount(0);
      await expect(page.locator(".calendar-moving-block")).toHaveCount(0);
      await expect(record()).not.toHaveClass(/drag-source/);
      expect((await getBlock()).version).toBe(beforeCancel.version);
    }
    const slot = day.getByRole("button", {
      name: "Select time on 2026-09-21 at 16:00",
      exact: true,
    });
    await slot.evaluate((element) =>
      element.scrollIntoView({ block: "center", inline: "nearest" }),
    );
    const box = (await slot.boundingBox())!;
    const draft = day.getByRole("img", { name: /^Draft plan:/ });
    const beforeDraft: Week = await (
      await page.request.get("/api/v1/weeks/2026-09-21")
    ).json();
    await page.mouse.move(box.x + 20, box.y + 6); // 16:05
    await page.mouse.down();
    await page.mouse.move(box.x + 20, box.y + 11); // 16:10
    await expect(draft).toHaveCSS("height", "5px");
    await page.mouse.move(box.x + 20, box.y + 16, { steps: 3 }); // 16:15
    await expect(draft).toBeVisible();
    await expect(draft).toHaveCSS("height", "10px");
    await expect(dialog).toHaveCount(0);
    await page.mouse.move(box.x + 20, box.y + 36, { steps: 3 }); // 16:35
    await expect(draft).toHaveCSS("height", "30px");
    await expect(draft.locator(".calendar-drag-hint")).toHaveText(
      "Escape to cancel",
    );
    await expect(page.locator(".calendar-drag-label")).toHaveCount(0);
    expect(
      (await (await page.request.get("/api/v1/weeks/2026-09-21")).json())
        .blocks,
    ).toHaveLength(beforeDraft.blocks.length);
    await audit("calendar-draft");
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect(draft).toHaveCount(0);
    await expect(dialog).toHaveCount(0);
    // Drag upward; the draft follows the selected interval in either direction.
    await page.mouse.move(box.x + 20, box.y + 36);
    await page.mouse.down();
    await page.mouse.move(box.x + 20, box.y + 11, { steps: 4 });
    await expect(draft).toHaveCSS("height", "25px");
    await page.mouse.up();
    await expect(draft).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "false");
    await dialog.getByText("Other plans", { exact: true }).click();
    await expect(
      dialog.getByRole("button", { name: "Repeating plan", exact: true }),
    ).toHaveCount(0);
    await dialog.getByText("Other plans", { exact: true }).click();
    await expect(dialog.getByLabel("Repeat", { exact: true })).toHaveValue(
      "never",
    );
    await expect(page.locator("dialog[open]")).toHaveCount(0);
    await expect(page.getByLabel("Start", { exact: true })).toHaveValue(
      "2026-09-21T16:10",
    );
    await expect(page.getByLabel("End", { exact: true })).toHaveValue(
      "2026-09-21T16:35",
    );
    await page.getByLabel("Title", { exact: true }).fill("Dragged plan");
    await expect(draft).toContainText("Dragged plan");
    const popoverBox = (await dialog.boundingBox())!;
    const draftBox = (await draft.boundingBox())!;
    expect(popoverBox.x).toBeGreaterThanOrEqual(draftBox.x + draftBox.width);
    await audit("plan-popover");
    const createKeys: string[] = [];
    await page.route("**/api/v1/time-blocks", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      createKeys.push(route.request().headers()["idempotency-key"]!);
      if (createKeys.length === 1) {
        expect((await route.fetch()).status()).toBe(201);
        return route.abort("failed");
      }
      await route.continue();
    });
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(
      dialog.getByRole("button", { name: "Retry save" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("link", { name: "Week", exact: true }).click();
    await expect(dialog).toBeVisible();
    await expect(page).toHaveURL(/view=day/);
    await expect(draft).toBeVisible();
    await dialog.getByRole("button", { name: "Retry save" }).click();
    expect(createKeys).toHaveLength(2);
    expect(createKeys[0]).toBe(createKeys[1]);
    await page.unroute("**/api/v1/time-blocks");
    await expect(dialog).toHaveCount(0);
    const saved: Week = await (
      await page.request.get("/api/v1/weeks/2026-09-21")
    ).json();
    expect(saved.blocks).toHaveLength(beforeDraft.blocks.length + 1);
    expect(
      saved.blocks.find((block) => block.title === "Dragged plan"),
    ).toMatchObject({
      startsAt: "2026-09-21T22:10:00.000Z",
      endsAt: "2026-09-21T22:35:00.000Z",
    });
    await page.getByRole("link", { name: "Week", exact: true }).click();
    const weekGrid = page.getByRole("region", { name: "Weekly time grid" });
    const weekSlot = weekGrid.getByRole("button", {
      name: "Select time on 2026-09-21 at 17:00",
      exact: true,
    });
    await weekSlot.scrollIntoViewIfNeeded();
    const weekBox = (await weekSlot.boundingBox())!;
    await page.mouse.move(weekBox.x + 20, weekBox.y + 6);
    await page.mouse.down();
    await page.mouse.move(weekBox.x + 20, weekBox.y + 26, { steps: 3 });
    await expect(weekGrid.getByRole("img", { name: /^Draft plan:/ })).toHaveCSS(
      "height",
      "20px",
    );
    await page.mouse.up();
    await expect(page.getByLabel("Start", { exact: true })).toHaveValue(
      "2026-09-21T17:05",
    );
    await expect(page.getByLabel("End", { exact: true })).toHaveValue(
      "2026-09-21T17:25",
    );
    await close();
    const weekRecord = weekGrid.getByRole("button", {
      name: /Drag me.*planned/,
    });
    await weekRecord.scrollIntoViewIfNeeded();
    const weekSource = (await weekRecord.boundingBox())!;
    const nextColumn = (await weekGrid
      .locator('[data-drag-day="2026-09-22"]')
      .boundingBox())!;
    await page.mouse.move(
      weekSource.x + weekSource.width / 2,
      weekSource.y + 20,
    );
    await page.mouse.down();
    await page.mouse.move(
      nextColumn.x + nextColumn.width / 2,
      weekSource.y + 20,
      { steps: 4 },
    );
    const snapped = page.locator(".calendar-moving-block");
    await expect(snapped).toBeVisible();
    expect((await snapped.boundingBox())!.x).toBeCloseTo(nextColumn.x + 2, 0);
    await expect(snapped).toContainText("2026-09-22");
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await page.setViewportSize({ width: 1440, height: 1500 });
    await page
      .getByRole("navigation", { name: "Calendar view" })
      .getByRole("link", { name: "Month", exact: true })
      .click();
    const month = page.getByRole("region", { name: "Monthly calendar" }),
      source = month
        .locator('[data-date="2026-09-21"]')
        .getByRole("button", { name: /Drag me.*planned/ }),
      target = month.locator('[data-date="2026-09-22"]');
    await expect(source).toBeVisible({ timeout: 30000 });
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
  page.on("dialog", async (confirmation) => {
    await confirmation.dismiss();
    throw new Error("Calendar deletion must not show a confirmation alert");
  });
  const selectedBlock = page
    .locator(`button[data-calendar-record="${original.id}"]`)
    .first();
  await selectedBlock.dblclick();
  await page.getByLabel("Title", { exact: true }).fill("Drag meX");
  await page.getByLabel("Title", { exact: true }).press("Backspace");
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "Drag me",
  );
  await close();
  await selectedBlock.click();
  const deleteKeys: string[] = [];
  await page.route("**/api/v1/time-blocks/" + original.id, async (route) => {
    if (route.request().method() !== "DELETE") return route.continue();
    deleteKeys.push(route.request().headers()["idempotency-key"]!);
    if (deleteKeys.length === 1) {
      expect((await route.fetch()).status()).toBe(200);
      return route.abort("failed");
    }
    await route.continue();
  });
  await page.keyboard.press(touch ? "Delete" : "Backspace");
  await expect(
    page.getByRole("button", { name: "Retry same change" }),
  ).toBeVisible();
  await page.keyboard.press("Delete");
  expect(deleteKeys).toHaveLength(1);
  await page.getByRole("button", { name: "Retry same change" }).click();
  await expect(page.getByText("Plan deleted.", { exact: true })).toHaveClass(
    "sr-only",
  );
  expect(deleteKeys).toHaveLength(2);
  expect(deleteKeys[0]).toBe(deleteKeys[1]);
  await expect(selectedBlock).toHaveCount(0);
  await page.unroute("**/api/v1/time-blocks/" + original.id);
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".calendar-undo")).toHaveCount(0);
  await audit("calendar-delete-undo");
  // The selected button disappeared: the shortcut must also work with body focus.
  await page.keyboard.press(touch ? "Control+z" : "Meta+z");
  await expect(page.getByText("Plan restored.", { exact: true })).toHaveClass(
    "sr-only",
  );
  await expect(selectedBlock).toBeVisible();
  await expect(selectedBlock).toHaveAttribute("aria-pressed", "true");
  await selectedBlock.click();
  await page.keyboard.press("Delete");
  await expect(selectedBlock).toHaveCount(0);
  const restoreKeys: string[] = [];
  await page.route("**/api/v1/time-block-deletions/*/undo", async (route) => {
    restoreKeys.push(route.request().headers()["idempotency-key"]!);
    if (restoreKeys.length === 1) {
      expect((await route.fetch()).status()).toBe(200);
      return route.abort("failed");
    }
    await route.continue();
  });
  await page.keyboard.press(touch ? "Control+z" : "Meta+z");
  await page.getByRole("button", { name: "Retry same change" }).click();
  await expect(page.getByText("Plan restored.", { exact: true })).toHaveClass(
    "sr-only",
  );
  expect(restoreKeys).toHaveLength(2);
  expect(restoreKeys[0]).toBe(restoreKeys[1]);
  await page.unroute("**/api/v1/time-block-deletions/*/undo");
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
  await page.goto("/?date=2026-09-07&view=day");
  await day.getByRole("button", { name: /Conference, all day/ }).dblclick();
  await dialog.getByRole("button", { name: "Add a time" }).click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "Conference",
  );
  await expect(
    dialog.getByText("The all-day plan stays on the calendar."),
  ).toBeVisible();
  await page.getByLabel("Start", { exact: true }).fill("2026-09-07T15:00");
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    day.getByRole("button", { name: /Conference, all day/ }),
  ).toBeVisible();
  await expect(
    day.getByRole("button", { name: /Conference, .*planned/ }),
  ).toBeVisible();
});
