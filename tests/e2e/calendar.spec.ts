import {
  clickCalendarEditorAction,
  expectCalendarField,
  fillCalendarField,
  openCalendarEditorActions,
  openCalendarPlan,
  showCalendarNotes,
} from "./helpers/calendar-form";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { Week } from "@168hours/contracts";

test("hover preview follows fast pointer jumps and labels the slice above", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-08T20:00:00Z"));
  const signup = await page.request.post("/api/__test/register", {
    headers: {
      Origin: "http://localhost:3100",
      "Idempotency-Key": randomUUID(),
    },
    data: {
      name: "Calendar hover member",
      email: `calendar-hover-${randomUUID()}@example.com`,
      password: "Synthetic-calendar-password-123",
    },
  });
  expect(signup.status()).toBe(200);
  await page.goto("/?date=2026-10-08&view=day");
  const grid = page.getByRole("region", { name: "Daily time grid" });
  const hour14 = grid.getByRole("button", {
    name: "Select time on 2026-10-08 at 14:00",
    exact: true,
  });
  const hour15 = grid.getByRole("button", {
    name: "Select time on 2026-10-08 at 15:00",
    exact: true,
  });
  await hour14.evaluate((element) =>
    element.scrollIntoView({ block: "center", inline: "nearest" }),
  );
  const first = (await hour14.boundingBox())!;
  const second = (await hour15.boundingBox())!;
  const x = first.x + first.width / 2;
  const hover = async (y: number) => page.mouse.move(x, y, { steps: 1 });
  await hover(first.y + first.height * 0.8);
  const firstWrap = hour14.locator("xpath=..");
  const secondWrap = hour15.locator("xpath=..");
  await expect(firstWrap.locator(".slot-preview-time")).toHaveText("14:45");
  await hover(second.y + second.height * 0.35);
  await expect(secondWrap.locator(".slot-preview-time")).toHaveText("15:20");
  await hover(first.y + first.height * 0.2);
  await expect(firstWrap.locator(".slot-preview-time")).toHaveText("14:10");
  const slice = (await firstWrap.locator(".slot-preview").boundingBox())!;
  const label = (await firstWrap.locator(".slot-preview-time").boundingBox())!;
  expect(label.y + label.height).toBeCloseTo(slice.y, 0);
  const quickAdd = firstWrap.getByRole("button", {
    name: "Quick actions on 2026-10-08 at 14:10",
  });
  const quickBounds = (await quickAdd.boundingBox())!;
  expect(quickBounds.x).toBeGreaterThan(slice.x + slice.width / 2);
  expect(quickBounds.x + quickBounds.width).toBeCloseTo(
    slice.x + slice.width,
    0,
  );
  expect(label.x).toBeLessThan(slice.x + slice.width / 2);
  await quickAdd.click();
  const dialog = page.getByRole("dialog", { name: "Quick actions" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Log water" }).click();
  const waterDialog = page.getByRole("dialog", { name: "Log water" });
  await expect(waterDialog.getByLabel("Drank at")).toHaveValue(
    "2026-10-08T14:10",
  );
  await waterDialog.getByRole("button", { name: "Log water" }).click();
  await expect(waterDialog).toHaveCount(0);
  await expect(
    grid.getByRole("button", { name: /1 moment at 14:00 on 2026-10-08/ }),
  ).toBeVisible();

  await page
    .getByRole("navigation", { name: "Calendar view" })
    .getByRole("link", { name: "Week" })
    .click();
  const weekSlot = page
    .getByRole("region", { name: "Weekly time grid" })
    .getByRole("button", {
      name: "Select time on 2026-10-10 at 15:00",
      exact: true,
    });
  await weekSlot.evaluate((element) =>
    element.scrollIntoView({ block: "center", inline: "nearest" }),
  );
  const weekBounds = (await weekSlot.boundingBox())!;
  await page.mouse.move(
    weekBounds.x + weekBounds.width / 2,
    weekBounds.y + weekBounds.height * 0.35,
    { steps: 1 },
  );
  await weekSlot
    .locator("xpath=..")
    .getByRole("button", {
      name: "Quick actions on 2026-10-10 at 15:20",
    })
    .click();
  await page
    .getByRole("dialog", { name: "Quick actions" })
    .getByRole("button", { name: "Log water" })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Log water" }).getByLabel("Drank at"),
  ).toHaveValue("2026-10-10T15:20");
  await page
    .getByRole("dialog", { name: "Log water" })
    .getByRole("button", { name: "Close dialog" })
    .click();
  const weekQuickAdd = weekSlot.locator("xpath=..").locator(".slot-quick-add");
  await page.mouse.move(
    weekBounds.x + weekBounds.width / 2,
    weekBounds.y + weekBounds.height * 0.35,
  );
  await expect(weekQuickAdd).toBeVisible();
  const plusBounds = (await weekQuickAdd.boundingBox())!;
  await page.mouse.move(
    plusBounds.x + plusBounds.width / 2,
    plusBounds.y + plusBounds.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    plusBounds.x + plusBounds.width + 35,
    plusBounds.y + 10,
    {
      steps: 4,
    },
  );
  await page.mouse.up();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("[data-calendar-draft]")).toHaveCount(0);
  await page.mouse.move(weekBounds.x + weekBounds.width / 2, weekBounds.y + 10);
  await expect(weekQuickAdd).toBeVisible();
  await page.mouse.down();
  await page.mouse.move(
    weekBounds.x + weekBounds.width / 2,
    weekBounds.y + 40,
    {
      steps: 4,
    },
  );
  await expect(weekQuickAdd).not.toBeVisible();
  await page.mouse.up();
  await expect(page.getByRole("dialog", { name: "Add plan" })).toBeVisible();
  await expect(weekQuickAdd).not.toBeVisible();
  await page.keyboard.press("Escape");
  await expect(weekQuickAdd).toBeVisible();

  await page.mouse.move(weekBounds.x + weekBounds.width / 2, weekBounds.y + 10);
  await page.mouse.down();
  await page.mouse.move(
    weekBounds.x + weekBounds.width / 2,
    weekBounds.y + 40,
    {
      steps: 4,
    },
  );
  await page.mouse.up();
  const planEditor = page.getByRole("dialog", { name: "Add plan" });
  await planEditor.getByLabel("Title", { exact: true }).fill("Dragged block");
  await planEditor.getByRole("button", { name: "Save", exact: true }).click();
  await expect(planEditor).toHaveCount(0);
  await expect(page.locator("[data-selected-time]")).toHaveCount(0);
  const savedBlock = page
    .getByRole("region", { name: "Weekly time grid" })
    .getByRole("button", { name: /Dragged block.*planned/ });
  await expect(savedBlock).toBeVisible();
  const savedBounds = (await savedBlock.boundingBox())!;
  await page.mouse.move(
    savedBounds.x + savedBounds.width - 10,
    savedBounds.y + savedBounds.height / 2,
  );
  await expect(weekQuickAdd).not.toBeVisible();
});

test("view tabs follow the selected day or time", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-08T20:00:00Z"));
  const signup = await page.request.post("/api/__test/register", {
    headers: {
      Origin: "http://localhost:3100",
      "Idempotency-Key": randomUUID(),
    },
    data: {
      name: "Calendar view member",
      email: `calendar-view-${randomUUID()}@example.com`,
      password: "Synthetic-calendar-password-123",
    },
  });
  expect(signup.status()).toBe(200);
  await page.goto("/?date=2026-10-01&view=month");
  const views = page.getByRole("navigation", { name: "Calendar view" });
  const month = page.getByRole("region", { name: "Monthly calendar" });
  async function expectTodayBesidePrevious() {
    const today = page.getByRole("link", { name: "Today", exact: true });
    const previous = page.getByRole("link", {
      name: /^Previous (day|week|month)$/,
    });
    await expect(today).toBeVisible();
    const todayBounds = (await today.boundingBox())!;
    const previousBounds = (await previous.boundingBox())!;
    expect(
      previousBounds.x - (todayBounds.x + todayBounds.width),
    ).toBeGreaterThanOrEqual(0);
    expect(previousBounds.x - (todayBounds.x + todayBounds.width)).toBeLessThan(
      44,
    );
  }
  await expect(month).toBeVisible();
  await expectTodayBesidePrevious();
  await expect(views.getByRole("link", { name: "Week" })).toHaveAttribute(
    "href",
    "/?date=2026-10-01&view=week",
  );
  await month.getByRole("button", { name: /Select 2026-10-08,/ }).click();
  await expect(views.getByRole("link", { name: "Week" })).toHaveAttribute(
    "href",
    "/?date=2026-10-08&view=week",
  );
  await views.getByRole("link", { name: "Week" }).click();
  await expect(page).toHaveURL(/date=2026-10-08&view=week/);
  await expectTodayBesidePrevious();

  const slot = page
    .getByRole("region", { name: "Weekly time grid" })
    .getByRole("button", {
      name: "Select time on 2026-10-10 at 14:00",
      exact: true,
    });
  await slot.scrollIntoViewIfNeeded();
  await slot.click({ position: { x: 15, y: 18 } });
  await expect(slot).toHaveAttribute("aria-pressed", "true");
  await expect(views.getByRole("link", { name: "Day" })).toHaveAttribute(
    "href",
    "/?date=2026-10-10&view=day",
  );
  await views.getByRole("link", { name: "Day" }).click();
  await expect(page).toHaveURL(/date=2026-10-10&view=day/);
  await expectTodayBesidePrevious();
  await expect(
    page.getByRole("region", { name: "Daily time grid" }),
  ).toBeVisible();

  await page.goto("/?date=2026-10-01&view=month");
  await month.getByRole("button", { name: /Select 2026-10-20,/ }).click();
  await expect(views.getByRole("link", { name: "Day" })).toHaveAttribute(
    "href",
    "/?date=2026-10-20&view=day",
  );
  await views.getByRole("link", { name: "Day" }).click();
  await expect(page).toHaveURL(/date=2026-10-20&view=day/);
});

test("dragging the time axis adjusts Day and Week spacing and can reset it", async ({
  page,
}, testInfo) => {
  await page.clock.setFixedTime(new Date("2026-10-08T20:00:00Z"));
  const signup = await page.request.post("/api/__test/register", {
    headers: {
      Origin: "http://localhost:3100",
      "Idempotency-Key": randomUUID(),
    },
    data: {
      name: "Calendar scale member",
      email: `calendar-scale-${randomUUID()}@example.com`,
      password: "Synthetic-calendar-password-123",
    },
  });
  expect(signup.status()).toBe(200);
  await page.goto("/?date=2026-10-08&view=day");
  const axis = page.getByRole("slider", { name: "Hour spacing" });
  const scroller = page.locator(".calendar-scroll");
  const hour = page
    .getByRole("region", { name: "Daily time grid" })
    .locator(".hour-slot")
    .first();
  await expect(axis).toHaveAttribute("aria-valuenow", "60");
  await expect(hour).toHaveCSS("height", "60px");
  async function dragAxis(distance: number) {
    const bounds = (await scroller.boundingBox())!;
    const x = bounds.x + 25;
    const y = bounds.y + 160;
    const before = await scroller.evaluate((element) => element.scrollTop);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + distance, { steps: 6 });
    await page.mouse.up();
    const after = await scroller.evaluate((element) => element.scrollTop);
    return { before, after };
  }
  const zoom = await dragAxis(100);
  await expect(axis).toHaveAttribute("aria-valuenow", "100");
  await expect(axis).toHaveAttribute("data-tick-minutes", "30");
  expect(await axis.locator('span[aria-hidden="true"]').count()).toBe(49);
  await expect(hour).toHaveCSS("height", "100px");
  await expect(hour).toHaveClass(/has-half-hour-tick/);
  if (testInfo.project.name === "desktop")
    expect(zoom.after).toBeCloseTo(((zoom.before + 160) * 100) / 60 - 160, 0);
  await page.screenshot({
    path: testInfo.outputPath("calendar-zoomed-day.png"),
  });
  const slot = page
    .getByRole("region", { name: "Daily time grid" })
    .getByRole("button", {
      name: "Select time on 2026-10-08 at 14:00",
      exact: true,
    });
  await slot.evaluate((element) =>
    element.scrollIntoView({ block: "center", inline: "nearest" }),
  );
  const slotBounds = (await slot.boundingBox())!;
  await page.mouse.move(slotBounds.x + 20, slotBounds.y + 12);
  await page.mouse.down();
  await page.mouse.move(slotBounds.x + 20, slotBounds.y + 29, { steps: 4 });
  await page.mouse.up();
  const draft = page
    .getByRole("region", { name: "Daily time grid" })
    .getByRole("img", { name: /^Draft plan:/ });
  await expect(draft).toBeVisible();
  const fiveMinuteHeight = 100 / 12;
  const draftIntervals = (await draft.boundingBox())!.height / fiveMinuteHeight;
  expect(draftIntervals).toBeGreaterThanOrEqual(1);
  expect(draftIntervals).toBeCloseTo(Math.round(draftIntervals), 1);
  await page.keyboard.press("Escape");
  await expect(draft).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Calendar view" })
    .getByRole("link", { name: "Week" })
    .click();
  await expect(page).toHaveURL(/view=week/);
  await expect(
    page.getByRole("region", { name: "Weekly time grid" }),
  ).toBeVisible();
  await expect(axis).toHaveAttribute("aria-valuenow", "100");
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Weekly time grid" }),
  ).toBeVisible();
  await expect(axis).toHaveAttribute("aria-valuenow", "100");
  await expect(axis).toHaveAttribute("data-tick-minutes", "30");
  await dragAxis(-100);
  await expect(axis).toHaveAttribute("aria-valuenow", "60");
  await expect(axis).toHaveAttribute("data-tick-minutes", "60");
  await dragAxis(-40);
  await expect(axis).toHaveAttribute("aria-valuenow", "44");
  await expect(axis).toHaveAttribute("data-tick-minutes", "60");
  await dragAxis(-30);
  await expect(axis).toHaveAttribute("aria-valuenow", "32");
  await expect(axis).toHaveAttribute("data-tick-minutes", "120");
  expect(await axis.locator('span[aria-hidden="true"]').count()).toBe(13);
  await expect(page.locator(".hour-slot.is-between-ticks").first()).toHaveCSS(
    "border-top-width",
    "0px",
  );
  await page.screenshot({
    path: testInfo.outputPath("calendar-compressed-week.png"),
  });
  await page.reload();
  await expect(
    page.getByRole("region", { name: "Weekly time grid" }),
  ).toBeVisible();
  await expect(axis).toHaveAttribute("aria-valuenow", "32");
  await expect(axis).toHaveAttribute("data-tick-minutes", "120");
  await axis.focus();
  await page.keyboard.press("ArrowDown");
  await expect(axis).toHaveAttribute("aria-valuenow", "36");
  await expect(axis).toHaveAttribute("data-tick-minutes", "120");
  await page.keyboard.press("ArrowDown");
  await expect(axis).toHaveAttribute("aria-valuenow", "40");
  await expect(axis).toHaveAttribute("data-tick-minutes", "120");
  await page.keyboard.press("ArrowDown");
  await expect(axis).toHaveAttribute("aria-valuenow", "44");
  await expect(axis).toHaveAttribute("data-tick-minutes", "60");
  await page.keyboard.press("ArrowDown");
  await expect(axis).toHaveAttribute("aria-valuenow", "48");
  await page.keyboard.press("r");
  await expect(axis).toHaveAttribute("aria-valuenow", "60");
  await dragAxis(50);
  await expect(axis).toHaveAttribute("aria-valuenow", "80");
  await page.getByRole("link", { name: "Today", exact: true }).focus();
  await page.keyboard.press("r");
  await expect(axis).toHaveAttribute("aria-valuenow", "60");
  await dragAxis(50);
  await expect(axis).toHaveAttribute("aria-valuenow", "80");
  await page
    .getByRole("button", { name: "Search and filter calendar" })
    .click();
  await page.getByLabel("Title contains").fill("r");
  await expect(axis).toHaveAttribute("aria-valuenow", "80");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Search calendar" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Search and filter calendar" }),
  ).toBeFocused();
  const bounds = (await scroller.boundingBox())!;
  await page.mouse.click(bounds.x + 25, bounds.y + 160, { clickCount: 2 });
  await expect(axis).toHaveAttribute("aria-valuenow", "60");
  await scroller.evaluate((element) => {
    element.scrollTop = (element.scrollHeight - element.clientHeight) / 4;
  });
  const scrollFraction = () =>
    scroller.evaluate(
      (element) =>
        element.scrollTop / (element.scrollHeight - element.clientHeight),
    );
  await expect.poll(scrollFraction).toBeCloseTo(0.25, 2);
  const lowerY = bounds.y + bounds.height - 40;
  await page.mouse.move(bounds.x + 25, lowerY);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 25, lowerY - 25, { steps: 5 });
  await expect(axis).toHaveAttribute("aria-valuenow", "50");
  await expect.poll(scrollFraction).toBeCloseTo(0.25, 1);
  await page.mouse.move(bounds.x + 25, lowerY - 75, { steps: 5 });
  await expect(axis).toHaveAttribute("aria-valuenow", "30");
  await expect.poll(scrollFraction).toBeCloseTo(0.25, 1);
  await page.mouse.up();
  await axis.focus();
  await page.keyboard.press("r");
  await expect(axis).toHaveAttribute("aria-valuenow", "60");
  await page
    .getByRole("navigation", { name: "Calendar view" })
    .getByRole("link", { name: "Month" })
    .click();
  await expect(axis).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Calendar view" })
    .getByRole("link", { name: "Day" })
    .click();
  await expect(page).toHaveURL(/view=day/);
  await expect(axis).toHaveAttribute("aria-valuenow", "60");
  await axis.focus();
  await page.keyboard.press("Home");
  await expect
    .poll(async () => {
      const minimum = Number(await axis.getAttribute("aria-valuemin"));
      const actual = Number(await axis.getAttribute("aria-valuenow"));
      return Math.abs(actual - minimum);
    })
    .toBeLessThan(0.01);
  const fittedHourHeight = Number(await axis.getAttribute("aria-valuenow"));
  expect(fittedHourHeight).toBeGreaterThan(12);
  expect(await axis.locator('span[aria-hidden="true"]').count()).toBe(
    1440 / Number(await axis.getAttribute("data-tick-minutes")) + 1,
  );
  await expect(page.locator(".hour-slot.is-between-ticks").first()).toHaveCSS(
    "border-top-width",
    "0px",
  );
  async function expectWholeDayVisible() {
    await expect
      .poll(async () =>
        scroller.evaluate((element) => {
          const body = element.querySelector<HTMLElement>(
            ".calendar-grid-body",
          )!;
          const first = element.querySelector<HTMLElement>(".hour-slot")!;
          const header = element.querySelector<HTMLElement>(
            ".calendar-grid-head",
          );
          const anytime = element.querySelector<HTMLElement>(
            ".calendar-anytime-row",
          );
          const bounds = body.getBoundingClientRect();
          const endLabel =
            element.querySelector<HTMLElement>(".hour-axis-end")!;
          const labelBounds = endLabel.getBoundingClientRect();
          const axis = element.querySelector<HTMLElement>(".hour-axis")!;
          const hourHeight = Number(axis.getAttribute("aria-valuenow"));
          const tickOffset = Math.max(
            ...Array.from(
              axis.querySelectorAll<HTMLElement>(
                'span[aria-hidden="true"]:not(.hour-axis-start):not(.hour-axis-end)',
              ),
              (label) => {
                const [hours, minutes] = label
                  .textContent!.split(":")
                  .map(Number);
                const line = bounds.top + (hours! + minutes! / 60) * hourHeight;
                const labelBounds = label.getBoundingClientRect();
                return Math.abs(
                  labelBounds.top + labelBounds.height / 2 - line,
                );
              },
            ),
          );
          const scrollerTop = element.getBoundingClientRect().top;
          if (getComputedStyle(body, "::after").borderTopWidth !== "1px")
            return Infinity;
          return Math.max(
            Math.abs(first.getBoundingClientRect().top - bounds.top),
            Math.abs(
              bounds.top -
                scrollerTop -
                (header?.offsetHeight ?? 0) -
                (anytime?.offsetHeight ?? 0),
            ),
            Math.abs(bounds.bottom - scrollerTop - element.clientHeight),
            Math.max(0, labelBounds.bottom - bounds.bottom),
            Math.max(0, bounds.bottom - labelBounds.bottom - 8),
            tickOffset,
            element.scrollHeight - element.clientHeight,
          );
        }),
      )
      .toBeLessThan(1);
  }
  await expectWholeDayVisible();
  await page.keyboard.press("ArrowUp");
  await expectWholeDayVisible();
  await dragAxis(-200);
  await expectWholeDayVisible();
  await page.screenshot({ path: testInfo.outputPath("calendar-full-day.png") });
  await page
    .getByRole("navigation", { name: "Calendar view" })
    .getByRole("link", { name: "Week" })
    .click();
  await expect(page).toHaveURL(/view=week/);
  await expect
    .poll(async () =>
      Math.abs(
        Number(await axis.getAttribute("aria-valuenow")) -
          Number(await axis.getAttribute("aria-valuemin")),
      ),
    )
    .toBeLessThan(0.01);
  await expectWholeDayVisible();
  await page.reload();
  await expect(page).toHaveURL(/view=week/);
  await expectWholeDayVisible();
  const viewport = page.viewportSize()!;
  await page.setViewportSize({ ...viewport, height: viewport.height + 80 });
  await expectWholeDayVisible();
  await page.setViewportSize(viewport);
});

test("Day and Week show quarter-hour guides at higher zoom", async ({
  page,
}, testInfo) => {
  await page.clock.setFixedTime(new Date("2026-10-08T20:00:00Z"));
  const signup = await page.request.post("/api/__test/register", {
    headers: {
      Origin: "http://localhost:3100",
      "Idempotency-Key": randomUUID(),
    },
    data: {
      name: "Calendar quarter-hour member",
      email: `calendar-quarter-${randomUUID()}@example.com`,
      password: "Synthetic-calendar-password-123",
    },
  });
  expect(signup.status()).toBe(200);
  await page.goto("/?date=2026-10-08&view=day");
  const axis = page.getByRole("slider", { name: "Hour spacing" });
  const scroller = page.locator(".calendar-scroll");
  const bounds = (await scroller.boundingBox())!;
  await page.mouse.move(bounds.x + 25, bounds.y + 80);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 25, bounds.y + 305, { steps: 8 });
  await page.mouse.up();
  await expect(axis).toHaveAttribute("aria-valuenow", "150");
  await expect(axis).toHaveAttribute("data-tick-minutes", "15");
  expect(await axis.locator('span[aria-hidden="true"]').count()).toBe(97);
  const hour = page.locator(".daily-grid .hour-slot").first();
  await expect(hour).toHaveClass(/has-quarter-hour-ticks/);
  await page.screenshot({
    path: testInfo.outputPath("calendar-quarter-hour-day.png"),
  });
  await axis.focus();
  await page.keyboard.press("End");
  await expect(axis).toHaveAttribute("aria-valuenow", "240");
  await expect(hour).toHaveCSS("height", "240px");
  const slot = page.getByRole("button", {
    name: "Select time on 2026-10-08 at 14:00",
    exact: true,
  });
  await slot.scrollIntoViewIfNeeded();
  await slot.click({ position: { x: 20, y: 20 } });
  await expect(
    page.locator('[data-selected-time="2026-10-08T14:05"]'),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Calendar view" })
    .getByRole("link", { name: "Week" })
    .click();
  await expect(page).toHaveURL(/view=week/);
  await expect(
    page.getByRole("region", { name: "Weekly time grid" }),
  ).toBeVisible();
  await expect(axis).toHaveAttribute("aria-valuenow", "240");
  await expect(axis).toHaveAttribute("data-tick-minutes", "15");
  await page.reload();
  await expect(axis).toHaveAttribute("aria-valuenow", "240");
  await expect(axis).toHaveAttribute("data-tick-minutes", "15");
  await expect(page.locator(".weekly-grid .hour-slot").first()).toHaveClass(
    /has-quarter-hour-ticks/,
  );
});

test("day, week and month calendars keep planning focused", async ({
  page,
}, testInfo) => {
  await page.clock.setFixedTime(new Date("2026-09-07T20:37:00Z"));
  const headers = () => ({
    Origin: "http://localhost:3100",
    "Idempotency-Key": randomUUID(),
  });
  const signup = await page.request.post("/api/__test/register", {
    headers: headers(),
    data: {
      name: "Calendar member",
      email: `calendar-${randomUUID()}@example.com`,
      password: "Synthetic-calendar-password-123",
    },
  });
  expect(signup.status()).toBe(200);
  const me = await (await page.request.get("/api/v1/me")).json();
  const preferences = await page.request.put("/api/v1/preferences", {
    headers: { ...headers(), "If-Match": `"${me.preferences.version}"` },
    data: {
      timezone: "America/Edmonton",
      weekStartsOn: 1,
      weightUnit: "kg",
      distanceUnit: "km",
    },
  });
  expect(preferences.status()).toBe(200);
  const category = await (
    await page.request.post("/api/v1/categories", {
      headers: headers(),
      data: { name: "Work", color: "#196b57" },
    })
  ).json();
  async function block(
    title: string,
    startsAt: string,
    endsAt: string,
    categoryId: string | null = null,
  ) {
    const response = await page.request.post("/api/v1/time-blocks", {
      headers: headers(),
      data: { title, startsAt, endsAt, categoryId },
    });
    expect(response.status()).toBe(201);
    return response.json();
  }
  const planned = await block(
    "Morning focus",
    "2026-09-07T15:00:00Z",
    "2026-09-07T16:00:00Z",
    category.id,
  );
  await block("Walk outside", "2026-09-07T15:30:00Z", "2026-09-07T16:30:00Z");
  await block("Quick note", "2026-09-07T18:00:00Z", "2026-09-07T18:05:00Z");
  for (let i = 1; i <= 4; i++)
    await block(
      `Busy block ${i}`,
      "2026-09-07T17:00:00Z",
      "2026-09-07T17:30:00Z",
    );
  await block(
    "Overnight reading",
    "2026-09-14T05:30:00Z",
    "2026-09-14T06:30:00Z",
  );
  const longTitle =
    "A very long planning title that should remain on one line in the monthly calendar";
  await block(longTitle, "2026-09-16T19:00:00Z", "2026-09-16T20:00:00Z");
  for (const [date, count] of [
    ["2026-09-17", 4],
    ["2026-09-18", 5],
  ] as const) {
    for (let index = 0; index < count; index++) {
      await block(
        `Month density ${date} ${index + 1}`,
        `${date}T${String(14 + index).padStart(2, "0")}:00:00Z`,
        `${date}T${String(15 + index).padStart(2, "0")}:00:00Z`,
      );
    }
  }
  const cardio = await page.request.post("/api/v1/cardio-activities", {
    headers: headers(),
    data: {
      activityType: "walk",
      title: "Recorded walk",
      startedAt: "2026-09-07T15:10:00Z",
      durationSeconds: 1200,
      linkedTimeBlockId: planned.id,
    },
  });
  expect(cardio.status()).toBe(201);
  await page.goto("/?date=2026-09-07");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  const views = page.getByRole("navigation", { name: "Calendar view" });
  const grid = page.getByRole("region", { name: "Weekly time grid" });
  const day = page.getByRole("region", { name: "Daily time grid" });
  const month = page.getByRole("region", { name: "Monthly calendar" });
  const monthCell = (date: string) => month.locator(`[data-date="${date}"]`);
  async function expectMonthCount(date: string, count: number) {
    await expect(
      monthCell(date).getByRole("button", {
        name: `Select ${date}, ${count} records`,
        exact: true,
      }),
    ).toBeVisible();
  }
  async function openMonthDay(date: string) {
    const select = monthCell(date).locator(".month-select-day");
    await select.click();
    await expect(select).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.goto(`/?date=${date}&view=day`);
  }
  async function auditAndCapture(name: string) {
    await expect(page).toHaveTitle("Every168");
    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(accessibility.violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(name + ".png"),
      fullPage: true,
    });
  }
  await expect(nav.getByRole("link")).toHaveText([
    "Calendar",
    "Fitness",
    "Food",
  ]);
  await expect(views.getByRole("link")).toHaveText(["Day", "Week", "Month"]);
  await expect(
    views.getByRole("link", { name: "Week", exact: true }),
  ).toHaveAttribute("aria-current", "true");
  await expect(grid).toBeVisible();
  expect((await grid.locator(".hour-slot").first().boundingBox())!.height).toBe(
    60,
  );
  const arrows = page.locator(".calendar-date-controls").getByRole("link");
  await expect(arrows).toHaveText(["", ""]);
  const toolbarActions = page.locator(".calendar-toolbar-actions button");
  await expect(toolbarActions).toHaveCount(3);
  await expect(toolbarActions.nth(0)).toHaveAccessibleName("Add");
  await expect(toolbarActions.nth(1)).toHaveAccessibleName(
    "Search and filter calendar",
  );
  await expect(toolbarActions.nth(2)).toHaveAccessibleName("Actions");
  const todayButton = page.getByRole("link", { name: "Today", exact: true });
  const todayBounds = (await todayButton.boundingBox())!;
  const todayPreviousBounds = (await arrows.first().boundingBox())!;
  const todayGap = todayPreviousBounds.x - (todayBounds.x + todayBounds.width);
  expect(todayGap).toBeGreaterThanOrEqual(0);
  expect(todayGap).toBeLessThan(44);
  const dateTitle = page.locator(".calendar-date-title");
  await expect(dateTitle.locator("svg")).toHaveCount(0);
  await expect(dateTitle.locator(".calendar-date-month")).toHaveText(
    "September 2026",
  );
  const titleFontSize = await dateTitle.evaluate((el) =>
    parseFloat(getComputedStyle(el).fontSize),
  );
  expect(titleFontSize).toBeGreaterThanOrEqual(
    testInfo.project.name === "phone" ? 18 : 20,
  );
  expect(
    await dateTitle
      .locator(".calendar-date-month")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  async function dateStyle() {
    return dateTitle.evaluate((el) => {
      const bounds = el.getBoundingClientRect();
      return {
        centerX: bounds.x + bounds.width / 2,
        centerY: bounds.y + bounds.height / 2,
      };
    });
  }
  const initialDateStyle = await dateStyle();
  const arrowXs = [
    (await arrows.first().boundingBox())!.x,
    (await arrows.last().boundingBox())!.x,
  ];
  async function expectFixedArrows() {
    expect([
      (await arrows.first().boundingBox())!.x,
      (await arrows.last().boundingBox())!.x,
    ]).toEqual(arrowXs);
  }
  async function expectCenteredDate() {
    const dateLine = (await dateTitle
      .locator(".calendar-date-month")
      .boundingBox())!;
    const previous = (await arrows.first().boundingBox())!;
    const next = (await arrows.last().boundingBox())!;
    expect(
      Math.abs(
        dateLine.y + dateLine.height / 2 - (previous.y + previous.height / 2),
      ),
    ).toBeLessThan(1);
    expect(
      Math.abs(dateLine.y + dateLine.height / 2 - (next.y + next.height / 2)),
    ).toBeLessThan(1);
  }
  async function expectPickerCentered(picker: Locator) {
    await expect
      .poll(async () => {
        const buttonBounds = (await dateTitle.boundingBox())!;
        const pickerBounds = (await picker.boundingBox())!;
        return Math.abs(
          buttonBounds.x +
            buttonBounds.width / 2 -
            (pickerBounds.x + pickerBounds.width / 2),
        );
      })
      .toBeLessThan(1);
    const pickerBounds = (await picker.boundingBox())!;
    expect(pickerBounds.x).toBeGreaterThanOrEqual(8);
    expect(pickerBounds.x + pickerBounds.width).toBeLessThanOrEqual(
      page.viewportSize()!.width - 7.5,
    );
  }
  async function expectPickerHoverOutline(option: Locator) {
    await option.hover();
    const style = await option.evaluate((element) => {
      const computed = getComputedStyle(element);
      return {
        background: computed.backgroundColor,
        outline: computed.boxShadow,
      };
    });
    expect(style.background).toBe("rgba(0, 0, 0, 0)");
    expect(style.outline).not.toBe("none");
  }
  await expectCenteredDate();
  await dateTitle.click();
  const weekPicker = page.getByRole("dialog", { name: "Choose week" });
  await expect(weekPicker).toHaveAttribute("aria-modal", "false");
  await expectPickerCentered(weekPicker);
  await expect(
    weekPicker.getByRole("button", { name: "Close date picker" }),
  ).toHaveCount(0);
  await expect(weekPicker.locator('[aria-pressed="true"]')).toHaveCount(1);
  const selectedWeek = weekPicker.getByRole("button", {
    name: "Week of September 7, 2026",
  });
  const nextWeek = weekPicker.getByRole("button", {
    name: "Week of September 14, 2026",
  });
  await expect(selectedWeek).toHaveAttribute("aria-pressed", "true");
  expect((await selectedWeek.boundingBox())!.width).toBeGreaterThan(240);
  await expectPickerHoverOutline(nextWeek);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.locator(".calendar-toolbar").click({ position: { x: 1, y: 1 } });
  await expect(weekPicker).toHaveCount(0);
  await dateTitle.click();
  await page.keyboard.press("Escape");
  await expect(dateTitle).toBeFocused();
  await dateTitle.click();
  await nextWeek.click();
  await expect(page).toHaveURL(/date=2026-09-14&view=week/);
  await page.getByRole("link", { name: "Previous week" }).click();
  await expect(page).toHaveURL(/date=2026-09-07&view=week/);
  await views.getByRole("link", { name: "Month", exact: true }).click();
  await expect(dateTitle.locator(".calendar-date-month")).toHaveText(
    "September 2026",
  );
  expect(
    await dateTitle.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
  ).toBe(titleFontSize);
  expect(
    await dateTitle
      .locator(".calendar-date-month")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
  expect((await dateTitle.boundingBox())!.width).toBeLessThan(
    (await page.locator(".calendar-date-controls").boundingBox())!.width - 88,
  );
  const septemberButtonWidth = (await dateTitle.boundingBox())!.width;
  expect(await dateStyle()).toEqual(initialDateStyle);
  await expectFixedArrows();
  await expectCenteredDate();
  await dateTitle.click();
  const monthPicker = page.getByRole("dialog", { name: "Choose month" });
  await expectPickerCentered(monthPicker);
  await expect(
    monthPicker.getByRole("button", { name: "Close date picker" }),
  ).toHaveCount(0);
  const monthButtons = monthPicker.locator(".calendar-picker-months button");
  await expect(monthButtons).toHaveCount(12);
  const monthPositions = await Promise.all(
    [0, 1, 2, 3, 8, 11].map((index) => monthButtons.nth(index).boundingBox()),
  );
  expect(monthPositions[0]!.y).toBe(monthPositions[1]!.y);
  expect(monthPositions[1]!.y).toBe(monthPositions[2]!.y);
  expect(monthPositions[0]!.x).toBeLessThan(monthPositions[1]!.x);
  expect(monthPositions[1]!.x).toBeLessThan(monthPositions[2]!.x);
  expect(monthPositions[3]!.y).toBeGreaterThan(monthPositions[0]!.y);
  expect(monthPositions[5]!.y).toBeGreaterThan(monthPositions[4]!.y);
  expect(monthPositions[0]!.height).toBeGreaterThanOrEqual(48);
  await expect(monthButtons.last()).toBeInViewport({ ratio: 1 });
  await expectPickerHoverOutline(
    monthPicker.getByRole("button", { name: "October", exact: true }),
  );
  if (testInfo.project.name === "desktop") {
    const viewport = page.viewportSize()!;
    await page.setViewportSize({ width: 320, height: 720 });
    await expectPickerCentered(monthPicker);
    await expect(monthButtons.last()).toBeInViewport({ ratio: 1 });
    expect(
      await monthButtons
        .nth(8)
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath("calendar-month-picker-320.png"),
    });
    await page.setViewportSize(viewport);
  }
  await monthPicker
    .getByRole("button", { name: "October", exact: true })
    .click();
  await expect(dateTitle.locator(".calendar-date-month")).toHaveText(
    "October 2026",
  );
  expect((await dateTitle.boundingBox())!.width).toBe(septemberButtonWidth);
  await expectFixedArrows();
  await page.getByRole("link", { name: "Previous month" }).click();
  await expect(page).toHaveURL(/date=2026-09-01&view=month/);
  await views.getByRole("link", { name: "Day", exact: true }).click();
  await expect(dateTitle.locator(".calendar-date-month")).toHaveText(
    "September 1, 2026",
  );
  expect((await day.locator(".hour-slot").first().boundingBox())!.height).toBe(
    60,
  );
  const dayFontSize = await dateTitle.evaluate((el) =>
    parseFloat(getComputedStyle(el).fontSize),
  );
  expect(dayFontSize).toBe(titleFontSize);
  await expect(dateTitle.locator(".calendar-date-day")).toHaveCount(0);
  await expect(day.locator(".grid-day-label")).toHaveText("Tuesday1");
  expect(await dateStyle()).toEqual(initialDateStyle);
  await expectFixedArrows();
  await expectCenteredDate();
  if (testInfo.project.name === "desktop") {
    const desktopViewport = page.viewportSize()!;
    await page.setViewportSize({ width: 320, height: 720 });
    await expectCenteredDate();
    const narrowFontSize = await dateTitle.evaluate((el) =>
      parseFloat(getComputedStyle(el).fontSize),
    );
    for (const viewName of ["Month", "Week", "Day"] as const) {
      await views.getByRole("link", { name: viewName, exact: true }).click();
      expect(
        await dateTitle.evaluate((el) =>
          parseFloat(getComputedStyle(el).fontSize),
        ),
      ).toBe(narrowFontSize);
    }
    expect(
      await dateTitle
        .locator(".calendar-date-month")
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath("calendar-day-date-320.png"),
    });
    await page.setViewportSize(desktopViewport);
  }
  await dateTitle.click();
  await expectPickerCentered(page.getByRole("dialog", { name: "Choose day" }));
  await expectPickerHoverOutline(
    page
      .getByRole("dialog", { name: "Choose day" })
      .getByRole("button", { name: /September 2, 2026/ }),
  );
  await expect(
    page
      .getByRole("dialog", { name: "Choose day" })
      .getByRole("button", { name: "Close date picker" }),
  ).toHaveCount(0);
  await page
    .getByRole("dialog", { name: "Choose day" })
    .getByRole("button", { name: "Monday, September 7, 2026", exact: true })
    .click();
  await expect(page).toHaveURL(/date=2026-09-07&view=day/);
  await views.getByRole("link", { name: "Week", exact: true }).click();
  const previousBounds = (await arrows.first().boundingBox())!;
  const toolbarDateBounds = (await dateTitle.boundingBox())!;
  const nextBounds = (await arrows.last().boundingBox())!;
  expect(previousBounds.x + previousBounds.width).toBeLessThanOrEqual(
    toolbarDateBounds.x,
  );
  expect(toolbarDateBounds.x + toolbarDateBounds.width).toBeLessThanOrEqual(
    nextBounds.x,
  );
  await expect(arrows.first()).toHaveAttribute("aria-label", "Previous week");
  await expect(arrows.last()).toHaveAttribute("aria-label", "Next week");
  await expect(
    page.getByRole("button", { name: "Calendar details", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("complementary", { name: "Calendar details" }),
  ).toHaveCount(0);
  const box = await page.locator(".calendar-surface").boundingBox();
  expect(box!.height).toBeGreaterThan(page.viewportSize()!.height * 0.75);
  const viewport = page.viewportSize()!;
  const sidebar = (await page.locator(".sidebar").boundingBox())!;
  expect(box!.x).toBe(viewport.width > 900 ? sidebar.x + sidebar.width : 0);
  expect(box!.x + box!.width).toBe(viewport.width);
  expect(box!.y).toBe(viewport.width > 900 ? 0 : sidebar.height);
  await expect(page.locator(".calendar-surface")).toHaveCSS(
    "border-top-width",
    "0px",
  );
  await expect(page.locator(".calendar-surface")).toHaveCSS(
    "border-top-left-radius",
    "0px",
  );
  await expect(
    page.getByRole("link", { name: "Settings", exact: true }),
  ).toBeHidden();
  await page.getByRole("button", { name: "Account menu" }).click();
  await expect(
    page.getByRole("link", { name: "Settings", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Account menu" }),
  ).toBeFocused();
  await expect(
    grid.getByRole("button", {
      name: /Morning focus.*overlapping.*linked record/,
    }),
  ).toBeVisible();
  await expect(
    grid.getByRole("button", { name: /Recorded walk.*recorded/ }),
  ).toBeVisible();
  await auditAndCapture("calendar-week");
  await expect(grid.getByText("Busy day", { exact: true })).toHaveCount(0);
  await expect(grid.getByRole("button", { name: /Quick note/ })).toBeVisible();
  await grid
    .getByRole("button", { name: /Show all records for 2026-09-07/ })
    .click();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: /Busy block/ }),
  ).toHaveCount(4);
  await auditAndCapture("calendar-day-records");
  await page.keyboard.press("Escape");
  await expect(
    grid.getByRole("button", { name: /Show all records for 2026-09-07/ }),
  ).toBeFocused();
  await grid.getByRole("button", { name: /Morning focus.*planned/ }).dblclick();
  await expect(
    page.getByRole("heading", { name: "Linked recorded time" }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Recorded walk/ })
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "Linked plan: Morning focus",
  );
  await expect(page.getByRole("link", { name: "View activity" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("dialog")).toContainText(
    "Its editing workspace is not available yet.",
  );
  await page.goto("/?date=2026-09-07");
  await page.getByRole("link", { name: "Next week" }).click();
  await expect(page).toHaveURL(/date=2026-09-14/);
  await page.reload();
  await expect(grid).toBeVisible();
  await views.getByRole("link", { name: "Day", exact: true }).click();
  await expect(
    day.getByRole("button", { name: /Overnight reading/ }),
  ).toContainText("Until 12:30 AM");
  await page.getByRole("link", { name: "Previous day" }).click();
  await expect(page).toHaveURL(/date=2026-09-13.*view=day/);
  await expect(
    day.getByRole("button", { name: /Overnight reading/ }),
  ).toBeVisible();
  await views.getByRole("link", { name: "Month", exact: true }).click();
  await expect(month).toBeVisible();
  await expectMonthCount("2026-09-13", 1);
  await expectMonthCount("2026-09-14", 1);
  await expect(month.locator(".month-day")).toHaveCount(35);
  async function expectMonthFits() {
    await expect
      .poll(() =>
        month.evaluate((element) => ({
          horizontal: element.scrollWidth - element.clientWidth,
          vertical: element.scrollHeight - element.clientHeight,
        })),
      )
      .toEqual({ horizontal: 0, vertical: 0 });
    await expect(month.locator(".month-select-day").first()).toBeInViewport({
      ratio: 1,
    });
    await expect(month.locator(".month-select-day").last()).toBeInViewport({
      ratio: 1,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollHeight <= innerHeight,
      ),
    ).toBe(true);
  }
  await expectMonthFits();
  if (testInfo.project.name === "phone") {
    await expect(monthCell("2026-09-17").locator(".month-preview")).toHaveCount(
      0,
    );
    await expect(monthCell("2026-09-17").locator(".month-more")).toHaveText(
      "+4 more",
    );
  } else {
    const previews = monthCell("2026-09-17").locator(".month-preview");
    await expect(previews.first()).toBeVisible();
    expect(await previews.count()).toBeLessThanOrEqual(4);
  }
  const overflowCell = monthCell("2026-09-18");
  const overflow = overflowCell.getByRole("link", {
    name: /Day view for 2026-09-18, /,
  });
  const visiblePreviews = await overflowCell.locator(".month-preview").count();
  expect(visiblePreviews).toBeLessThanOrEqual(3);
  await expect(overflow).toHaveText(`+${5 - visiblePreviews} more`);
  await overflow.click();
  await expect(page).toHaveURL(/date=2026-09-18.*view=day/);
  await expect(day.getByRole("button", { name: /Month density/ })).toHaveCount(
    5,
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goBack();
  await expect(month).toBeVisible();
  const densityCell = monthCell("2026-09-17");
  const cellBounds = (await densityCell.boundingBox())!;
  const dateBounds = (await densityCell.locator(".month-date").boundingBox())!;
  expect(
    cellBounds.x + cellBounds.width - dateBounds.x - dateBounds.width,
  ).toBeLessThan(10);
  expect(dateBounds.y - cellBounds.y).toBeGreaterThanOrEqual(2);
  expect(dateBounds.y - cellBounds.y).toBeLessThan(6);
  if (testInfo.project.name !== "phone") {
    const thinRow = (await densityCell
      .locator(".month-preview")
      .first()
      .boundingBox())!;
    expect(thinRow.height).toBeLessThanOrEqual(24);
    expect(thinRow.y - dateBounds.y - dateBounds.height).toBeGreaterThanOrEqual(
      2,
    );
  }
  await auditAndCapture("calendar-month");
  await monthCell("2026-09-07")
    .getByRole("link", { name: /Day view for 2026-09-07/ })
    .click();
  await expect(page).toHaveURL(/date=2026-09-07.*view=day/);
  await expect(day.getByRole("button", { name: /Busy block/ })).toHaveCount(4);
  await day.getByRole("button", { name: /Quick note/ }).dblclick();
  await expect(
    page.getByRole("dialog", { name: "Edit plan", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goBack();
  await expect(month).toBeVisible();
  if (testInfo.project.name === "desktop") {
    const viewport = page.viewportSize()!;
    await page.setViewportSize({ width: 1440, height: 1100 });
    await expect(monthCell("2026-09-07").locator(".month-preview")).toHaveCount(
      3,
    );
    await expect(monthCell("2026-09-17").locator(".month-preview")).toHaveCount(
      4,
    );
    await expect(monthCell("2026-09-17").locator(".month-more")).toHaveCount(0);
    await expect(monthCell("2026-09-18").locator(".month-preview")).toHaveCount(
      3,
    );
    await expect(monthCell("2026-09-18").locator(".month-more")).toHaveText(
      "+2 more",
    );
    await expectMonthFits();
    const preview = monthCell("2026-09-16").getByRole("button", {
      name: new RegExp(longTitle),
    });
    const title = preview.locator("strong");
    const time = preview.locator(".record-time");
    await expect(time).toHaveText("1:00 PM");
    await expect(title).toHaveCSS("white-space", "nowrap");
    await expect(title).toHaveCSS("text-overflow", "ellipsis");
    expect(
      await title.evaluate(
        (element) => element.scrollWidth > element.clientWidth,
      ),
    ).toBe(true);
    const titleBounds = (await title.boundingBox())!;
    const timeBounds = (await time.boundingBox())!;
    expect(titleBounds.x + titleBounds.width).toBeLessThanOrEqual(timeBounds.x);
    expect(Math.abs(titleBounds.y - timeBounds.y)).toBeLessThan(4);
    await auditAndCapture("calendar-month-tall");
    await page.setViewportSize(viewport);
  }
  const normalViewport = page.viewportSize()!;
  await page.setViewportSize({ width: normalViewport.width, height: 480 });
  await expectMonthFits();
  const shortOverflow = monthCell("2026-09-18").getByRole("link", {
    name: /Day view for 2026-09-18, /,
  });
  await expect(shortOverflow).toBeVisible();
  await expect(shortOverflow).toBeInViewport({ ratio: 1 });
  await shortOverflow.click();
  await expect(page).toHaveURL(/date=2026-09-18.*view=day/);
  await expect(day.getByRole("button", { name: /Month density/ })).toHaveCount(
    5,
  );
  await page.goBack();
  await expect(month).toBeVisible();
  await page.setViewportSize(normalViewport);
  await page.getByRole("link", { name: "Previous month" }).click();
  await expect(page).toHaveURL(/date=2026-08-13.*view=month/);
  await expect(month.locator(".month-day")).toHaveCount(42);
  await expectMonthFits();
  const fullViewport = page.viewportSize()!;
  await page.setViewportSize({ width: fullViewport.width, height: 480 });
  await expectMonthFits();
  await auditAndCapture("calendar-month-short-six-weeks");
  await page.setViewportSize(fullViewport);
  await expectMonthFits();
  await page.reload();
  await expect(
    views.getByRole("link", { name: "Month", exact: true }),
  ).toHaveAttribute("aria-current", "true");
  await page.getByRole("link", { name: "Next month" }).click();
  await openMonthDay("2026-09-15");
  await expect(page).toHaveURL(/date=2026-09-15.*view=day/);
  await expect(day).toBeVisible();
  await openCalendarPlan(page);
  await expectCalendarField(page, "Start", "2026-09-15T14:00");
  await page.getByLabel("Title", { exact: true }).fill("Month planning check");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await day.getByRole("button", { name: /Month planning check/ }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Edit plan", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await auditAndCapture("calendar-day");
  await views.getByRole("link", { name: "Month", exact: true }).click();
  await expectMonthCount("2026-09-15", 1);
  await page.reload();
  await expectMonthCount("2026-09-15", 1);
  // A failed month row is never represented as an empty week.
  await page.route("**/api/v1/weeks/2026-10-05", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "UNAVAILABLE", message: "Could not load this week." },
      }),
    }),
  );
  await page.getByRole("link", { name: "Next month" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Could not load this week.",
  );
  await expect(month).toHaveCount(0);
  await page.unroute("**/api/v1/weeks/2026-10-05");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(month.locator(".month-day")).toHaveCount(35);
  await block(
    "Clock change reading",
    "2026-11-01T07:45:00Z",
    "2026-11-01T08:15:00Z",
  );
  await page.goto("/?date=2026-11-01");
  await expect(page.getByText("Clock change", { exact: true })).toBeVisible();
  await grid.getByRole("link", { name: "View day", exact: true }).click();
  await expect(
    day.getByRole("button", { name: /Clock change reading/ }),
  ).toContainText("1:45 AM MDT – 1:15 AM MST");
  await openCalendarPlan(page);
  await expect(day.locator("[data-calendar-draft]")).toContainText(
    "2:00 PM MST - 3:00 PM MST",
  );
  await page.keyboard.press("Escape");
  await expect(day.locator("[data-calendar-draft]")).toHaveCount(0);
  await page.goto("/?date=2026-09-07");
  await openCalendarPlan(page);
  await expectCalendarField(page, "Start", "2026-09-07T14:00");
  await page.getByLabel("Title", { exact: true }).fill("Keep this draft");
  await fillCalendarField(page, "End", "2026-09-07T08:00");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "End must be after start",
  );
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(
    "Keep this draft",
  );
  await page.keyboard.press("Escape");

  // Five-minute placement, explicit resizing and duration-preserving moves.
  await views.getByRole("link", { name: "Day", exact: true }).click();
  const creationSlot = day.getByRole("button", {
    name: "Select time on 2026-09-07 at 14:00",
    exact: true,
  });
  // Overlapping records can make the hour row wider than a phone viewport.
  const slotBounds = (await creationSlot.boundingBox())!;
  await creationSlot.dblclick({ position: { x: slotBounds.width / 2, y: 36 } });
  await expectCalendarField(page, "Start", "2026-09-07T14:35");
  await expectCalendarField(page, "End", "2026-09-07T15:35");
  await fillCalendarField(page, "End", "2026-09-07T15:05");
  await expectCalendarField(page, "End", "2026-09-07T15:05");
  await page.getByLabel("Title", { exact: true }).fill("Quarter-hour plan");
  await showCalendarNotes(page);
  await expect(page.getByLabel("Category", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Goal (optional)")).toHaveCount(0);
  await page.getByLabel("Notes (optional)").fill("Bring the project draft.");
  await fillCalendarField(page, "Start", "2026-09-09T23:45");
  await expectCalendarField(page, "End", "2026-09-10T00:15");
  await fillCalendarField(page, "End", "2026-09-10T00:30");
  await fillCalendarField(page, "Start", "2026-09-10T22:15");
  await expectCalendarField(page, "End", "2026-09-10T23:00");
  await auditAndCapture("calendar-planning-form");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(/date=2026-09-10.*view=day/);
  await day
    .getByRole("button", { name: /Quarter-hour plan.*planned/ })
    .dblclick();
  await fillCalendarField(page, "Start", "2026-09-10T21:15");
  await expectCalendarField(page, "End", "2026-09-10T22:00");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const originWeek: Week = await (
    await page.request.get("/api/v1/weeks/2026-09-07")
  ).json();
  const original = originWeek.blocks.find(
    (block) => block.title === "Quarter-hour plan",
  )!;
  expect(original.startsAt).toBe("2026-09-11T03:15:00.000Z");
  const actual = await page.request.post("/api/v1/time-entries", {
    headers: headers(),
    data: {
      title: "Original recorded time",
      startsAt: original.startsAt,
      endsAt: original.endsAt,
      timeBlockId: original.id,
    },
  });
  expect(actual.status()).toBe(201);
  await page.reload();
  await day
    .getByRole("button", { name: /Quarter-hour plan.*planned/ })
    .dblclick();
  await openCalendarEditorActions(page.getByRole("dialog"));
  await clickCalendarEditorAction(page, "Duplicate");
  await expect(
    page.getByRole("dialog", { name: "Duplicate plan" }),
  ).toBeVisible();
  await expectCalendarField(page, "Start", "2026-09-11T21:15");
  await expect(page.getByLabel("Category", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Goal (optional)")).toHaveCount(0);
  await expect(page.getByLabel("Notes (optional)")).toHaveValue(
    "Bring the project draft.",
  );
  await expect(
    page.getByRole("heading", { name: "Linked recorded time" }),
  ).toHaveCount(0);
  const beforeCopy: Week = await (
    await page.request.get("/api/v1/weeks/2026-09-07")
  ).json();
  expect(beforeCopy.blocks).toHaveLength(originWeek.blocks.length);
  await page
    .getByLabel("Title", { exact: true })
    .fill("Copied quarter-hour plan");
  await fillCalendarField(page, "Start", "2026-09-21T07:15");
  await expectCalendarField(page, "End", "2026-09-21T08:00");
  let lostCopy = false;
  await page.route("**/api/v1/time-blocks", async (route) => {
    if (route.request().method() === "POST" && !lostCopy) {
      lostCopy = true;
      expect(Object.keys(route.request().postDataJSON()).sort()).toEqual([
        "categoryId",
        "endsAt",
        "goalId",
        "notes",
        "startsAt",
        "title",
      ]);
      expect((await route.fetch()).status()).toBe(201);
      await route.abort("failed");
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByLabel("Title", { exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Retry save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/date=2026-09-21.*view=day/);
  await expect(
    day.getByRole("button", { name: /Copied quarter-hour plan/ }),
  ).toHaveCount(1);
  const copiedWeek: Week = await (
    await page.request.get("/api/v1/weeks/2026-09-21")
  ).json();
  expect(copiedWeek.blocks).toHaveLength(1);
  expect(copiedWeek.entries).toHaveLength(0);
  expect(copiedWeek.blocks[0]).toMatchObject({
    title: "Copied quarter-hour plan",
    categoryId: null,
    goalId: null,
    notes: original.notes,
  });
  expect(copiedWeek.blocks[0]!.id).not.toBe(original.id);
  const afterCopy: Week = await (
    await page.request.get("/api/v1/weeks/2026-09-07")
  ).json();
  expect(afterCopy.blocks.find((block) => block.id === original.id)).toEqual(
    original,
  );
  expect(
    afterCopy.entries.filter((entry) => entry.timeBlockId === original.id),
  ).toHaveLength(1);
  await day
    .getByRole("button", { name: /Copied quarter-hour plan/ })
    .dblclick();
  await openCalendarEditorActions(page.getByRole("dialog"));
  await clickCalendarEditorAction(page, "Delete block");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    day.getByRole("button", { name: /Copied quarter-hour plan/ }),
  ).toHaveCount(0);

  // Date jumping and the live marker use the account timezone, not the browser zone.
  await page.getByRole("button", { name: /Jump to date,/ }).click();
  const datePicker = page.getByRole("dialog", { name: "Choose day" });
  await expect(datePicker).toHaveAttribute("aria-modal", "false");
  await datePicker.getByRole("button", { name: "Next picker month" }).click();
  await datePicker.getByRole("button", { name: "Next picker month" }).click();
  await datePicker.getByRole("button", { name: "Next picker month" }).click();
  await datePicker
    .getByRole("button", { name: "Thursday, December 31, 2026", exact: true })
    .click();
  await expect(page).toHaveURL(/date=2026-12-31.*view=day/);
  await page.clock.setFixedTime(new Date("2026-09-21T19:20:00Z"));
  await page.goto("/?date=2026-09-07");
  const todayControl = page.getByRole("link", { name: "Today", exact: true });
  // The server clock is real; wait for the browser's injected clock after hydration.
  await expect(todayControl).toHaveAttribute(
    "href",
    "/?date=2026-09-21&view=week",
  );
  await todayControl.click();
  await expect(page).toHaveURL(/date=2026-09-21.*view=week/);
  await expect(
    grid.getByRole("img", { name: "Current time: 1:20 PM MDT" }),
  ).toBeInViewport();
  await auditAndCapture("calendar-current-time");
  const scroller = page.locator(".calendar-scroll");
  const scrollTarget = 600;
  await scroller.evaluate((element, top) => {
    element.scrollTop = top;
  }, scrollTarget);
  await expect
    .poll(() => scroller.evaluate((element) => element.scrollTop))
    .toBe(scrollTarget);
  await views.getByRole("link", { name: "Month", exact: true }).click();
  await expect(month).toBeVisible();
  await views.getByRole("link", { name: "Week", exact: true }).click();
  await expect
    .poll(() => scroller.evaluate((element) => element.scrollTop))
    .toBe(scrollTarget);
  await page.getByRole("link", { name: "Next week" }).click();
  await expect(page).toHaveURL(/date=2026-09-28/);
  await expect
    .poll(() => scroller.evaluate((element) => element.scrollTop))
    .toBe(scrollTarget);
  await page.getByRole("link", { name: "Previous week" }).click();
  await expect(
    grid.getByRole("img", { name: "Current time: 1:20 PM MDT" }),
  ).toBeVisible();
  await page.clock.setFixedTime(new Date("2026-09-21T19:35:00Z"));
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await expect(
    grid.getByRole("img", { name: "Current time: 1:35 PM MDT" }),
  ).toBeVisible();
  await expect
    .poll(() => scroller.evaluate((element) => element.scrollTop))
    .toBe(scrollTarget);
  await views.getByRole("link", { name: "Day", exact: true }).click();
  await expect
    .poll(() => scroller.evaluate((element) => element.scrollTop))
    .toBe(scrollTarget);
  await expect(
    day.getByRole("img", { name: "Current time: 1:35 PM MDT" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Next day" }).click();
  await expect(page).toHaveURL(/date=2026-09-22/);
  await expect
    .poll(() => scroller.evaluate((element) => element.scrollTop))
    .toBe(scrollTarget);
  await page.goto("/?date=2032-01-04&view=day");
  const emptyFeed = page.getByRole("region", { name: "Day activity" });
  const weekday = day.locator(".grid-day-label");
  const emptyMessage = emptyFeed.getByText(
    "No plans or activity for this day yet.",
  );
  await expect(weekday).toHaveText("Sunday4");
  await expect(emptyMessage).toBeVisible();
  await expect(emptyFeed.locator(".calendar-feed-weekday")).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath("calendar-empty-day.png"),
  });
  await page.goto("/?date=2026-09-30&view=day");
  await expect(dateTitle.locator(".calendar-date-month")).toHaveText(
    "September 30, 2026",
  );
  if (testInfo.project.name === "desktop") {
    await page.setViewportSize({ width: 320, height: 720 });
  }
  expect(
    await dateTitle
      .locator(".calendar-date-month")
      .evaluate((element) => element.scrollWidth <= element.clientWidth),
  ).toBe(true);
});
