import { expect, test, type Page, type Locator } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { Week } from "@168hours/contracts";
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
          name: "Motion test",
          email: `motion-${randomUUID()}@example.com`,
          password: "Synthetic-calendar-password-123",
        },
      })
    ).status(),
  ).toBe(200);
}
async function ready(page: Page) {
  await expect(page.locator(".calendar-interactions")).toHaveAttribute(
    "aria-busy",
    "false",
  );
}
async function drag(
  page: Page,
  element: Locator,
  to: { x: number; y: number },
  touch: boolean,
  during?: () => Promise<void>,
) {
  const box = (await element.boundingBox())!;
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2;
  if (touch) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [to],
    });
    if (during) await during();
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await cdp.detach();
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 4 });
    if (during) await during();
    await page.mouse.up();
  }
}
async function blocks(page: Page) {
  return (
    (await (await page.request.get("/api/v1/weeks/2026-09-07")).json()) as Week
  ).blocks;
}

test("all-day plans drag by dates, resize live, cancel, and undo on Week and Month", async ({
  page,
}, testInfo) => {
  await start(page);
  const created = await page.request.post("/api/v1/calendar/items", {
    headers: headers(),
    data: {
      title: "Trip",
      kind: "all_day",
      date: "2026-09-07",
      endDate: "2026-09-07",
    },
  });
  expect(created.status()).toBe(201);
  const item = await created.json();
  const read = async () =>
    (await page.request.get("/api/v1/calendar/items/" + item.id)).json();
  await page.goto("/?date=2026-09-07&view=week");
  await ready(page);
  const row = page.locator(".calendar-all-day-row");
  const plan = () =>
    row
      .locator('[data-context-all-day="2026-09-07"]')
      .getByRole("button", { name: /Trip, all day/ });
  await plan().click();
  const dest = (await row
    .locator('[data-context-all-day="2026-09-08"]')
    .boundingBox())!;
  await drag(
    page,
    plan(),
    { x: dest.x + dest.width / 2, y: dest.y + dest.height / 2 },
    testInfo.project.name === "phone",
    async () => {
      await expect(page.locator(".calendar-moving-block")).toContainText(
        "Trip",
      );
      expect((await read()).date).toBe("2026-09-07");
    },
  );
  await expect.poll(async () => (await read()).date).toBe("2026-09-08");
  await ready(page);
  await page.keyboard.press("Meta+z");
  await expect.poll(async () => (await read()).date).toBe("2026-09-07");
  await ready(page);
  await plan().click();
  const endHandle = row.locator(
    '[data-context-all-day="2026-09-07"] .date-resize-end',
  );
  const end = (await row
    .locator('[data-context-all-day="2026-09-09"]')
    .boundingBox())!;
  await drag(
    page,
    endHandle,
    {
      x: Math.min(page.viewportSize()!.width - 45, end.x + end.width / 2),
      y: end.y + end.height / 2,
    },
    testInfo.project.name === "phone",
    async () => {
      await expect(
        row.locator('[data-context-all-day="2026-09-09"]'),
      ).toContainText("Trip");
      expect((await read()).endDate).toBe("2026-09-07");
    },
  );
  await expect.poll(async () => (await read()).endDate).toBe("2026-09-09");
  await ready(page);
  await page.keyboard.press("Meta+z");
  await expect.poll(async () => (await read()).endDate).toBe("2026-09-07");
  if (testInfo.project.name === "desktop") {
    await page.goto("/?date=2026-09-07&view=month");
    await ready(page);
    const source = page
      .locator('.month-day[data-date="2026-09-07"]')
      .getByRole("button", { name: /Trip, all day/ });
    await expect(source).toBeVisible();
    const cell = (await page
      .locator('.month-day[data-date="2026-09-08"]')
      .boundingBox())!;
    await drag(
      page,
      source,
      { x: cell.x + cell.width / 2, y: cell.y + 45 },
      false,
      async () => {
        await page.keyboard.press("Escape");
      },
    );
    expect((await read()).date).toBe("2026-09-07");
    await drag(
      page,
      source,
      { x: cell.x + cell.width / 2, y: cell.y + 45 },
      false,
    );
    await expect.poll(async () => (await read()).date).toBe("2026-09-08");
    await ready(page);
    await page.keyboard.press("Meta+z");
    await expect.poll(async () => (await read()).date).toBe("2026-09-07");
  }
});

test("mixed selected plans move together, retry once, and keep group undo/redo across refresh", async ({
  page,
}, testInfo) => {
  await start(page);
  for (const [title, hour] of [
    ["First", 9],
    ["Second", 11],
  ] as const) {
    expect(
      (
        await page.request.post("/api/v1/time-blocks", {
          headers: headers(),
          data: {
            title,
            startsAt: `2026-09-07T${String(hour).padStart(2, "0")}:00:00Z`,
            endsAt: `2026-09-07T${String(hour + 1).padStart(2, "0")}:00:00Z`,
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
          title: "Holiday",
          kind: "all_day",
          date: "2026-09-07",
          endDate: "2026-09-07",
        },
      })
    ).status(),
  ).toBe(201);
  await page.goto("/?date=2026-09-07&view=day");
  await ready(page);
  const grid = page.getByRole("region", { name: "Daily time grid" });
  const first = () =>
    grid
      .locator(".grid-record")
      .getByRole("button", { name: /First.*planned/ });
  const second = () =>
    grid
      .locator(".grid-record")
      .getByRole("button", { name: /Second.*planned/ });
  await first().click();
  await second().click({ modifiers: ["Meta"] });
  await grid
    .getByRole("button", { name: /Holiday, all day/ })
    .click({ modifiers: ["Meta"] });
  const original = await blocks(page);
  const keys: string[] = [];
  await page.route("**/api/v1/calendar/selection/move", async (route) => {
    keys.push(route.request().headers()["idempotency-key"]!);
    if (keys.length === 1) {
      expect((await route.fetch()).status()).toBe(200);
      await route.abort("failed");
    } else await route.continue();
  });
  await expect(first()).toHaveAttribute("aria-pressed", "true");
  await expect(second()).toHaveAttribute("aria-pressed", "true");
  await first().evaluate((element) => {
    const scroll = element.closest<HTMLElement>(".calendar-scroll")!;
    scroll.scrollTop +=
      element.getBoundingClientRect().top -
      scroll.getBoundingClientRect().top -
      150;
  });
  const box = (await first().boundingBox())!;
  await drag(
    page,
    first(),
    { x: box.x + box.width / 2, y: box.y + box.height / 2 + 60 },
    testInfo.project.name === "phone",
    async () => {
      await expect(page.locator(".calendar-moving-block")).toHaveCount(3);
      await expect(first()).toHaveClass(/drag-source/);
      await expect(second()).toHaveClass(/drag-source/);
      expect((await blocks(page))[0].version).toBe(original[0].version);
    },
  );
  await page.getByRole("button", { name: "Retry same change" }).click();
  await ready(page);
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  await page.unroute("**/api/v1/calendar/selection/move");
  expect((await blocks(page)).find((b) => b.title === "First")!.startsAt).toBe(
    "2026-09-07T10:00:00.000Z",
  );
  expect((await blocks(page)).find((b) => b.title === "Second")!.startsAt).toBe(
    "2026-09-07T12:00:00.000Z",
  );
  await expect(first()).toHaveAttribute("aria-pressed", "true");
  await expect(second()).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await ready(page);
  await page.keyboard.press("Meta+z");
  await expect
    .poll(
      async () =>
        (await blocks(page)).find((b) => b.title === "First")!.startsAt,
    )
    .toBe("2026-09-07T09:00:00.000Z");
  await ready(page);
  await page.keyboard.press("Meta+Shift+z");
  await expect
    .poll(
      async () =>
        (await blocks(page)).find((b) => b.title === "Second")!.startsAt,
    )
    .toBe("2026-09-07T12:00:00.000Z");
  await ready(page);
  await first().click();
  await second().click({ modifiers: ["Meta"] });
  await first().focus();
  await page.keyboard.press("Shift+F10");
  await page.getByRole("menuitem", { name: "Move…", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Move selected plans" });
  await editor.getByLabel("Destination date").fill("2026-09-08");
  expect(
    (await new AxeBuilder({ page }).include('[role="dialog"]').analyze())
      .violations,
  ).toEqual([]);
  await editor.getByRole("button", { name: "Move plans", exact: true }).click();
  await expect(editor).toHaveCount(0);
  expect(
    (await blocks(page)).every((b) => b.startsAt.includes("2026-09-08")),
  ).toBe(true);
});

test("repeating all-day drags and resizes offer occurrence scopes and retain exact undo", async ({
  page,
}, testInfo) => {
  await start(page);
  const response = await page.request.post("/api/v1/calendar/series", {
    headers: headers(),
    data: {
      title: "Daily plan",
      kind: "all_day",
      timezone: "UTC",
      startDate: "2026-09-07",
      untilDate: "2026-09-09",
      startMinute: 0,
      durationMinutes: 60,
      frequency: "daily",
      interval: 1,
      weekdays: [1],
    },
  });
  expect(response.status()).toBe(201);
  const series = await response.json();
  const read = async () =>
    (
      await page.request.get(
        "/api/v1/calendar/items?from=2026-09-07&to=2026-09-11",
      )
    ).json();
  await page.goto("/?date=2026-09-07&view=week");
  await ready(page);
  const row = page.locator(".calendar-all-day-row");
  const source = () =>
    row
      .locator('[data-context-all-day="2026-09-07"]')
      .getByRole("button", { name: /Daily plan, all day/ });
  const dialog = page.getByRole("dialog");
  await source().click();
  const dest = (await row
    .locator('[data-context-all-day="2026-09-08"]')
    .boundingBox())!;
  await drag(
    page,
    source(),
    { x: dest.x + dest.width / 2, y: dest.y + dest.height / 2 },
    testInfo.project.name === "phone",
  );
  await expect(dialog).toContainText("Apply this adjustment to:");
  await dialog
    .getByRole("button", { name: "This occurrence", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect
    .poll(
      async () =>
        (await read()).find(
          (p: { occurrenceDate: string }) => p.occurrenceDate === "2026-09-07",
        ).date,
    )
    .toBe("2026-09-08");
  const moved = await read();
  expect(
    moved.find(
      (p: { occurrenceDate: string }) => p.occurrenceDate === "2026-09-07",
    ),
  ).toMatchObject({ date: "2026-09-08", isException: true });
  await ready(page);
  await page.keyboard.press("Meta+z");
  await expect
    .poll(
      async () =>
        (await read()).find(
          (p: { occurrenceDate: string }) => p.occurrenceDate === "2026-09-07",
        ).date,
    )
    .toBe("2026-09-07");
  await ready(page);
  await source().click();
  await drag(
    page,
    row.locator('[data-context-all-day="2026-09-07"] .date-resize-end'),
    { x: dest.x + dest.width / 2, y: dest.y + dest.height / 2 },
    testInfo.project.name === "phone",
  );
  await dialog
    .getByRole("button", { name: "Entire series", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(
    (
      await page.request.get("/api/v1/calendar/series/" + series.series.id)
    ).status(),
  ).toBe(200);
  expect(
    (
      await (
        await page.request.get("/api/v1/calendar/series/" + series.series.id)
      ).json()
    ).dateSpan,
  ).toBe(2);
  await ready(page);
  await page.keyboard.press("Meta+z");
  await expect
    .poll(async () =>
      (await read()).every(
        (p: { date: string; endDate: string; isException: boolean }) =>
          p.date === p.endDate && !p.isException,
      ),
    )
    .toBe(true);
});

test("Month moves selected plans across dates while preserving gaps and spans", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop",
    "Compact phone Month uses counts; date dragging is covered in its Week view.",
  );
  await start(page);
  const plans = [];
  for (const [title, date] of [
    ["First", "2026-09-07"],
    ["Second", "2026-09-08"],
  ]) {
    const response = await page.request.post("/api/v1/time-blocks", {
      headers: headers(),
      data: {
        title,
        startsAt: `${date}T09:00:00Z`,
        endsAt: `${date}T10:00:00Z`,
      },
    });
    expect(response.status()).toBe(201);
    plans.push(await response.json());
  }
  await page.goto("/?date=2026-09-07&view=month");
  await ready(page);
  const first = page
    .locator('.month-day[data-date="2026-09-07"]')
    .getByRole("button", { name: /First.*planned/ });
  const second = page
    .locator('.month-day[data-date="2026-09-08"]')
    .getByRole("button", { name: /Second.*planned/ });
  await first.click();
  await second.click({ modifiers: ["Meta"] });
  const dest = (await page
    .locator('.month-day[data-date="2026-09-09"]')
    .boundingBox())!;
  await drag(
    page,
    first,
    { x: dest.x + dest.width / 2, y: dest.y + 45 },
    false,
    async () => {
      await expect(page.locator(".calendar-moving-block")).toHaveCount(2);
    },
  );
  await expect
    .poll(
      async () =>
        (await blocks(page)).find((b) => b.title === "First")!.startsAt,
    )
    .toBe("2026-09-09T09:00:00.000Z");
  expect((await blocks(page)).find((b) => b.title === "Second")!.startsAt).toBe(
    "2026-09-10T09:00:00.000Z",
  );
  await ready(page);
  await page.keyboard.press("Meta+z");
  await expect
    .poll(
      async () =>
        (await blocks(page)).find((b) => b.title === "Second")!.startsAt,
    )
    .toBe("2026-09-08T09:00:00.000Z");
  expect((await blocks(page)).find((b) => b.title === "First")!.id).toBe(
    plans[0].id,
  );
});
