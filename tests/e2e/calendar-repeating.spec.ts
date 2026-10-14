import { expect, test, type Page, type Locator } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { Week, CalendarItem } from "@168hours/contracts";
import AxeBuilder from "@axe-core/playwright";
const headers = () => ({
  Origin: "http://localhost:3100",
  "Idempotency-Key": randomUUID(),
});
async function start(page: Page) {
  expect(
    (
      await page.request.post("/api/auth/sign-up/email", {
        headers: headers(),
        data: {
          name: "Repeating test",
          email: `repeat-${randomUUID()}@example.com`,
          password: "Synthetic-repeating-password-123",
        },
      })
    ).status(),
  ).toBe(200);
  await page.goto("/?date=2026-09-07&view=day");
  await ready(page);
}
async function ready(page: Page) {
  await expect(page.locator(".calendar-interactions")).toHaveAttribute(
    "aria-busy",
    "false",
  );
}
const grid = (page: Page) =>
  page.getByRole("region", { name: "Daily time grid" });
const block = (page: Page, title: string) =>
  grid(page)
    .locator(".grid-record")
    .getByRole("button", { name: new RegExp(`${title}.*planned`) });
async function blocks(page: Page) {
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

test("existing timed plans gain repetition and consistent edit, delete and stop scopes with undo", async ({
  page,
}) => {
  await start(page);
  const source = await page.request.post("/api/v1/time-blocks", {
    headers: headers(),
    data: {
      title: "Focus",
      startsAt: "2026-09-07T09:00:00Z",
      endsAt: "2026-09-07T10:00:00Z",
    },
  });
  expect(source.status()).toBe(201);
  const original = await source.json();
  await page.reload();
  await ready(page);
  const editor = page.getByRole("dialog");
  await block(page, "Focus").dblclick();
  await editor.getByText("Actions", { exact: true }).click();
  await editor.getByRole("button", { name: "Repeat…", exact: true }).click();
  await expect(editor.getByLabel("Title", { exact: true })).toHaveValue(
    "Focus",
  );
  await expect(editor.getByLabel("Start time", { exact: true })).toHaveValue(
    "09:00",
  );
  await editor.getByLabel("Repeat", { exact: true }).selectOption("daily");
  await editor.getByLabel("Repeat through", { exact: true }).fill("2026-09-10");
  await editor
    .getByRole("button", { name: "Create repeating plan", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  await expect.poll(async () => (await blocks(page)).length).toBe(4);
  expect((await blocks(page)).some((b) => b.id === original.id)).toBe(true);
  await page.keyboard.press("Meta+z");
  await expect.poll(async () => (await blocks(page)).length).toBe(1);
  expect((await blocks(page))[0]).toMatchObject({
    id: original.id,
    seriesId: null,
  });
  await ready(page);
  await page.keyboard.press("Meta+Shift+z");
  await expect.poll(async () => (await blocks(page)).length).toBe(4);
  await page.goto("/?date=2026-09-08&view=day");
  await ready(page);
  await block(page, "Focus").dblclick();
  await expect(editor).toContainText("Every day until September 10, 2026");
  await editor
    .getByLabel("Apply changes to", { exact: true })
    .selectOption("following");
  await editor.getByLabel("Title", { exact: true }).fill("Future focus");
  await editor.getByRole("button", { name: "Save", exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect(block(page, "Future focus")).toBeVisible();
  const split = await blocks(page);
  expect(split.filter((b) => b.title === "Focus")).toHaveLength(1);
  expect(split.filter((b) => b.title === "Future focus")).toHaveLength(3);
  await block(page, "Future focus").click();
  await page.keyboard.press("Delete");
  await expect(editor).toContainText("Apply this deletion to:");
  await editor
    .getByRole("button", {
      name: "This and following occurrences",
      exact: true,
    })
    .click();
  await expect(editor).toHaveCount(0);
  await expect.poll(async () => (await blocks(page)).length).toBe(1);
  await ready(page);
  await page.keyboard.press("Meta+z");
  await expect.poll(async () => (await blocks(page)).length).toBe(4);
  await page.goto("/?date=2026-09-08&view=day");
  await ready(page);
  await block(page, "Future focus").dblclick();
  await editor
    .getByRole("button", { name: "Edit repeating rule", exact: true })
    .click();
  await editor
    .getByLabel("Last repeating date", { exact: true })
    .fill("2026-09-08");
  await editor
    .getByRole("button", {
      name: "Stop repeating after this date",
      exact: true,
    })
    .click();
  await expect(editor).toHaveCount(0);
  await expect.poll(async () => (await blocks(page)).length).toBe(2);
  await ready(page);
  await page.keyboard.press("Meta+z");
  await expect.poll(async () => (await blocks(page)).length).toBe(4);
});

test("all-day repetition preserves individual edits and supports series editing, deletion and history", async ({
  page,
}) => {
  await start(page);
  const editor = page.getByRole("dialog");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await editor.getByLabel("Title", { exact: true }).fill("Holiday");
  await editor.getByLabel("All day", { exact: true }).check();
  await editor.getByLabel("Date", { exact: true }).fill("2026-09-07");
  await editor.getByLabel("Repeat", { exact: true }).selectOption("daily");
  await editor.getByLabel("Repeat through", { exact: true }).fill("2026-09-10");
  await expect(editor).toContainText("4 plans will be added");
  await editor.getByRole("button", { name: "Save", exact: true }).click();
  await expect(editor).toHaveCount(0);
  await expect.poll(async () => (await items(page)).length).toBe(4);
  const plan = () =>
    grid(page).getByRole("button", {
      name: "Holiday, all day, 2026-09-07",
      exact: true,
    });
  await plan().dblclick();
  await editor.getByLabel("Title", { exact: true }).fill("Special holiday");
  await editor.getByRole("button", { name: "Save", exact: true }).click();
  await expect(editor).toHaveCount(0);
  await grid(page)
    .getByRole("button", {
      name: "Special holiday, all day, 2026-09-07",
      exact: true,
    })
    .dblclick();
  await editor
    .getByRole("button", { name: "Edit repeating rule", exact: true })
    .click();
  await expect(
    editor.getByLabel("Days per occurrence", { exact: true }),
  ).toHaveValue("1");
  await expect(editor.getByLabel("Start time", { exact: true })).toHaveCount(0);
  await editor.getByLabel("Title", { exact: true }).fill("Revised holiday");
  await editor
    .getByRole("button", { name: "Save entire series", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  expect(
    (await items(page)).filter((p) => p.title === "Revised holiday"),
  ).toHaveLength(3);
  expect(
    (await items(page)).find((p) => p.date === "2026-09-07"),
  ).toMatchObject({ title: "Special holiday", isException: true });
  await grid(page)
    .getByRole("button", {
      name: "Special holiday, all day, 2026-09-07",
      exact: true,
    })
    .dblclick();
  await editor
    .getByRole("button", { name: "Edit repeating rule", exact: true })
    .click();
  await editor.getByLabel("Replace individual edits", { exact: true }).check();
  const accessibility = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await editor
    .getByRole("button", { name: "Save entire series", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  expect(
    (await items(page)).every(
      (p) => p.title === "Revised holiday" && !p.isException,
    ),
  ).toBe(true);
  await ready(page);
  await page.keyboard.press("Meta+z");
  await expect
    .poll(
      async () =>
        (await items(page)).filter((p) => p.title === "Special holiday").length,
    )
    .toBe(1);
  await ready(page);
  await page.keyboard.press("Meta+z");
  await expect
    .poll(
      async () =>
        (await items(page)).filter((p) => p.title === "Holiday").length,
    )
    .toBe(3);
  await ready(page);
  await page.keyboard.press("Meta+z");
  await expect
    .poll(
      async () =>
        (await items(page)).filter((p) => p.title === "Holiday").length,
    )
    .toBe(4);
  await ready(page);
  await page.keyboard.press("Meta+z");
  await expect.poll(async () => (await items(page)).length).toBe(0);
});

test("repeating moves and resizes choose scope and retry the original command safely", async ({
  page,
}, testInfo) => {
  await start(page);
  const created = await page.request.post("/api/v1/calendar/series", {
    headers: headers(),
    data: {
      title: "Adjust repeat",
      timezone: "UTC",
      startDate: "2026-09-07",
      untilDate: "2026-09-09",
      startMinute: 540,
      durationMinutes: 60,
      frequency: "daily",
      interval: 1,
      weekdays: [1],
    },
  });
  expect(created.status()).toBe(201);
  await page.goto("/?date=2026-09-08&view=day");
  await ready(page);
  const target = () => block(page, "Adjust repeat");
  const dialog = page.getByRole("dialog");
  const touch = testInfo.project.name === "phone";
  async function drag(element: Locator, dy: number) {
    await element.scrollIntoViewIfNeeded();
    const box = (await element.boundingBox())!;
    const x = box.x + box.width - 4,
      y = box.y + box.height / 2;
    if (touch) {
      const cdp = await page.context().newCDPSession(page);
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x, y }],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: y + dy }],
      });
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
      await cdp.detach();
    } else {
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x, y + dy, { steps: 4 });
      await page.mouse.up();
    }
  }
  await target().click();
  await drag(target(), 60);
  await expect(dialog).toContainText("Apply this adjustment to:");
  expect((await blocks(page)).every((b) => b.startsAt.includes("T09:00"))).toBe(
    true,
  );
  const keys: string[] = [],
    versions: string[] = [];
  await page.route("**/api/v1/calendar/series/*/change", async (route) => {
    keys.push(route.request().headers()["idempotency-key"]!);
    versions.push(route.request().headers()["if-match"]!);
    if (keys.length === 1) {
      expect((await route.fetch()).status()).toBe(200);
      await route.abort("failed");
    } else await route.continue();
  });
  await dialog
    .getByRole("button", {
      name: "This and following occurrences",
      exact: true,
    })
    .click();
  await dialog.getByRole("button", { name: "Retry same change" }).click();
  await expect(dialog).toHaveCount(0);
  expect(keys).toHaveLength(2);
  expect(keys[1]).toBe(keys[0]);
  expect(versions[1]).toBe(versions[0]);
  await page.unroute("**/api/v1/calendar/series/*/change");
  expect(
    (await blocks(page)).filter((b) => b.startsAt.includes("T10:00")),
  ).toHaveLength(2);
  expect(
    (await blocks(page)).filter((b) => b.startsAt.includes("T09:00")),
  ).toHaveLength(1);
  await ready(page);
  if (touch) {
    await target().dblclick();
    await dialog.getByText("Actions", { exact: true }).click();
    await dialog
      .getByRole("button", { name: "Move or resize on calendar" })
      .click();
    await page.getByRole("button", { name: "Resize end", exact: true }).click();
  }
  await drag(
    touch
      ? target()
      : grid(page)
          .locator(".grid-record")
          .filter({
            has: page.getByRole("button", { name: /Adjust repeat.*planned/ }),
          })
          .locator(".resize-end"),
    30,
  );
  await expect(dialog).toContainText("Apply this adjustment to:");
  await dialog
    .getByRole("button", { name: "Entire series", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(
    (await blocks(page)).filter(
      (b) => Date.parse(b.endsAt) - Date.parse(b.startsAt) === 90 * 60000,
    ),
  ).toHaveLength(2);
  await ready(page);
  await page.keyboard.press("Meta+z");
  await expect
    .poll(async () =>
      (await blocks(page)).every(
        (b) => Date.parse(b.endsAt) - Date.parse(b.startsAt) === 60 * 60000,
      ),
    )
    .toBe(true);
  await ready(page);
  await page.keyboard.press("Meta+z");
  await expect
    .poll(async () =>
      (await blocks(page)).every((b) => b.startsAt.includes("T09:00")),
    )
    .toBe(true);
});
