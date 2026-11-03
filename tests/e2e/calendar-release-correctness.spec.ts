// DST fixtures use Denver: Edmonton no longer falls back in tzdb 2026c+.
import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
const headers = () => ({
  Origin: "http://localhost:3100",
  "Idempotency-Key": randomUUID(),
});
async function setup(page: Page, timezone = "UTC", weekStartsOn = 1) {
  expect(
    (
      await page.request.post("/api/__test/register", {
        headers: headers(),
        data: {
          name: "Calendar regression",
          email: `calendar-beta-${randomUUID()}@example.com`,
          password: "Synthetic-calendar-password-123",
        },
      })
    ).ok(),
  ).toBe(true);
  const me = await (await page.request.get("/api/v1/me")).json();
  const { version, ...preferences } = me.preferences;
  expect(
    (
      await page.request.put("/api/v1/preferences", {
        headers: { ...headers(), "If-Match": `"${version}"` },
        data: { ...preferences, timezone, weekStartsOn },
      })
    ).ok(),
  ).toBe(true);
}
async function create(page: Page, startsAt: string, endsAt: string) {
  const r = await page.request.post("/api/v1/time-blocks", {
    headers: headers(),
    data: { title: "Cross boundary", startsAt, endsAt },
  });
  expect(r.status()).toBe(201);
  return r.json();
}
test("recorded workouts show clear overnight dates, active time and a Fitness link", async ({
  page,
}, info) => {
  await setup(page, "America/Denver");
  const write = async (path: string, data: object, version?: number) => {
    const response = await page.request[version ? "put" : "post"](
      `/api/v1/${path}`,
      {
        headers: {
          ...headers(),
          ...(version ? { "If-Match": `"${version}"` } : {}),
        },
        data,
      },
    );
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  };
  const exercise = await write("exercises", { name: "Summary bench" });
  const draft = await write("strength-workouts", {
    title: "Upper Body",
    startedAt: "2026-10-29T04:25:00Z",
  });
  const workout = await write(
    `strength-workouts/${draft.id}`,
    {
      title: draft.title,
      startedAt: draft.startedAt,
      endedAt: "2026-10-29T20:26:00Z",
      pauses: [
        { startsAt: "2026-10-29T05:00:00Z", endsAt: "2026-10-29T06:00:00Z" },
      ],
      exercises: [
        {
          exerciseId: exercise.id,
          loggingType: "reps_load",
          sets: [{ reps: 12, weightKg: 50, completed: true }],
        },
      ],
    },
    draft.version,
  );
  if (info.project.name === "phone")
    await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/?date=2026-10-29&view=day");
  const record = page
    .getByRole("region", { name: "Daily time grid" })
    .getByRole("button", { name: /Upper Body.*recorded/ });
  await record.click();
  const summary = page.getByRole("dialog", {
    name: "Recorded workout",
    exact: true,
  });
  await expect(summary).toBeVisible();
  await expect(
    summary.getByRole("heading", { name: "Upper Body", exact: true }),
  ).toBeVisible();
  await expect(summary.locator("time").nth(0)).toHaveText(
    "Oct 28, 2026 · 10:25 PM",
  );
  await expect(summary.locator("time").nth(1)).toHaveText(
    "Oct 29, 2026 · 2:26 PM",
  );
  await expect(summary.locator(".calendar-workout-duration")).toContainText(
    "15h 1m",
  );
  await expect(summary.locator(".calendar-workout-paused")).toHaveText(
    "Time paused1h",
  );
  const link = summary.getByRole("link", { name: "View workout", exact: true });
  await expect(link).toHaveAttribute(
    "href",
    `/fitness/session/${workout.id}?${new URLSearchParams({ returnCalendar: "/?date=2026-10-29&view=day" })}`,
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const bounds = await summary.boundingBox();
  const viewport = page.viewportSize()!;
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
  await page.screenshot({ path: info.outputPath("recorded-workout.png") });
  await page.keyboard.press("Escape");
  await expect(summary).toHaveCount(0);
  await expect(record).toBeFocused();
  await record.click();
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/fitness/session/${workout.id}`));
  await expect(
    page.getByRole("button", { name: "Correct results", exact: true }),
  ).toBeVisible();
  const saved = await (
    await page.request.get(`/api/v1/strength-workouts/${workout.id}`)
  ).json();
  expect(saved.version).toBe(workout.version);
});
for (const [weekStartsOn, date, nextDate] of [
  [1, "2026-09-06", "2026-09-07"],
  [0, "2026-09-05", "2026-09-06"],
] as const)
  test(`Month copies cross-week identities once with week start ${weekStartsOn}`, async ({
    page,
  }, info) => {
    await setup(page, "UTC", weekStartsOn);
    const plan = await create(
      page,
      date + "T23:30:00Z",
      nextDate + "T00:30:00Z",
    );
    await page.goto(`/?date=${date}&view=month`);
    await expect(page.locator(".calendar-interactions")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    if (info.project.name !== "phone") {
      const card = page.locator(
        `[data-date="${date}"] [data-calendar-record="${plan.id}"]`,
      );
      await card.click();
      await page.keyboard.press("Meta+c");
      await expect(page.locator(".app-toast")).toContainText("Plan copied");
      await card.click({ button: "right" });
      await page
        .getByRole("menuitem", { name: "Duplicate", exact: true })
        .click();
      const records = async () =>
        (
          await (await page.request.get(`/api/v1/weeks/${date}`)).json()
        ).blocks.filter((b: { title: string }) => b.title === "Cross boundary");
      await expect.poll(async () => (await records()).length).toBe(2);
      await expect(page.locator(".app-toast")).toContainText(
        "Plans duplicated",
      );
      await expect(page.locator(".calendar-interactions")).toHaveAttribute(
        "aria-busy",
        "false",
      );
      await page.keyboard.press("Meta+z");
      await expect.poll(async () => (await records()).length).toBe(1);
    }
    const day = page.locator(`[data-date="${date}"] .month-select-day`);
    const bounds = await day.boundingBox();
    await day.click({ position: { x: bounds!.width - 7, y: 7 } });
    await page.keyboard.press("Meta+c");
    const target = page.locator('[data-date="2026-09-10"] .month-select-day');
    const targetBounds = await target.boundingBox();
    await target.click({ position: { x: targetBounds!.width - 7, y: 7 } });
    await page.keyboard.press("Meta+v");
    await expect
      .poll(async () => {
        const w = await (
          await page.request.get("/api/v1/weeks/2026-09-10")
        ).json();
        return w.blocks.filter((b: { startsAt: string }) =>
          b.startsAt.startsWith("2026-09-10"),
        ).length;
      })
      .toBe(1);
  });
for (const [start, end] of [
  ["2026-11-01T07:30:12.123Z", "2026-11-01T09:00:45.456Z"],
  ["2026-11-01T08:30:00Z", "2026-11-01T09:00:00Z"],
  ["2026-11-01T07:30:00Z", "2026-11-01T08:30:00Z"],
])
  test(`saved repeated-hour edits preserve ${start} and ${end}`, async ({
    page,
  }) => {
    await setup(page, "America/Denver");
    const plan = await create(page, start!, end!);
    await page.goto("/?date=2026-11-01&view=day");
    await expect(page.locator(".calendar-interactions")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    await page
      .getByRole("region", { name: "Daily time grid" })
      .getByRole("button", { name: /Cross boundary.*planned/ })
      .dblclick();
    const editor = page.getByRole("dialog", { name: "Edit plan", exact: true });
    await editor
      .getByLabel("Title", { exact: true })
      .fill("Updated without moving");
    await editor.getByRole("button", { name: "Save", exact: true }).click();
    await expect(editor).toHaveCount(0);
    const saved = await (
      await page.request.get(`/api/v1/time-blocks/${plan.id}`)
    ).json();
    expect(saved.title).toBe("Updated without moving");
    expect(saved.startsAt).toBe(new Date(start!).toISOString());
    expect(saved.endsAt).toBe(new Date(end!).toISOString());
  });
test("date pickers keep usable targets and remain within a 320px viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await setup(page);
  await create(page, "2026-09-07T09:00:00Z", "2026-09-07T10:00:00Z");
  await page.goto("/?date=2026-09-07&view=day");
  await expect(page.locator(".calendar-interactions")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page
    .getByRole("region", { name: "Daily time grid" })
    .getByRole("button", { name: /Cross boundary.*planned/ })
    .dblclick();
  const editor = page.getByRole("dialog", { name: "Edit plan", exact: true });
  const trigger = editor.getByRole("button", {
    name: "Start date",
    exact: true,
  });
  await trigger.click();
  const picker = page.getByRole("dialog", { name: "Choose day", exact: true });
  const rect = await picker.boundingBox();
  expect(rect!.x).toBeGreaterThanOrEqual(8);
  expect(rect!.x + rect!.width).toBeLessThanOrEqual(312);
  for (const size of await picker
    .locator(".calendar-picker-days button")
    .evaluateAll((els) =>
      els.map((e) => ({
        width: e.getBoundingClientRect().width,
        height: e.getBoundingClientRect().height,
      })),
    )) {
    expect(size.width).toBeGreaterThanOrEqual(24);
    expect(size.height).toBeGreaterThanOrEqual(24);
  }
  await page.keyboard.press("Escape");
  await expect(picker).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(editor).toBeVisible();
});
