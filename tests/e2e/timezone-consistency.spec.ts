import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { expectCalendarField, saveCalendarPlan } from "./helpers/calendar-form";
async function setup(page: Page) {
  const write = async (path: string, data: object, version?: number) => {
    const response = await page.request[version ? "put" : "post"](
      `/api/${path}`,
      {
        headers: {
          Origin: "http://localhost:3100",
          "Idempotency-Key": randomUUID(),
          ...(version ? { "If-Match": `"${version}"` } : {}),
        },
        data,
      },
    );
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  };
  await write("__test/register", {
    name: "Timezone consistency",
    email: `timezone-${randomUUID()}@example.com`,
    password: "Synthetic-timezone-password-123",
  });
  const me = await (await page.request.get("/api/v1/me")).json();
  await write(
    "v1/preferences",
    {
      timezone: "America/Edmonton",
      weekStartsOn: 1,
      weightUnit: "kg",
      distanceUnit: "km",
    },
    me.preferences.version,
  );
  // Dated inputs are explicit; keep browser and server clocks aligned for hydration.
  return { write };
}

test("Edmonton drag creation, previews, saved positions and moves agree after November 1", async ({
  page,
}, info) => {
  await setup(page);
  for (const [date, view] of [
    ["2026-11-02", "week"],
    ["2026-12-02", "day"],
  ] as const) {
    await page.goto(`/?date=${date}&view=${view}`);
    const slot = page.locator(
      `[data-context-date="${date}"][data-context-hour="9"]`,
    );
    await slot.evaluate((element) =>
      element.scrollIntoView({ block: "center", inline: "center" }),
    );
    const box = (await slot.boundingBox())!;
    const x = box.x + Math.min(20, box.width / 2);
    const y = box.y + box.height * (5 / 60) + 1;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + box.height / 2, { steps: 5 });
    const draft = page.locator(
      `[data-drag-day="${date}"] .calendar-draft-block`,
    );
    await expect(draft).toBeVisible();
    await expect
      .poll(async () => Math.abs((await draft.boundingBox())!.y - y))
      .toBeLessThan(3);
    await page.mouse.up();
    await expectCalendarField(page, "Start", `${date}T09:05`);
    await expectCalendarField(page, "End", `${date}T09:35`);
    await page
      .getByLabel("Title", { exact: true })
      .fill(`Correct clock ${date}`);
    await saveCalendarPlan(page);
    await expect(page.getByLabel("Title", { exact: true })).toHaveCount(0);
    const week = await (await page.request.get(`/api/v1/weeks/${date}`)).json();
    const saved = week.blocks.find(
      (block: { title: string }) => block.title === `Correct clock ${date}`,
    );
    expect(saved.startsAt).toBe(`${date}T15:05:00.000Z`);
    expect(saved.endsAt).toBe(`${date}T15:35:00.000Z`);
    const record = page.locator(
      `[data-drag-day="${date}"] [data-calendar-record="${saved.id}"]`,
    );
    const position = record.locator("..");
    await expect(position).toHaveCSS("top", `${box.height * (545 / 60)}px`);
    await expect(record).toContainText("9:05");
    await page.reload();
    await expect(position).toHaveCSS("top", `${box.height * (545 / 60)}px`);
    await record.evaluate((element) =>
      element.scrollIntoView({ block: "center", inline: "center" }),
    );
    const before = (await record.boundingBox())!;
    await page.mouse.move(
      before.x + Math.min(20, before.width / 2),
      before.y + before.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      before.x + Math.min(20, before.width / 2),
      before.y + before.height / 2 + box.height,
      { steps: 6 },
    );
    await page.mouse.up();
    await expect
      .poll(
        async () =>
          (
            await (
              await page.request.get(`/api/v1/time-blocks/${saved.id}`)
            ).json()
          ).startsAt,
      )
      .toBe(`${date}T16:05:00.000Z`);
    await expect(position).toHaveCSS("top", `${box.height * (605 / 60)}px`);
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: info.outputPath("timezone-calendar.png"),
    fullPage: true,
  });
});

test("Edmonton local-midnight Food, measurement and Fitness dates match Calendar and API", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const { write } = await setup(page);
  const food = await write("v1/foods", {
    name: "Midnight oats",
    servingAmount: 1,
    servingUnit: "serving",
    calories: 100,
  });
  await write("v1/food-entries", {
    foodId: food.id,
    quantity: 1,
    consumedAt: "2026-11-02T06:30:00Z",
  });
  await write("v1/water-entries", {
    amountMl: 250,
    consumedAt: "2026-11-02T06:30:00Z",
  });
  await write("v1/weight-entries", {
    weightKg: 75,
    measuredAt: "2026-11-02T06:30:00Z",
  });
  const exercise = await write("v1/exercises", { name: "Timezone bench" });
  const workout = await write("v1/strength-workouts", {
    title: "Midnight workout",
    startedAt: "2026-11-02T06:30:00Z",
  });
  await write(
    `v1/strength-workouts/${workout.id}`,
    {
      title: workout.title,
      startedAt: workout.startedAt,
      endedAt: "2026-11-02T07:00:00Z",
      exercises: [
        {
          exerciseId: exercise.id,
          loggingType: "reps_load",
          sets: [{ reps: 5, weightKg: 20, completed: true }],
        },
      ],
    },
    workout.version,
  );
  await page.goto("/food?view=day&date=2026-11-02");
  await expect(
    page.getByRole("heading", { name: "Midnight oats", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".food-entry-list")).toContainText("12:30 AM");
  await expect(page.locator(".food-water .measurement-total")).toContainText(
    "250 ml",
  );
  await expect(page.locator(".food-weight .measurement-total")).toContainText(
    "75 kg",
  );
  await page.getByRole("button", { name: "Log food", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Quick entry", exact: true })
    .click();
  await page.getByLabel("Food name", { exact: true }).fill("After midnight");
  await page.getByLabel("Eaten at", { exact: true }).fill("2026-11-02T00:45");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Log food", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const daily = await (
    await page.request.get("/api/v1/nutrition/daily?date=2026-11-02")
  ).json();
  expect(daily.entries).toHaveLength(2);
  expect(
    daily.entries.find(
      (entry: { nameSnapshot: string }) =>
        entry.nameSnapshot === "After midnight",
    ).consumedAt,
  ).toBe("2026-11-02T06:45:00.000Z");
  await page.goto(`/fitness/session/${workout.id}`);
  await expect(
    page.getByRole("region", { name: "Workout results" }),
  ).toContainText("12:30 AM");
  await expect(
    page.getByRole("region", { name: "Workout results" }),
  ).toContainText("November 2, 2026");
  await page.goto("/?date=2026-11-02&view=day");
  await expect(
    page
      .locator(`[data-drag-day="2026-11-02"] [data-calendar-record]`)
      .filter({ hasText: "Midnight workout" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
