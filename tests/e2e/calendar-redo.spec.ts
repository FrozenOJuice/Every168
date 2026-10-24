import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { Block, CalendarItem, Week } from "@168hours/contracts";
const headers = (version?: number) => ({
  Origin: "http://localhost:3100",
  "Idempotency-Key": randomUUID(),
  ...(version ? { "If-Match": `"${version}"` } : {}),
});
async function start(page: Page) {
  expect(
    (
      await page.request.post("/api/auth/sign-up/email", {
        headers: headers(),
        data: {
          name: "Calendar redo",
          email: `redo-${randomUUID()}@example.com`,
          password: "Synthetic-history-password-123",
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
async function step(page: Page, key: string) {
  await ready(page);
  await page
    .locator(".calendar-toolbar")
    .getByRole("button", { name: "Add", exact: true })
    .focus();
  await page.keyboard.press(key);
}
async function blocks(page: Page): Promise<Block[]> {
  return (
    (await (await page.request.get("/api/v1/weeks/2026-09-07")).json()) as Week
  ).blocks;
}
async function items(page: Page): Promise<CalendarItem[]> {
  return (
    await page.request.get(
      "/api/v1/calendar/items?from=2026-09-07&to=2026-09-09",
    )
  ).json();
}
async function create(page: Page, title: string, allDay = false) {
  await ready(page);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const editor = page.getByRole("dialog");
  await editor.getByLabel("Title", { exact: true }).fill(title);
  if (allDay) await editor.getByLabel("All day", { exact: true }).check();
  else {
    await editor.getByLabel("Start", { exact: true }).fill("2026-09-07T09:00");
    await editor.getByLabel("End", { exact: true }).fill("2026-09-07T10:00");
  }
  await editor.getByRole("button", { name: "Save", exact: true }).click();
  await expect(editor).toHaveCount(0);
}
const grid = (page: Page) =>
  page.getByRole("region", { name: "Daily time grid" });
const plan = (page: Page, title: string) =>
  grid(page)
    .locator(".grid-record")
    .getByRole("button", { name: new RegExp(`${title}.*planned`) });
const allDay = (page: Page, title: string) =>
  page.getByRole("region", { name: "Day activity" }).getByRole("button", {
    name: `${title}, all day, 2026-09-07`,
    exact: true,
  });

test("selected plans duplicate immediately at their copied dates and times", async ({
  page,
}, testInfo) => {
  await start(page);
  await create(page, "Duplicate me");
  const original = (await blocks(page))[0]!;
  for (const view of ["day", "week", "month"]) {
    // Phone Month uses counts instead of individual plan previews.
    if (view === "month" && testInfo.project.name === "phone") continue;
    await page.goto(`/?date=2026-09-07&view=${view}`);
    const source = page
      .locator(`[data-calendar-record="${original.id}"]`)
      .first();
    await source.click();
    await expect(source).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Meta+c");
    await expect(page.locator("[data-calendar-clipboard-status]")).toHaveText(
      "Plan copied.",
    );
    await page.keyboard.press("Meta+v");
    await expect.poll(async () => (await blocks(page)).length).toBe(2);
    const duplicate = (await blocks(page)).find(
      (block) => block.id !== original.id,
    )!;
    expect(duplicate).toMatchObject({
      title: original.title,
      startsAt: original.startsAt,
      endsAt: original.endsAt,
    });
    await expect(page.locator(".app-toast")).toContainText("Plans pasted");
    await step(page, "Meta+z");
    await expect.poll(async () => (await blocks(page)).length).toBe(1);
    await step(page, "Meta+Shift+z");
    await expect
      .poll(async () => (await blocks(page)).map((block) => block.id).sort())
      .toEqual([original.id, duplicate.id].sort());
    await step(page, "Meta+z");
    await expect.poll(async () => (await blocks(page)).length).toBe(1);
  }

  await page.goto("/?date=2026-09-07&view=day");
  await create(page, "All-day duplicate", true);
  await allDay(page, "All-day duplicate").click();
  await page.keyboard.press("Meta+c");
  await expect(page.locator("[data-calendar-clipboard-status]")).toHaveText(
    "Plan copied.",
  );
  await page.keyboard.press("Meta+v");
  await expect.poll(async () => (await items(page)).length).toBe(2);
  await step(page, "Meta+z");
  await expect.poll(async () => (await items(page)).length).toBe(1);

  await plan(page, "Duplicate me").click();
  await allDay(page, "All-day duplicate").click({ modifiers: ["Meta"] });
  await page.keyboard.press("Meta+c");
  await expect(page.locator("[data-calendar-clipboard-status]")).toHaveText(
    "2 plans copied.",
  );
  await page.keyboard.press("Meta+v");
  await expect.poll(async () => (await items(page)).length).toBe(2);
  await expect.poll(async () => (await blocks(page)).length).toBe(2);
  await step(page, "Meta+z");
  await expect.poll(async () => (await items(page)).length).toBe(1);
  await expect.poll(async () => (await blocks(page)).length).toBe(1);
});

test("plan undo and redo survive navigation and refresh, preserve identity, branch and clear on sign-out", async ({
  page,
}) => {
  await start(page);
  await create(page, "Original");
  const original = (await blocks(page))[0]!;
  await plan(page, "Original").dblclick();
  const editor = page.getByRole("dialog");
  await editor.getByLabel("Title", { exact: true }).fill("Edited");
  await editor.getByLabel("Start", { exact: true }).fill("2026-09-07T11:05");
  await editor.getByLabel("End", { exact: true }).fill("2026-09-07T12:10");
  await editor.getByRole("button", { name: "Save", exact: true }).click();
  await expect(editor).toHaveCount(0);
  const edited = (await blocks(page))[0]!;
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page).toHaveURL(/\/settings/);
  await page.goBack();
  await expect(grid(page)).toBeVisible();
  await page.reload();
  await step(page, "Meta+z");
  await expect(plan(page, "Original")).toBeVisible();
  await ready(page);
  await plan(page, "Original").dblclick();
  await editor.getByLabel("Title", { exact: true }).fill("Unsaved draft");
  await page.keyboard.press("Control+y");
  expect((await blocks(page))[0]!.title).toBe("Original");
  await page.keyboard.press("Escape");
  await expect(editor).toHaveCount(0);
  await page.reload();
  await step(page, "Control+Shift+z");
  await expect(plan(page, "Edited")).toBeVisible();
  expect((await blocks(page))[0]).toMatchObject({
    id: original.id,
    startsAt: edited.startsAt,
    endsAt: edited.endsAt,
  });
  await ready(page);
  await plan(page, "Edited").click();
  await page.keyboard.press("Delete");
  await expect(plan(page, "Edited")).toHaveCount(0);
  await step(page, "Control+z");
  await expect(plan(page, "Edited")).toBeVisible();
  await step(page, "Control+y");
  await expect(plan(page, "Edited")).toHaveCount(0);
  await step(page, "Meta+z");
  await expect(plan(page, "Edited")).toBeVisible();
  await step(page, "Meta+z");
  await expect(plan(page, "Original")).toBeVisible();
  await step(page, "Meta+z");
  await expect.poll(() => blocks(page)).toHaveLength(0);
  await step(page, "Meta+Shift+z");
  await expect(plan(page, "Original")).toBeVisible();
  await step(page, "Meta+Shift+z");
  await expect(plan(page, "Edited")).toBeVisible();
  await step(page, "Meta+Shift+z");
  await expect.poll(() => blocks(page)).toHaveLength(0);
  await step(page, "Meta+z");
  await expect(plan(page, "Edited")).toBeVisible();
  await create(page, "New branch");
  await step(page, "Meta+Shift+z");
  expect(await blocks(page)).toHaveLength(2);
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  expect(
    await page.evaluate(() =>
      Object.keys(sessionStorage).filter((key) =>
        key.startsWith("168hours:calendar-history:"),
      ),
    ),
  ).toEqual([]);
});

test("all-day edits, group paste and group deletion redo exact saved plans despite a changed clipboard", async ({
  page,
}) => {
  await start(page);
  await create(page, "One", true);
  await create(page, "Two", true);
  await allDay(page, "One").dblclick();
  const editor = page.getByRole("dialog");
  await editor.getByLabel("Title", { exact: true }).fill("One edited");
  await editor.getByLabel("Spans multiple days").check();
  await editor.getByLabel("Last day", { exact: true }).fill("2026-09-09");
  await editor.getByRole("button", { name: "Save", exact: true }).click();
  await expect(editor).toHaveCount(0);
  await step(page, "Control+z");
  await expect(allDay(page, "One")).toBeVisible();
  await step(page, "Control+Shift+z");
  await expect(allDay(page, "One edited")).toBeVisible();
  await ready(page);
  const originalIds = new Set((await items(page)).map((item) => item.id));
  await allDay(page, "One edited").click();
  await allDay(page, "Two").click({ modifiers: ["Meta"] });
  await expect(allDay(page, "One edited")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(allDay(page, "Two")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Control+c");
  await expect(page.locator(".app-toast")).toContainText("copied");
  await grid(page)
    .getByRole("button", { name: "Select 2026-09-07", exact: true })
    .click();
  await page.keyboard.press("Control+v");
  await expect.poll(() => items(page)).toHaveLength(4);
  const pasted = await items(page);
  await step(page, "Control+z");
  await expect.poll(() => items(page)).toHaveLength(2);
  await ready(page);
  await allDay(page, "Two").click();
  await page.keyboard.press("Control+c");
  await page.reload();
  await step(page, "Control+y");
  await expect.poll(() => items(page)).toHaveLength(4);
  expect((await items(page)).map((item) => item.id).sort()).toEqual(
    pasted.map((item) => item.id).sort(),
  );
  const copies = (await items(page)).filter(
    (item) => !originalIds.has(item.id),
  );
  // Select by identity so identical original and pasted titles remain unambiguous.
  await ready(page);
  await page
    .getByRole("region", { name: "Day activity" })
    .locator(`button[data-calendar-record="${copies[0]!.id}"]`)
    .click();
  await page
    .getByRole("region", { name: "Day activity" })
    .locator(`button[data-calendar-record="${copies[1]!.id}"]`)
    .click({ modifiers: ["Meta"] });
  await page.keyboard.press("Backspace");
  await expect.poll(() => items(page)).toHaveLength(2);
  await step(page, "Control+z");
  await expect.poll(() => items(page)).toHaveLength(4);
  await step(page, "Control+y");
  await expect.poll(() => items(page)).toHaveLength(2);
});

test("an uncertain undo survives refresh with the same retry key and redo refuses newer changes", async ({
  page,
}) => {
  await start(page);
  await create(page, "Before");
  await plan(page, "Before").dblclick();
  const editor = page.getByRole("dialog");
  await editor.getByLabel("Title", { exact: true }).fill("After");
  await editor.getByRole("button", { name: "Save", exact: true }).click();
  await expect(editor).toHaveCount(0);
  const keys: string[] = [];
  await page.route("**/api/v1/time-block-edits/*/undo", async (route) => {
    keys.push(route.request().headers()["idempotency-key"]!);
    if (keys.length === 1) {
      expect((await route.fetch()).status()).toBe(200);
      await route.abort("failed");
    } else await route.continue();
  });
  await step(page, "Control+z");
  await expect(
    page.getByRole("button", { name: "Retry same change" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Retry same change" }).click();
  await expect(plan(page, "Before")).toBeVisible();
  await ready(page);
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  await page.unroute("**/api/v1/time-block-edits/*/undo");
  const current = (await blocks(page))[0]!;
  expect(
    (
      await page.request.put(`/api/v1/time-blocks/${current.id}`, {
        headers: headers(current.version),
        data: {
          title: "Other tab",
          startsAt: current.startsAt,
          endsAt: current.endsAt,
        },
      })
    ).status(),
  ).toBe(200);
  await step(page, "Control+y");
  await expect(
    page.getByRole("button", { name: "Reload latest" }),
  ).toBeVisible();
  expect((await blocks(page))[0]!.title).toBe("Other tab");
});

test("repeating plans redo creation, occurrence edits, series edits and whole-series deletion", async ({
  page,
}) => {
  await start(page);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const editor = page.getByRole("dialog");
  await editor.getByLabel("Title", { exact: true }).fill("Series original");
  await editor.getByLabel("Start", { exact: true }).fill("2026-09-07T09:00");
  await editor.getByLabel("End", { exact: true }).fill("2026-09-07T10:00");
  await editor.getByLabel("Repeat", { exact: true }).selectOption("daily");
  await editor.getByLabel("Repeat through", { exact: true }).fill("2026-09-09");
  await editor
    .getByRole("button", { name: "Create repeating plan", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  const ids = (await blocks(page)).map((block) => block.id).sort();
  await plan(page, "Series original").dblclick();
  await editor
    .getByLabel("Title", { exact: true })
    .fill("Individual exception");
  await editor.getByRole("button", { name: "Save", exact: true }).click();
  await expect(editor).toHaveCount(0);
  await plan(page, "Individual exception").dblclick();
  await editor
    .getByRole("button", { name: "Edit repeating rule", exact: true })
    .click();
  await editor.getByLabel("Replace individual edits", { exact: true }).check();
  await editor.getByLabel("Title", { exact: true }).fill("Series revised");
  await editor.getByLabel("Repeat through", { exact: true }).fill("2026-09-08");
  await editor
    .getByRole("button", { name: "Save entire series", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  await step(page, "Control+z");
  await expect(plan(page, "Individual exception")).toBeVisible();
  await step(page, "Control+y");
  await expect(plan(page, "Series revised")).toBeVisible();
  await step(page, "Control+z");
  await expect(plan(page, "Individual exception")).toBeVisible();
  await step(page, "Control+z");
  await expect(plan(page, "Series original")).toBeVisible();
  await step(page, "Control+z");
  await expect.poll(() => blocks(page)).toHaveLength(0);
  await page.reload();
  await step(page, "Control+y");
  await expect.poll(() => blocks(page)).toHaveLength(3);
  expect((await blocks(page)).map((block) => block.id).sort()).toEqual(ids);
  await step(page, "Control+y");
  await expect(plan(page, "Individual exception")).toBeVisible();
  await step(page, "Control+y");
  await expect(plan(page, "Series revised")).toBeVisible();
  await ready(page);
  await plan(page, "Series revised").dblclick();
  await editor
    .getByRole("button", { name: "Edit repeating rule", exact: true })
    .click();
  await editor
    .getByRole("button", { name: "Delete entire series", exact: true })
    .click();
  await expect.poll(() => blocks(page)).toHaveLength(0);
  await step(page, "Control+z");
  await expect.poll(() => blocks(page)).toHaveLength(2);
  await step(page, "Control+y");
  await expect.poll(() => blocks(page)).toHaveLength(0);
});
