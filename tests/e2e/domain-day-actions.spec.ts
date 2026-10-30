import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.use({ actionTimeout: 10000 });

async function fixture(page: Page, extra = false) {
  const headers = (version?: number) => ({
    Origin: "http://localhost:3100",
    "Idempotency-Key": randomUUID(),
    ...(version ? { "If-Match": `"${version}"` } : {}),
  });
  const post = async (path: string, data: object, version?: number) => {
    const response = await page.request.post(path, {
      headers: headers(version),
      data,
    });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  };
  await post("/api/auth/sign-up/email", {
    name: "Day actions",
    email: `day-actions-${randomUUID()}@example.com`,
    password: "Synthetic-day-actions-123",
  });
  const me = await (await page.request.get("/api/v1/me")).json();
  expect(
    (
      await page.request.put("/api/v1/preferences", {
        headers: headers(me.preferences.version),
        data: {
          timezone: "UTC",
          weekStartsOn: 1,
          weightUnit: "kg",
          distanceUnit: "km",
        },
      })
    ).ok(),
  ).toBe(true);
  const exercise = await post("/api/v1/exercises", {
    name: "Squat",
    loggingType: "reps_load",
  });
  const plan = await post("/api/v1/strength-plans", {
    title: "Leg day",
    exercises: [{ exerciseId: exercise.id, sets: [{ targetReps: 10 }] }],
  });
  const scheduled = await post(
    `/api/v1/strength-plans/${plan.id}/schedule`,
    { startsAt: "2026-10-24T17:00:00Z", endsAt: "2026-10-24T18:00:00Z" },
    plan.version,
  );
  const session = await post(
    `/api/v1/strength-plans/${scheduled.id}/begin`,
    {
      startedAt: "2026-10-24T08:00:00Z",
    },
    scheduled.version,
  );
  const saved = await page.request.put(
    `/api/v1/strength-workouts/${session.id}`,
    {
      headers: headers(session.version),
      data: {
        title: "Recorded mobility",
        startedAt: session.startedAt,
        linkedTimeBlockId: session.linkedTimeBlockId,
        endedAt: "2026-10-24T08:30:00Z",
        exercises: [
          { exerciseId: exercise.id, sets: [{ completed: true, reps: 8 }] },
        ],
      },
    },
  );
  expect(saved.ok(), await saved.text()).toBe(true);
  const allDay = extra
    ? await post("/api/v1/calendar/items", {
        title: "Rest reminder",
        kind: "all_day",
        date: "2026-10-24",
        endDate: "2026-10-24",
      })
    : null;
  if (extra)
    await post("/api/v1/calendar/series", {
      title: "Repeating reminder",
      timezone: "UTC",
      startDate: "2026-10-24",
      untilDate: "2026-10-26",
      startMinute: 540,
      durationMinutes: 30,
      frequency: "daily",
      interval: 1,
      weekdays: [6],
    });
  await page.goto("/fitness?date=2026-10-24");
  await page
    .locator(".domain-day-panel .calendar-day-feed")
    .first()
    .waitFor({ state: "attached" });
  await page.clock.install({ time: new Date("2026-10-24T10:00:00Z") });
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  return { plan, scheduled, session, post, allDay };
}
const actionsMenu = (page: Page) =>
  page.getByRole("menu", { name: "Day plan actions", exact: true });
const editor = (page: Page) =>
  page.getByRole("dialog", { name: "Edit plan", exact: true });
async function panel(page: Page, mobile: boolean, domain = "Fitness") {
  if (mobile)
    await page.getByRole("button", { name: "Day", exact: true }).click();
  return mobile
    ? page
        .getByRole("dialog", { name: "Your day", exact: true })
        .locator(".domain-day-panel")
    : page
        .getByRole("complementary", { name: `${domain} day panel` })
        .locator(".domain-day-panel");
}

test("Day plans share Calendar selection, inline editing, delete/Undo and source actions", async ({
  page,
}, info) => {
  const { plan, scheduled, session } = await fixture(page);
  const mobile = info.project.name === "phone";
  if (mobile) await page.setViewportSize({ width: 320, height: 844 });
  const day = await panel(page, mobile);
  const planned = day
    .locator(`[data-calendar-record="${scheduled.timeBlockId}"]`)
    .first();
  await expect(day.locator(".day-at-a-glance-next")).toBeVisible();
  await expect(
    day
      .getByRole("heading", { name: "Coming up", exact: true })
      .locator("..")
      .locator(`[data-calendar-record="${scheduled.timeBlockId}"]`),
  ).toBeVisible();
  await planned.click();
  await expect(planned).toHaveAttribute("aria-pressed", "true");
  await day
    .getByRole("button", { name: "Day plan actions", exact: true })
    .click();
  await actionsMenu(page)
    .getByRole("menuitem", { name: "Edit plan", exact: true })
    .click();
  await expect(editor(page)).toBeVisible();
  await expect(page).toHaveURL(/fitness\?date=2026-10-24/);
  await editor(page)
    .getByLabel("Start", { exact: true })
    .fill("2026-10-24T18:00");
  await editor(page)
    .getByLabel("End", { exact: true })
    .fill("2026-10-24T19:00");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: info.outputPath("inline-plan-editor.png") });
  await editor(page).getByRole("button", { name: "Save", exact: true }).click();
  await expect(editor(page)).toHaveCount(0);
  await expect
    .poll(async () =>
      Date.parse(
        (
          await (
            await page.request.get(
              `/api/v1/time-blocks/${scheduled.timeBlockId}`,
            )
          ).json()
        ).startsAt,
      ),
    )
    .toBe(Date.parse("2026-10-24T18:00:00Z"));
  await day
    .getByRole("button", { name: "Day plan actions", exact: true })
    .click();
  await actionsMenu(page)
    .getByRole("menuitem", { name: "Delete plan", exact: true })
    .click();
  await expect(planned).toHaveCount(0);
  const detached = await (
    await page.request.get(`/api/v1/strength-plans/${scheduled.id}`)
  ).json();
  expect(detached.timeBlockId).toBeNull();
  const recorded = await (
    await page.request.get(`/api/v1/strength-workouts/${session.id}`)
  ).json();
  expect(recorded.linkedTimeBlockId).toBeNull();
  expect(recorded.exercises[0].sets[0].reps).toBe(8);
  await expect(day.getByText("Calendar actions", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    day.getByRole("button", { name: "Day plan actions", exact: true }),
  ).toHaveCount(0);
  await day
    .getByRole("button", { name: "Undo Calendar change", exact: true })
    .click();
  await expect(planned).toBeVisible();
  await expect(planned).toBeFocused();
  await expect
    .poll(
      async () =>
        (
          await (
            await page.request.get(`/api/v1/strength-plans/${scheduled.id}`)
          ).json()
        ).timeBlockId,
    )
    .toBe(scheduled.timeBlockId);
  await expect
    .poll(
      async () =>
        (
          await (
            await page.request.get(`/api/v1/strength-workouts/${session.id}`)
          ).json()
        ).linkedTimeBlockId,
    )
    .toBe(scheduled.timeBlockId);
  expect(
    (await (await page.request.get(`/api/v1/strength-plans/${plan.id}`)).json())
      .version,
  ).toBe(plan.version);
  expect(
    (await page.request.get(`/api/v1/strength-workouts/${session.id}`)).ok(),
  ).toBe(true);
  const headingStyle = await day
    .getByRole("heading", { name: "Earlier", exact: true })
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return [style.fontSize, style.fontWeight, style.color, style.marginTop];
    });
  await planned.click();
  await expect(planned).toHaveAttribute("aria-pressed", "true");
  const recordStyle = await planned.evaluate((element) => {
    const style = getComputedStyle(element);
    return [style.fontSize, style.backgroundColor];
  });
  await page.screenshot({ path: info.outputPath("day-plan-selection.png") });
  if (mobile)
    await page
      .getByRole("dialog", { name: "Your day", exact: true })
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
  await page.goto("/?date=2026-10-24&view=day");
  const feed = page.locator(".calendar-day-layout > .calendar-day-feed");
  if (!mobile) {
    await expect(
      feed.getByRole("heading", { name: "Earlier", exact: true }),
    ).toBeVisible();
    expect(
      await feed
        .getByRole("heading", { name: "Earlier", exact: true })
        .evaluate((element) => {
          const style = getComputedStyle(element);
          return [
            style.fontSize,
            style.fontWeight,
            style.color,
            style.marginTop,
          ];
        }),
    ).toEqual(headingStyle);
    await feed
      .locator(`[data-calendar-record="${scheduled.timeBlockId}"]`)
      .first()
      .click();
    expect(
      await feed
        .locator(`[data-calendar-record="${scheduled.timeBlockId}"]`)
        .first()
        .evaluate((element) => {
          const style = getComputedStyle(element);
          return [style.fontSize, style.backgroundColor];
        }),
    ).toEqual(recordStyle);
  }
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Tasks", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Tasks", exact: true }),
  ).toBeAttached();
  const tasks = await panel(page, mobile, "Tasks");
  await tasks
    .getByRole("button", { name: "All activities", exact: true })
    .click();
  await tasks
    .locator(`[data-calendar-record="${scheduled.timeBlockId}"]`)
    .first()
    .dblclick();
  await expect(editor(page)).toBeVisible();
  await editor(page)
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await tasks.getByRole("button", { name: /Recorded mobility/ }).click();
  await expect(page).toHaveURL(new RegExp(`/fitness/session/${session.id}`));
});

test("uncertain Day deletions keep the drawer open and retry the same receipt before Undo", async ({
  page,
}, info) => {
  const { scheduled } = await fixture(page);
  const mobile = info.project.name === "phone";
  const day = await panel(page, mobile);
  const planned = day
    .locator(`[data-calendar-record="${scheduled.timeBlockId}"]`)
    .first();
  await planned.click();
  const keys: string[] = [];
  await page.route(
    `**/api/v1/time-blocks/${scheduled.timeBlockId}`,
    async (route) => {
      if (route.request().method() !== "DELETE") return route.continue();
      keys.push(route.request().headers()["idempotency-key"]!);
      if (keys.length === 1) {
        await route.fetch();
        return route.abort("failed");
      }
      return route.continue();
    },
  );
  await day
    .getByRole("button", { name: "Day plan actions", exact: true })
    .click();
  await actionsMenu(page)
    .getByRole("menuitem", { name: "Delete plan", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Retry same change", exact: true }),
  ).toBeVisible();
  await expect(
    day.getByRole("button", { name: "Next day", exact: true }),
  ).toBeDisabled();
  if (mobile) {
    const drawer = page.getByRole("dialog", { name: "Your day", exact: true });
    await expect(
      drawer.getByRole("button", { name: "Close dialog", exact: true }),
    ).toBeDisabled();
    await drawer.press("Escape");
    await expect(drawer).toBeVisible();
  }
  await page
    .getByRole("button", { name: "Retry same change", exact: true })
    .click();
  await expect(planned).toHaveCount(0);
  expect(keys).toHaveLength(2);
  expect(keys[1]).toBe(keys[0]);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(planned).toBeVisible();
  await expect(
    day.getByRole("button", { name: "Next day", exact: true }),
  ).toBeEnabled();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("Day all-day and repeating plans use the shared deletion scope and Undo", async ({
  page,
}, info) => {
  const { allDay } = await fixture(page, true);
  const day = await panel(page, info.project.name === "phone");
  await day
    .getByRole("button", { name: "All activities", exact: true })
    .click();
  const dated = day.locator(`[data-calendar-record="${allDay!.id}"]`);
  await dated.click();
  await day
    .getByRole("button", { name: "Day plan actions", exact: true })
    .click();
  await actionsMenu(page)
    .getByRole("menuitem", { name: "Delete plan", exact: true })
    .click();
  await expect(dated).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(dated).toBeVisible();
  const recurring = day
    .getByRole("button", {
      name: /Repeating reminder.*planned/,
    })
    .first();
  await recurring.click();
  await day
    .getByRole("button", { name: "Day plan actions", exact: true })
    .click();
  await actionsMenu(page)
    .getByRole("menuitem", { name: "Delete plan", exact: true })
    .click();
  const scope = page.getByRole("dialog", {
    name: "Delete repeating plan",
    exact: true,
  });
  await expect(scope).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await scope
    .getByRole("button", { name: "This occurrence", exact: true })
    .click();
  await expect(recurring).toHaveCount(0);
  const count = async () =>
    (
      await (await page.request.get("/api/v1/weeks/2026-10-19")).json()
    ).blocks.filter(
      (block: { title: string }) => block.title === "Repeating reminder",
    ).length;
  await expect.poll(count).toBe(1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(recurring).toBeVisible();
  await expect.poll(count).toBe(2);
});
