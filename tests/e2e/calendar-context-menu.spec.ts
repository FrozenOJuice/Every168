import { expectCalendarField } from "./helpers/calendar-form";
import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import type { Block, CalendarItem, Week } from "@168hours/contracts";

const headers = () => ({
  Origin: "http://localhost:3100",
  "Idempotency-Key": randomUUID(),
});

test("context menus disable unavailable actions and support keyboard actions and outside dismissal", async ({
  page,
}, testInfo) => {
  const { records } = await start(page, "day");
  const first = records[0]!;
  const slot = page.getByRole("button", {
    name: "Select time on 2026-09-07 at 12:00",
    exact: true,
  });
  await slot.focus();
  await page.keyboard.press("Shift+F10");
  await expect(action(page, "Paste here")).toBeDisabled();
  await expect(action(page, "Undo")).toBeDisabled();
  await expect(action(page, "Redo")).toBeDisabled();
  await page.locator(".calendar-toolbar").click({ position: { x: 2, y: 2 } });
  await expect(menu(page)).toHaveCount(0);
  await right(page, first.id);
  const accessibility = await new AxeBuilder({ page })
    .include('[role="menu"]')
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.screenshot({
    path: `test-results/calendar-context-menu-${testInfo.project.name}.png`,
  });
  await page.keyboard.press("Meta+c");
  await expect(menu(page)).toHaveCount(0);
  await expect(page.locator("[data-calendar-clipboard-status]")).toHaveText(
    "Plan copied.",
  );
  await slot.focus();
  await page.keyboard.press("ContextMenu");
  await expect(action(page, "Paste here")).toBeEnabled();
  await page.keyboard.press("Meta+v");
  await expect.poll(async () => (await blocks(page)).length).toBe(3);
  expect(
    (await blocks(page)).find(
      (block) => block.startsAt === "2026-09-07T12:00:00.000Z",
    ),
  ).toBeTruthy();
});
async function start(page: Page, view: string) {
  expect(
    (
      await page.request.post("/api/__test/register", {
        headers: headers(),
        data: {
          name: "Context menu",
          email: `context-${randomUUID()}@example.com`,
          password: "Synthetic-context-password-123",
        },
      })
    ).status(),
  ).toBe(200);
  const records: Block[] = [];
  for (const [title, day, hour] of [
    ["First plan", "07", "09"],
    ["Second plan", "08", "10"],
  ]) {
    const response = await page.request.post("/api/v1/time-blocks", {
      headers: headers(),
      data: {
        title,
        startsAt: `2026-09-${day}T${hour}:00:00Z`,
        endsAt: `2026-09-${day}T${Number(hour) + 1}:00:00Z`,
      },
    });
    expect(response.status()).toBe(201);
    records.push(await response.json());
  }
  const response = await page.request.post("/api/v1/calendar/items", {
    headers: headers(),
    data: {
      title: "All-day plan",
      kind: "all_day",
      date: "2026-09-07",
      endDate: "2026-09-07",
    },
  });
  expect(response.status()).toBe(201);
  const item: CalendarItem = await response.json();
  await page.goto(`/?date=2026-09-07&view=${view}`);
  await expect(page.locator(".calendar-interactions")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  return { records, item };
}
const menu = (page: Page) =>
  page.getByRole("menu", { name: "Calendar actions" });
const action = (page: Page, name: string) =>
  menu(page).getByRole("menuitem", { name, exact: true });
const record = (page: Page, id: string) =>
  page.locator(`[data-calendar-record="${id}"]`).first();
async function blocks(page: Page): Promise<Block[]> {
  return (
    (await (await page.request.get("/api/v1/weeks/2026-09-07")).json()) as Week
  ).blocks;
}
async function items(page: Page): Promise<CalendarItem[]> {
  return (
    await page.request.get(
      "/api/v1/calendar/items?from=2026-09-07&to=2026-09-13",
    )
  ).json();
}
async function ready(page: Page) {
  await expect(page.locator(".calendar-interactions")).toHaveAttribute(
    "aria-busy",
    "false",
  );
}
async function choose(page: Page, name: string) {
  await action(page, name).click();
  await expect(menu(page)).toHaveCount(0);
}
async function right(page: Page, id: string) {
  await ready(page);
  await record(page, id).click({ button: "right" });
  await expect(menu(page)).toBeVisible();
}

test("plan menus reuse editing, clipboard-independent duplication, group deletion and history", async ({
  page,
}) => {
  const { records, item } = await start(page, "day");
  const first = records[0]!;
  await right(page, first.id);
  await expect(record(page, first.id)).toHaveAttribute("aria-pressed", "true");
  await expect(menu(page).getByRole("menuitem")).toHaveText([
    "EditEnter",
    "Duplicate",
    /Copy/,
    /Paste here/,
    /Delete/,
    /Undo/,
    /Redo/,
  ]);
  await expect(action(page, "Paste here")).toBeDisabled();
  await choose(page, "Copy");
  await record(page, item.id).focus();
  await page.keyboard.press("Shift+F10");
  await expect(action(page, "Edit")).toBeFocused();
  await choose(page, "Duplicate");
  await expect.poll(async () => (await items(page)).length).toBe(2);
  await right(page, first.id);
  await choose(page, "Undo");
  await expect.poll(async () => (await items(page)).length).toBe(1);
  await right(page, first.id);
  await choose(page, "Redo");
  await expect.poll(async () => (await items(page)).length).toBe(2);
  await right(page, first.id);
  await choose(page, "Undo");
  await expect.poll(async () => (await items(page)).length).toBe(1);
  // Duplicate did not replace the timed-plan clipboard.
  const heading = page
    .getByRole("region", { name: "Daily time grid" })
    .getByRole("button", { name: "Select 2026-09-07", exact: true });
  await heading.click({ button: "right" });
  await expect(action(page, "Open Day")).toHaveCount(0);
  await choose(page, "Paste into day");
  await expect.poll(async () => (await blocks(page)).length).toBe(3);
  await right(page, first.id);
  await choose(page, "Undo");
  await expect.poll(async () => (await blocks(page)).length).toBe(2);

  await record(page, first.id).click();
  await record(page, item.id).click({ modifiers: ["Meta"] });
  await right(page, first.id);
  await expect(menu(page).getByRole("menuitem")).toHaveCount(7);
  await expect(action(page, "Move…")).toBeEnabled();
  await expect(action(page, "Edit")).toHaveCount(0);
  await expect(record(page, item.id)).toHaveAttribute("aria-pressed", "true");
  await choose(page, "Duplicate");
  await expect.poll(async () => (await blocks(page)).length).toBe(3);
  await expect.poll(async () => (await items(page)).length).toBe(2);
  await right(page, first.id);
  await choose(page, "Undo");
  await expect.poll(async () => (await items(page)).length).toBe(1);
  await ready(page);
  await record(page, first.id).click();
  await record(page, item.id).click({ modifiers: ["Meta"] });
  await right(page, item.id);
  await choose(page, "Delete");
  await expect.poll(async () => (await items(page)).length).toBe(0);
  await expect.poll(async () => (await blocks(page)).length).toBe(1);
  await heading.click({ button: "right" });
  await choose(page, "Undo");
  await expect.poll(async () => (await items(page)).length).toBe(1);
  await expect.poll(async () => (await blocks(page)).length).toBe(2);
  await right(page, first.id);
  await choose(page, "Edit");
  const editor = page.getByRole("dialog");
  await expect(editor.getByLabel("Title", { exact: true })).toHaveValue(
    "First plan",
  );
  await editor.getByLabel("Title", { exact: true }).click({ button: "right" });
  await expect(menu(page)).toHaveCount(0);
  await page.keyboard.press("Escape");
  await record(page, first.id).focus();
  await page.keyboard.press("ContextMenu");
  await expect(action(page, "Edit")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(action(page, "Duplicate")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(record(page, first.id)).toBeFocused();
});

test("Week empty-space destinations preserve selection and mixed clipboard types", async ({
  page,
}) => {
  const { records, item } = await start(page, "week");
  await record(page, records[0]!.id).click();
  await record(page, item.id).click({ modifiers: ["Meta"] });
  await right(page, records[0]!.id);
  await choose(page, "Copy");
  const slot = page.getByRole("button", {
    name: "Select time on 2026-09-08 at 11:00",
    exact: true,
  });
  const bounds = await slot.boundingBox();
  expect(bounds).toBeTruthy();
  await slot.click({
    button: "right",
    position: { x: 15, y: (bounds!.height * 37) / 60 },
  });
  await expect(record(page, records[0]!.id)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(record(page, item.id)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-selected-time]")).toHaveCount(0);
  await choose(page, "Paste here");
  await expect.poll(async () => (await blocks(page)).length).toBe(3);
  await expect.poll(async () => (await items(page)).length).toBe(2);
  expect(
    (await blocks(page)).find(
      (block) => block.title === "First plan" && block.id !== records[0]!.id,
    )?.startsAt,
  ).toBe("2026-09-08T11:35:00.000Z");
  expect((await items(page)).find((plan) => plan.id !== item.id)).toMatchObject(
    { kind: "all_day", date: "2026-09-08" },
  );
  const area = page.getByRole("group", { name: "All-day area for 2026-09-09" });
  await area.focus();
  await page.keyboard.press("Shift+F10");
  await expect(action(page, "Add all-day plan")).toBeFocused();
  await choose(page, "Paste");
  await expect.poll(async () => (await blocks(page)).length).toBe(4);
  expect(
    (await blocks(page)).find(
      (block) => block.startsAt === "2026-09-09T09:00:00.000Z",
    ),
  ).toBeTruthy();
  await area.focus();
  await page.keyboard.press("Shift+F10");
  await choose(page, "Add all-day plan");
  const editor = page.getByRole("dialog");
  await expect(editor.getByLabel("All day", { exact: true })).toBeChecked();
  await expectCalendarField(editor, "Date", "2026-09-09");
  await page.keyboard.press("Escape");
  await slot.focus();
  await page.keyboard.press("ContextMenu");
  await choose(page, "Add plan here");
  await expectCalendarField(
    page.getByRole("dialog"),
    "Start",
    "2026-09-08T11:00",
  );
  await page.keyboard.press("Escape");
  const axis = page.getByRole("slider", { name: "Hour spacing" });
  await axis.focus();
  await page.keyboard.press("ArrowUp");
  await expect(axis).not.toHaveAttribute("aria-valuenow", "60");
  await page.keyboard.press("Shift+F10");
  await choose(page, "Reset zoom");
  await expect(axis).toHaveAttribute("aria-valuenow", "60");
});

test("selected-day menus use the invoked day as paste anchor in Week and Month", async ({
  page,
}) => {
  await start(page, "month");
  for (const view of ["month", "week"]) {
    if (view === "week") await page.goto("/?date=2026-09-07&view=week");
    const day = (date: string) =>
      view === "month"
        ? page.locator(`[data-date="${date}"] .month-select-day`)
        : page
            .locator(`.grid-day-heading[data-date="${date}"]`)
            .getByRole("button", { name: `Select ${date}`, exact: true });
    async function clickDay(
      date: string,
      options: { button?: "right"; modifiers?: "Meta"[] } = {},
    ) {
      await ready(page);
      const box = await day(date).boundingBox();
      await day(date).click({
        ...options,
        ...(view === "month" ? { position: { x: box!.width - 7, y: 7 } } : {}),
      });
    }
    await clickDay("2026-09-07");
    await clickDay("2026-09-08", { modifiers: ["Meta"] });
    await clickDay("2026-09-08", { button: "right" });
    await expect(day("2026-09-07")).toHaveAttribute("aria-pressed", "true");
    await expect(day("2026-09-08")).toHaveAttribute("aria-pressed", "true");
    await expect(action(page, "Copy selected days")).toBeEnabled();
    await choose(page, "Copy selected days");
    await clickDay("2026-09-09");
    await clickDay("2026-09-10", { modifiers: ["Meta"] });
    await day("2026-09-10").focus();
    await page.keyboard.press("Shift+F10");
    await expect(day("2026-09-09")).toHaveAttribute("aria-pressed", "true");
    await expect(day("2026-09-10")).toHaveAttribute("aria-pressed", "true");
    await choose(page, "Paste");
    await expect.poll(async () => (await blocks(page)).length).toBe(4);
    expect(
      (await blocks(page)).find(
        (block) =>
          block.title === "First plan" &&
          block.startsAt.startsWith("2026-09-10"),
      ),
    ).toBeTruthy();
    expect(
      (await blocks(page)).find(
        (block) =>
          block.title === "Second plan" &&
          block.startsAt.startsWith("2026-09-11"),
      ),
    ).toBeTruthy();
    await clickDay("2026-09-10", { button: "right" });
    await choose(page, "Undo");
    await expect.poll(async () => (await blocks(page)).length).toBe(2);
    await clickDay("2026-09-12", { button: "right" });
    await expect(day("2026-09-09")).toHaveAttribute("aria-pressed", "false");
    await expect(day("2026-09-12")).toHaveAttribute("aria-pressed", "true");
    await expect(action(page, "Copy day")).toBeDisabled();
    await expect(action(page, "Open Day")).toBeEnabled();
    const bounds = await menu(page).boundingBox();
    const viewport = page.viewportSize()!;
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
    await page.keyboard.press("Escape");
  }
  await page.screenshot({ path: "test-results/calendar-context-week.png" });
  const heading = page
    .locator('.grid-day-heading[data-date="2026-09-12"]')
    .getByRole("button", { name: "Select 2026-09-12", exact: true });
  await heading.click({ button: "right" });
  await choose(page, "Open Day");
  await expect(page).toHaveURL(/view=day/);
});

test("plan menus paste mixed clipboard content at occupied times or days", async ({
  page,
}) => {
  const { records, item } = await start(page, "week");
  await record(page, records[0]!.id).click();
  await record(page, records[1]!.id).click({ modifiers: ["Meta"] });
  await record(page, item.id).click({ modifiers: ["Meta"] });
  await right(page, records[0]!.id);
  await choose(page, "Copy");

  // Compact phone Month cells show counts rather than individual plan targets.
  const views =
    page.viewportSize()!.width > 700
      ? ["day", "week", "month"]
      : ["day", "week"];
  for (const view of views) {
    await page.goto(`/?date=2026-09-07&view=${view}`);
    await ready(page);
    if (view === "month") {
      await right(page, records[1]!.id);
    } else {
      const destination = record(page, records[0]!.id);
      await destination.scrollIntoViewIfNeeded();
      const planBounds = (await destination.boundingBox())!;
      const hourBounds = (await page
        .getByRole("button", {
          name: "Select time on 2026-09-07 at 09:00",
          exact: true,
        })
        .boundingBox())!;
      await page.mouse.click(
        planBounds.x + planBounds.width / 2,
        hourBounds.y + (hourBounds.height * 37) / 60,
        { button: "right" },
      );
    }
    await expect(action(page, "Paste here")).toBeEnabled();
    await choose(page, "Paste here");
    await expect.poll(async () => (await blocks(page)).length).toBe(4);
    await expect.poll(async () => (await items(page)).length).toBe(2);
    const pasted = (await blocks(page)).filter(
      (block) => !records.some((source) => source.id === block.id),
    );
    expect(pasted.find((block) => block.title === "First plan")?.startsAt).toBe(
      view === "month"
        ? "2026-09-08T09:00:00.000Z"
        : "2026-09-07T09:35:00.000Z",
    );
    expect(
      pasted.find((block) => block.title === "Second plan")?.startsAt,
    ).toBe(
      view === "month"
        ? "2026-09-09T10:00:00.000Z"
        : "2026-09-08T10:35:00.000Z",
    );
    expect(
      (await items(page)).find((plan) => plan.id !== item.id),
    ).toMatchObject({
      kind: "all_day",
      date: view === "month" ? "2026-09-08" : "2026-09-07",
    });
    await ready(page);
    await page.keyboard.press("Meta+z");
    await expect.poll(async () => (await blocks(page)).length).toBe(2);
    await expect.poll(async () => (await items(page)).length).toBe(1);
    if (view === "day") {
      await ready(page);
      await page.keyboard.press("Meta+Shift+z");
      await expect
        .poll(
          async () =>
            (await blocks(page)).filter((block) =>
              pasted.some((plan) => plan.id === block.id),
            ).length,
        )
        .toBe(2);
      await ready(page);
      await page.keyboard.press("Meta+z");
      await expect.poll(async () => (await blocks(page)).length).toBe(2);
    }
  }

  await page.goto("/?date=2026-09-07&view=week");
  await ready(page);
  await record(page, records[1]!.id).focus();
  await page.keyboard.press("Shift+F10");
  await choose(page, "Paste here");
  await expect.poll(async () => (await blocks(page)).length).toBe(4);
  expect(
    (await blocks(page)).find(
      (block) => block.id !== records[0]!.id && block.title === "First plan",
    )?.startsAt,
  ).toBe("2026-09-08T10:00:00.000Z");
  await ready(page);
  await page.keyboard.press("Meta+z");
  await expect.poll(async () => (await blocks(page)).length).toBe(2);
  await right(page, item.id);
  await choose(page, "Paste here");
  await expect.poll(async () => (await blocks(page)).length).toBe(4);
  expect(
    (await blocks(page)).find(
      (block) => block.id !== records[0]!.id && block.title === "First plan",
    )?.startsAt,
  ).toBe("2026-09-07T09:00:00.000Z");
  expect((await items(page)).find((plan) => plan.id !== item.id)).toMatchObject(
    { kind: "all_day", date: "2026-09-07" },
  );
});
