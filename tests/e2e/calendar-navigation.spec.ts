import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.use({ actionTimeout: 10000 });
async function setup(page: Page) {
  const write = async (path: string, data: object, version?: number) => {
    const response = await page.request[version ? "put" : "post"](path, {
      headers: {
        Origin: "http://localhost:3100",
        "Idempotency-Key": randomUUID(),
        ...(version ? { "If-Match": `"${version}"` } : {}),
      },
      data,
    });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  };
  await write("/api/__test/register", {
    name: "Calendar navigation",
    email: `calendar-navigation-${randomUUID()}@example.com`,
    password: "Synthetic-navigation-password-123",
  });
  const me = await (await page.request.get("/api/v1/me")).json();
  await write(
    "/api/v1/preferences",
    { timezone: "UTC", weekStartsOn: 1, weightUnit: "kg", distanceUnit: "km" },
    me.preferences.version,
  );
  return { write, me };
}
const navigation = (page: Page) =>
  page.getByRole("navigation", { name: "Main navigation", exact: true });
const views = (page: Page) =>
  page.getByRole("navigation", { name: "Calendar view", exact: true });
async function ready(page: Page) {
  await expect(page.locator(".calendar-interactions")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.locator(".calendar-scroll")).toBeVisible();
}

test("Calendar remembers in-app date, view and scaled scroll, while a fresh visit opens this week", async ({
  page,
}) => {
  const { me, write } = await setup(page);
  await Promise.all(
    Array.from({ length: 12 }, (_, index) =>
      write("/api/v1/time-blocks", {
        title: `Day scroll plan ${index + 1}`,
        startsAt: `2026-10-28T${String(index + 8).padStart(2, "0")}:00:00Z`,
        endsAt: `2026-10-28T${String(index + 8).padStart(2, "0")}:30:00Z`,
      }),
    ),
  );
  await page.goto("/");
  await ready(page);
  await expect(
    views(page).getByRole("link", { name: "Week", exact: true }),
  ).toHaveAttribute("aria-current", "true");
  const today = new Date().toISOString().slice(0, 10);
  await expect(
    navigation(page).getByRole("link", { name: "Calendar", exact: true }),
  ).toHaveAttribute("href", `/?date=${today}&view=week`);
  await page.evaluate(
    (id) => localStorage.setItem(`calendar-hour-height:${id}`, "120"),
    me.user.id,
  );
  await page.goto("/?date=2026-10-28&view=week");
  await ready(page);
  const scroller = page.locator(".calendar-scroll");
  await scroller.evaluate(async (element) => {
    element.scrollTo({
      top: 720,
      left: (element.scrollWidth - element.clientWidth) / 2,
    });
    await new Promise(requestAnimationFrame);
  });
  const position = await scroller.evaluate((e) => ({
    top: e.scrollTop,
    left: e.scrollLeft,
  }));
  await navigation(page)
    .getByRole("link", { name: "Fitness", exact: true })
    .click();
  await expect(page).toHaveURL(/\/fitness$/);
  await page.goBack();
  await ready(page);
  await expect
    .poll(() => scroller.evaluate((e) => e.scrollTop))
    .toBeCloseTo(position.top, 0);
  await expect
    .poll(() => scroller.evaluate((e) => e.scrollLeft))
    .toBeCloseTo(position.left, 0);
  for (const view of ["Week", "Day", "Month"]) {
    await views(page).getByRole("link", { name: view, exact: true }).click();
    await expect(
      views(page).getByRole("link", { name: view, exact: true }),
    ).toHaveAttribute("aria-current", "true");
    let dayScroll: { day: number; feed: number } | undefined;
    if (view === "Day") {
      await ready(page);
      dayScroll = await page
        .locator(".calendar-day-layout")
        .evaluate(async (element) => {
          const feed = element.querySelector(".calendar-day-feed")!;
          element.scrollTop = (element.scrollHeight - element.clientHeight) / 2;
          feed.scrollTop = (feed.scrollHeight - feed.clientHeight) / 2;
          await new Promise(requestAnimationFrame);
          return { day: element.scrollTop, feed: feed.scrollTop };
        });
    }
    await navigation(page)
      .getByRole("link", { name: "Fitness", exact: true })
      .click();
    await expect(page).toHaveURL(/\/fitness$/);
    await navigation(page)
      .getByRole("link", { name: "Calendar", exact: true })
      .click();
    await expect(page).toHaveURL(
      `/?date=2026-10-28&view=${view.toLowerCase()}`,
    );
    await expect(
      views(page).getByRole("link", { name: view, exact: true }),
    ).toHaveAttribute("aria-current", "true");
    if (dayScroll) {
      await expect
        .poll(() =>
          page.locator(".calendar-day-layout").evaluate((e) => e.scrollTop),
        )
        .toBeCloseTo(dayScroll.day, 0);
      await expect
        .poll(() =>
          page.locator(".calendar-day-feed").evaluate((e) => e.scrollTop),
        )
        .toBeCloseTo(dayScroll.feed, 0);
    }
  }
  await page.getByRole("link", { name: "Today", exact: true }).click();
  await expect(page).toHaveURL(`/?date=${today}&view=month`);
  await page.goto("/");
  await ready(page);
  await expect(
    views(page).getByRole("link", { name: "Week", exact: true }),
  ).toHaveAttribute("aria-current", "true");
  await expect(
    navigation(page).getByRole("link", { name: "Calendar", exact: true }),
  ).toHaveAttribute("href", `/?date=${today}&view=week`);
  await page.goto("/?date=2026-08-15&view=month");
  await expect(
    views(page).getByRole("link", { name: "Month", exact: true }),
  ).toHaveAttribute("aria-current", "true");
  await expect(page.locator(".calendar-date-title")).toContainText("August");
});

for (const fallback of [false, true])
  test(`Calendar workout returns to its view and scroll (${fallback ? "fallback" : "Navigation API"})`, async ({
    page,
  }) => {
    if (fallback)
      await page.addInitScript(() =>
        Object.defineProperty(window, "navigation", {
          value: undefined,
          configurable: true,
        }),
      );
    const { write } = await setup(page);
    const exercise = await write("/api/v1/exercises", {
      name: "Navigation press",
    });
    const draft = await write("/api/v1/strength-workouts", {
      title: "Calendar return workout",
      startedAt: "2026-10-28T12:00:00Z",
    });
    const workout = await write(
      `/api/v1/strength-workouts/${draft.id}`,
      {
        title: draft.title,
        startedAt: draft.startedAt,
        endedAt: "2026-10-28T13:00:00Z",
        exercises: [
          {
            exerciseId: exercise.id,
            sets: [{ reps: 12, weightKg: 50, completed: true }],
          },
        ],
      },
      draft.version,
    );
    await page.goto("/?date=2026-10-28&view=week");
    await ready(page);
    const record = page
      .getByRole("region", { name: "Weekly time grid" })
      .getByRole("button", { name: /Calendar return workout.*recorded/ });
    await record.scrollIntoViewIfNeeded();
    await record.click();
    const popup = page.getByRole("dialog", {
      name: "Recorded workout",
      exact: true,
    });
    const position = await page
      .locator(".calendar-scroll")
      .evaluate((e) => ({ top: e.scrollTop, left: e.scrollLeft }));
    const length = await page.evaluate(() => history.length);
    await popup
      .getByRole("link", { name: "View workout", exact: true })
      .click();
    await expect(page).toHaveURL(/returnCalendar=/);
    const back = page.getByRole("link", {
      name: "Back to Calendar",
      exact: true,
    });
    await expect(back).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await back.click();
    await expect(page).toHaveURL("/?date=2026-10-28&view=week");
    await ready(page);
    await expect
      .poll(() => page.locator(".calendar-scroll").evaluate((e) => e.scrollTop))
      .toBeCloseTo(position.top, 0);
    await expect
      .poll(() =>
        page.locator(".calendar-scroll").evaluate((e) => e.scrollLeft),
      )
      .toBeCloseTo(position.left, 0);
    expect(await page.evaluate(() => history.length)).toBe(length + 1);
    // Day-feed links share the same return context; direct links keep History.
    await views(page).getByRole("link", { name: "Day", exact: true }).click();
    await page
      .getByRole("region", { name: "Day activity", exact: true })
      .getByRole("link", { name: /Calendar return workout/ })
      .click();
    await expect(back).toBeVisible();
    await page.reload();
    await expect(back).toBeVisible();
    await back.click();
    await expect(page).toHaveURL("/?date=2026-10-28&view=day");
    await page.goto(`/fitness/session/${workout.id}`);
    await expect(
      page.getByRole("link", { name: "Back to History", exact: true }),
    ).toBeVisible();
    await page.goto(
      `/fitness/session/${workout.id}?${new URLSearchParams({ returnCalendar: "https://evil.invalid" })}`,
    );
    await expect(
      page.getByRole("link", { name: "Back to History", exact: true }),
    ).toBeVisible();
  });
