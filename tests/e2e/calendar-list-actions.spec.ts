import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { Block, CalendarItem } from "@168hours/contracts";

const date = "2026-09-07";
const headers = () => ({
  Origin: "http://localhost:3100",
  "Idempotency-Key": randomUUID(),
});
const popup = (page: Page) => page.locator("dialog[open]");
const editor = (page: Page) =>
  page.getByRole("dialog", { name: "Edit plan", exact: true });
const menu = (page: Page) =>
  page.getByRole("menu", { name: "Calendar actions" });
const plan = (page: Page, id: string) =>
  popup(page).locator(`[data-calendar-record="${id}"]`);
async function ready(page: Page) {
  await expect(page.locator(".calendar-interactions")).toHaveAttribute(
    "aria-busy",
    "false",
  );
}
async function clip(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const key = Object.keys(sessionStorage).find((key) =>
      key.startsWith("calendar-clip:v2:"),
    );
    if (!key) return [];
    const snapshot = JSON.parse(sessionStorage.getItem(key)!).snapshot;
    return [...snapshot.blocks, ...snapshot.items]
      .map((p: { title: string }) => p.title)
      .sort();
  });
}
async function start(page: Page, view = "week", upcoming = false) {
  await page.clock.setFixedTime(
    new Date(`${date}T${upcoming ? "08" : "12"}:00:00Z`),
  );
  expect(
    (
      await page.request.post("/api/auth/sign-up/email", {
        headers: headers(),
        data: {
          name: "Calendar list actions",
          email: `list-actions-${randomUUID()}@example.com`,
          password: "Synthetic-calendar-password-123",
        },
      })
    ).status(),
  ).toBe(200);
  const blocks: Block[] = [],
    items: CalendarItem[] = [];
  for (let i = 0; i < 6; i++) {
    const response = await page.request.post("/api/v1/time-blocks", {
      headers: headers(),
      data: {
        title: `Busy plan ${i + 1}`,
        startsAt: `${date}T09:00:00Z`,
        endsAt: `${date}T10:00:00Z`,
      },
    });
    expect(response.status()).toBe(201);
    blocks.push(await response.json());
  }
  for (let i = 0; i < 2; i++) {
    const response = await page.request.post("/api/v1/calendar/items", {
      headers: headers(),
      data: {
        title: `All-day plan ${i + 1}`,
        kind: "all_day",
        date,
        endDate: date,
      },
    });
    expect(response.status()).toBe(201);
    items.push(await response.json());
  }
  await page.goto(`/?date=${date}&view=${view}`);
  await ready(page);
  return { blocks, items };
}
async function openPopup(page: Page) {
  await page
    .getByRole("region", { name: "Weekly time grid" })
    .getByRole("button", { name: new RegExp(`Show all records for ${date},`) })
    .first()
    .click();
  await expect(popup(page)).toBeVisible();
  await expect(
    popup(page).getByRole("region", { name: "Day activity" }),
  ).toBeVisible();
}

test("overflow timed and all-day plans share selection, group actions, editing and undo", async ({
  page,
}) => {
  const { blocks, items } = await start(page);
  await openPopup(page);
  await expect(popup(page).locator("[data-calendar-record]")).toHaveCount(8);
  const timed = plan(page, blocks[3]!.id),
    allDay = plan(page, items[1]!.id);
  await timed.click();
  await expect(timed).toHaveAttribute("aria-pressed", "true");
  await expect(editor(page)).toHaveCount(0);
  await page.keyboard.press("Meta+c");
  await expect.poll(() => clip(page)).toEqual([blocks[3]!.title]);
  await timed.press("Shift+F10");
  await expect(popup(page).getByRole("menu")).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).include('[role="menu"]').analyze())
      .violations,
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(popup(page)).toBeVisible();
  await expect(timed).toBeFocused();
  await allDay.click({ modifiers: ["Meta"] });
  await expect(allDay).toHaveAttribute("aria-pressed", "true");
  await expect(timed).toHaveAttribute("aria-pressed", "true");
  await allDay.click({ button: "right" });
  await menu(page)
    .getByRole("menuitem", { name: "Move…", exact: true })
    .click();
  const move = page.getByRole("dialog", {
    name: "Move selected plans",
    exact: true,
  });
  await expect(
    popup(page).getByRole("dialog", {
      name: "Move selected plans",
      exact: true,
    }),
  ).toBeVisible();
  await move
    .getByRole("button", { name: "Destination date", exact: true })
    .click();
  await expect(
    move.getByRole("dialog", { name: "Choose day", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(move).toBeVisible();
  await move.getByRole("button", { name: "Start time", exact: true }).click();
  await expect(
    move.getByRole("dialog", { name: "Choose start time", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(move).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(move).toHaveCount(0);
  await expect(popup(page)).toBeVisible();
  await page.keyboard.press("Meta+c");
  await expect
    .poll(() => clip(page))
    .toEqual([blocks[3]!.title, items[1]!.title].sort());
  await allDay.press("Backspace");
  await expect(timed).toHaveCount(0);
  await expect(allDay).toHaveCount(0);
  await ready(page);
  // The notice and its button must remain in the modal's interactive layer.
  await popup(page).getByRole("button", { name: "Undo", exact: true }).click();
  await expect(timed).toBeVisible();
  await expect(allDay).toBeVisible();
  await ready(page);
  await allDay.click();
  await expect(allDay).toHaveAttribute("aria-pressed", "true");
  await expect(timed).toHaveAttribute("aria-pressed", "false");
  await expect(editor(page)).toHaveCount(0);
  await allDay.press("ContextMenu");
  await menu(page).getByRole("menuitem", { name: "Copy", exact: true }).click();
  await expect.poll(() => clip(page)).toEqual([items[1]!.title]);
  await allDay.press("Delete");
  await expect(allDay).toHaveCount(0);
  await ready(page);
  await page.keyboard.press("Meta+z");
  await expect(allDay).toBeVisible();
  await ready(page);
  await allDay.dblclick();
  await expect(popup(page)).toHaveCount(0);
  await expect(editor(page).getByLabel("Title", { exact: true })).toHaveValue(
    items[1]!.title,
  );
  await page.keyboard.press("Escape");
  await openPopup(page);
  await timed.click({ button: "right" });
  await menu(page).getByRole("menuitem", { name: "Edit", exact: true }).click();
  await expect(popup(page)).toHaveCount(0);
  await expect(editor(page).getByLabel("Title", { exact: true })).toHaveValue(
    blocks[3]!.title,
  );
});

test("overflow deletion retries and repeating scope controls remain usable inside the modal", async ({
  page,
}) => {
  const { blocks } = await start(page);
  const response = await page.request.post("/api/v1/calendar/series", {
    headers: headers(),
    data: {
      title: "Repeating overflow",
      timezone: "UTC",
      startDate: date,
      untilDate: "2026-09-09",
      startMinute: 540,
      durationMinutes: 60,
      frequency: "daily",
      interval: 1,
      weekdays: [1],
    },
  });
  expect(response.status()).toBe(201);
  const week = await (await page.request.get(`/api/v1/weeks/${date}`)).json();
  const repeated: Block = week.blocks.find(
    (block: Block) =>
      block.title === "Repeating overflow" && block.occurrenceDate === date,
  );
  expect(repeated).toBeTruthy();
  await page.reload();
  await ready(page);
  await openPopup(page);
  const source = plan(page, blocks[4]!.id);
  const keys: string[] = [];
  await page.route(`**/api/v1/time-blocks/${blocks[4]!.id}`, async (route) => {
    if (route.request().method() !== "DELETE") return route.continue();
    keys.push(route.request().headers()["idempotency-key"]!);
    if (keys.length === 1) {
      expect((await route.fetch()).status()).toBe(200);
      await route.abort("failed");
    } else await route.continue();
  });
  await source.click();
  await source.press("Delete");
  await popup(page)
    .getByRole("button", { name: "Retry same change", exact: true })
    .click();
  await expect(source).toHaveCount(0);
  await ready(page);
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  await popup(page).getByRole("button", { name: "Undo", exact: true }).click();
  await expect(source).toBeVisible();
  await ready(page);
  const occurrence = plan(page, repeated.id);
  await occurrence.click();
  await occurrence.press("Delete");
  const scope = popup(page).getByRole("dialog", {
    name: "Delete repeating plan",
    exact: true,
  });
  await expect(scope).toBeVisible();
  await scope
    .getByRole("button", { name: "This occurrence", exact: true })
    .click();
  await expect(occurrence).toHaveCount(0);
  await ready(page);
  await page.keyboard.press("Meta+z");
  await expect(occurrence).toBeVisible();
  await ready(page);
  expect(
    (await new AxeBuilder({ page }).include("dialog[open]").analyze())
      .violations,
  ).toEqual([]);
});

test("Next plans select, copy, group-delete, undo and edit without leaving the activity list", async ({
  page,
}, info) => {
  await start(page, "day", true);
  const feed = page.getByRole("region", { name: "Day activity" });
  const next = feed.locator(".day-at-a-glance-next");
  await expect(next).toBeVisible();
  const id = await next.getAttribute("data-calendar-record");
  expect(id).toBeTruthy();
  const title = (await next.locator("span").innerText()).replace(
    "Planned: ",
    "",
  );
  if (info.project.name === "phone") await next.tap();
  else await next.click();
  await expect(next).toHaveAttribute("aria-pressed", "true");
  await expect(editor(page)).toHaveCount(0);
  expect(await next.evaluate((e) => getComputedStyle(e).color)).toBe(
    "rgb(255, 255, 255)",
  );
  await page.keyboard.press("Meta+c");
  await expect.poll(() => clip(page)).toEqual([title]);
  await next.press("Shift+F10");
  await menu(page)
    .getByRole("menuitem", { name: "Delete", exact: true })
    .click();
  await expect(feed.locator(`[data-calendar-record="${id}"]`)).toHaveCount(0);
  await ready(page);
  await page.keyboard.press("Meta+z");
  await expect(next).toHaveAttribute("data-calendar-record", id!);
  await ready(page);
  await next.click();
  const other = feed
    .locator(`.calendar-record.planned:not([data-calendar-record="${id}"])`)
    .first();
  const otherId = await other.getAttribute("data-calendar-record");
  await other.click({ modifiers: ["Meta"] });
  await expect(next).toHaveAttribute("aria-pressed", "true");
  await expect(other).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Meta+c");
  await expect.poll(async () => (await clip(page)).length).toBe(2);
  await other.press("Delete");
  await expect(feed.locator(`[data-calendar-record="${id}"]`)).toHaveCount(0);
  await expect(feed.locator(`[data-calendar-record="${otherId}"]`)).toHaveCount(
    0,
  );
  await ready(page);
  await page.keyboard.press("Meta+z");
  await expect(next).toHaveAttribute("data-calendar-record", id!);
  await expect(
    feed.locator(`[data-calendar-record="${otherId}"]`).first(),
  ).toBeVisible();
  await ready(page);
  await next.dblclick();
  await expect(editor(page).getByLabel("Title", { exact: true })).toHaveValue(
    title,
  );
  const field = editor(page).getByLabel("Title", { exact: true });
  await field.press("End");
  await field.press("Backspace");
  await expect(field).toHaveValue(title.slice(0, -1));
  await page.keyboard.press("Escape");
  await next.press("Enter");
  await expect(editor(page).getByLabel("Title", { exact: true })).toHaveValue(
    title,
  );
});

test("all-day-only group movement uses a date without a time field", async ({
  page,
}) => {
  const { items, blocks } = await start(page);
  await openPopup(page);
  await plan(page, items[0]!.id).click();
  await plan(page, items[1]!.id).click({ modifiers: ["Meta"] });
  await plan(page, items[0]!.id).press("Shift+F10");
  await menu(page)
    .getByRole("menuitem", { name: "Move…", exact: true })
    .click();
  const move = page.getByRole("dialog", {
    name: "Move selected plans",
    exact: true,
  });
  await expect(move).toContainText(/All-day plan [12]/);
  await expect(
    move.getByRole("button", { name: "Start time", exact: true }),
  ).toHaveCount(0);
  await move
    .getByRole("button", { name: "Destination date", exact: true })
    .click();
  await move
    .getByRole("dialog", { name: "Choose day", exact: true })
    .getByRole("button", { name: /September 8, 2026/ })
    .click();
  await move.getByRole("button", { name: "Move plans", exact: true }).click();
  await expect(move).toHaveCount(0);
  const week = await (
    await page.request.get("/api/v1/weeks/2026-09-07")
  ).json();
  expect(week.blocks.map((block: Block) => block.startsAt)).toEqual(
    blocks.map((block) => block.startsAt),
  );
  const moved = await (
    await page.request.get(
      "/api/v1/calendar/items?from=2026-09-07&to=2026-09-09",
    )
  ).json();
  expect(moved).toHaveLength(2);
  expect(
    moved.every(
      (item: CalendarItem) =>
        item.date === "2026-09-08" && item.endDate === "2026-09-08",
    ),
  ).toBe(true);
});
