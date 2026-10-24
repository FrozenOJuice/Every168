import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { Workout } from "../../packages/contracts/src/exercise";
const headers = (version?: number) => ({
  Origin: "http://localhost:3100",
  "Idempotency-Key": randomUUID(),
  ...(version ? { "If-Match": `"${version}"` } : {}),
});
async function setup(page: Page, withWorkouts = true) {
  const write = async (
    method: "post" | "put",
    path: string,
    data: object,
    version?: number,
  ) => {
    const response = await page.request[method](path, {
      headers: headers(version),
      data,
    });
    expect(response.ok()).toBe(true);
    return response.json();
  };
  await write("post", "/api/auth/sign-up/email", {
    name: "Progress test",
    email: `progress-${randomUUID()}@example.com`,
    password: "Synthetic-progress-password-123",
  });
  const me = await (await page.request.get("/api/v1/me")).json();
  await write(
    "put",
    "/api/v1/preferences",
    { timezone: "UTC", weekStartsOn: 1, weightUnit: "kg", distanceUnit: "km" },
    me.preferences.version,
  );
  const exercise = await write("post", "/api/v1/exercises", {
    name: "Progress squat",
  });
  const workouts: Workout[] = [];
  if (withWorkouts)
    for (const [date, reps, weight] of [
      ["2026-10-12", 8, 40],
      ["2026-10-14", 10, 50],
    ] as const) {
      const w = await write("post", "/api/v1/strength-workouts", {
        title: "Progress workout",
        startedAt: `${date}T15:00:00Z`,
      });
      workouts.push(
        await write(
          "put",
          `/api/v1/strength-workouts/${w.id}`,
          {
            title: w.title,
            startedAt: w.startedAt,
            endedAt: `${date}T16:00:00Z`,
            exercises: [
              {
                exerciseId: exercise.id,
                sets: [
                  { reps, weightKg: weight },
                  { reps: 8, weightKg: null },
                ],
              },
            ],
          },
          w.version,
        ),
      );
    }
  return { exercise, workouts, write };
}

test("exercise recall, weekly totals and records work with units, empty modes and source links", async ({
  page,
}, testInfo) => {
  const { exercise, workouts, write } = await setup(page);
  await page.goto("/fitness");
  await page.getByRole("link", { name: "History", exact: true }).click();
  await page.getByText("Weekly totals", { exact: true }).click();
  await page.getByLabel("Week containing", { exact: true }).fill("2026-10-14");
  await expect(page).toHaveURL(/date=2026-10-14/);
  await expect(
    page.getByRole("heading", { name: "Week of Oct 12, 2026" }),
  ).toBeVisible();
  const cards = page.locator(".fitness-progress-metrics");
  await expect(
    cards
      .locator("div")
      .filter({ has: page.getByText("Finished workouts", { exact: true }) })
      .locator("dd"),
  ).toHaveText("2");
  await expect(cards).toContainText("2h 00m");
  await expect(cards).toContainText("820 kg·reps · 2 incomplete sets");
  await page.getByRole("link", { name: "Previous week", exact: true }).click();
  await expect(cards).toContainText("0h 00m");
  await page.getByRole("link", { name: "Next week", exact: true }).click();
  await expect(cards).toContainText("2h 00m");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("weekly-progress.png"),
    fullPage: true,
  });
  await page.goto(`/fitness/exercises/${exercise.id}`);
  await expect(
    page.getByRole("heading", { name: "Progress squat", exact: true }),
  ).toBeVisible();
  const lastTime = page.locator(".fitness-recall-section");
  await expect(lastTime).toContainText("Oct 14, 2026");
  await expect(lastTime.locator("tbody tr")).toHaveCount(2);
  await expect(lastTime.locator("tbody tr").first()).toContainText("50 kg");
  await expect(lastTime.locator("tbody tr").first()).toContainText("10");
  await expect(lastTime.locator("tbody tr").last()).toContainText(
    "Not recorded",
  );
  await page.locator(".fitness-session-history summary").first().click();
  await expect(page.locator(".fitness-session-history")).toContainText("40 kg");
  if (
    !(await page
      .locator("details")
      .filter({
        has: page.locator("summary", { hasText: /^Personal records$/ }),
      })
      .evaluate((element) => (element as HTMLDetailsElement).open))
  )
    await page.getByText("Personal records", { exact: true }).first().click();
  const records = page.locator(".fitness-progress-records");
  await expect(records).toContainText("50 kg");
  await expect(records).toContainText("10 reps");
  await expect(records).toContainText("500 kg·reps");
  await page.getByText("Session statistics", { exact: true }).first().click();
  await page
    .getByRole("button", { name: "Progress measure", exact: true })
    .click();
  await page
    .getByRole("option", { name: "Recorded session volume", exact: true })
    .click();
  await expect(page.locator(".fitness-progress-change")).toContainText(
    "Not comparable",
  );
  await expect(page.locator(".fitness-progress-sessions")).toContainText(
    "1 incomplete set",
  );
  await page.getByRole("checkbox", { name: "Duration", exact: true }).check();
  await page.getByRole("checkbox", { name: "Reps", exact: true }).uncheck();
  await page.getByRole("checkbox", { name: "Load", exact: true }).uncheck();

  if (
    !(await page
      .locator("details")
      .filter({
        has: page.locator("summary", { hasText: /^Personal records$/ }),
      })
      .evaluate((element) => (element as HTMLDetailsElement).open))
  )
    await page.getByText("Personal records", { exact: true }).first().click();
  await expect(
    page.getByText("No records yet for Duration.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("checkbox", { name: "Reps", exact: true }).check();
  await page.getByRole("checkbox", { name: "Load", exact: true }).check();
  await page.getByRole("checkbox", { name: "Duration", exact: true }).uncheck();

  if (
    !(await page
      .locator("details")
      .filter({
        has: page.locator("summary", { hasText: /^Personal records$/ }),
      })
      .evaluate((element) => (element as HTMLDetailsElement).open))
  )
    await page.getByText("Personal records", { exact: true }).first().click();
  await expect(records).toContainText("50 kg");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("exercise-progress.png"),
    fullPage: true,
  });
  const me = await (await page.request.get("/api/v1/me")).json();
  await write(
    "put",
    "/api/v1/preferences",
    { timezone: "UTC", weekStartsOn: 1, weightUnit: "lb", distanceUnit: "km" },
    me.preferences.version,
  );
  await page.reload();
  await expect(lastTime).toContainText("110.2 lb");
  if (
    !(await page
      .locator("details")
      .filter({
        has: page.locator("summary", { hasText: /^Personal records$/ }),
      })
      .evaluate((element) => (element as HTMLDetailsElement).open))
  )
    await page.getByText("Personal records", { exact: true }).first().click();
  await expect(records).toContainText("110.2 lb");
  await records.locator("li").first().getByRole("link").click();
  await expect(page).toHaveURL(new RegExp(workouts[1]!.id));
  await page.getByText("Compare previous workout", { exact: true }).click();
  const comparison = page.locator(".fitness-workout-comparison");
  await expect(comparison).toContainText("Previous: Oct 12, 2026");
  await expect(comparison).toContainText("88.2 lb");
  await expect(comparison).toContainText("110.2 lb");
  await expect(
    comparison.getByRole("link", { name: "Progress squat", exact: true }),
  ).toHaveAttribute("href", `/fitness/exercises/${exercise.id}`);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("saved corrections and deletions update progress, and training shows the previous session", async ({
  page,
}) => {
  const { exercise, workouts, write } = await setup(page);
  const current = workouts[1]!;
  await page.goto(`/fitness/session/${current.id}`);
  await page.getByLabel("Actual load (kg)", { exact: true }).first().fill("60");
  await expect(page.locator(".fitness-save-state")).toHaveText("Saved");
  await page.goto(`/fitness/exercises/${exercise.id}`);
  await expect(page.locator(".fitness-recall-section")).toContainText("60 kg");
  await page.goto(`/fitness/session/${current.id}`);
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Delete workout", exact: true })
    .click();
  await expect(page).toHaveURL(/\/fitness\/history$/);
  await page.goto(`/fitness/exercises/${exercise.id}`);
  await expect(page.locator(".fitness-recall-section")).toContainText("40 kg");
  await expect(page.locator(".fitness-recall-section")).not.toContainText(
    "60 kg",
  );
  const previous = workouts[0]!;
  const active = await write(
    "post",
    `/api/v1/strength-workouts/${previous.id}/repeat`,
    {},
    previous.version,
  );
  await page.goto(`/fitness/session/${active.id}`);
  await expect(page.locator(".fitness-previous-set")).toContainText(
    "Last time · Oct 12, 2026",
  );
  await expect(page.locator(".fitness-previous-set")).toContainText(
    "Set 2: 8 reps",
  );
  await expect(page.locator(".fitness-previous-set")).toContainText("40 kg");
  await page
    .locator(".fitness-previous-set")
    .getByRole("button", { name: /Last time/ })
    .click();
  await expect(
    page
      .getByRole("complementary", {
        name: "Exercise library panel",
        exact: true,
      })
      .locator(".fitness-recall-section"),
  ).toContainText("40 kg");
});

test("progress has useful empty states and retry after a read failure", async ({
  page,
}) => {
  await setup(page, false);
  let fail = true;
  await page.route("**/api/v1/fitness-progress", async (route) => {
    if (fail)
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "UNAVAILABLE",
            message: "Progress is temporarily unavailable.",
          },
        }),
      });
    else await route.continue();
  });
  await page.goto("/fitness/history");
  await page.getByText("Weekly totals", { exact: true }).click();
  await expect(
    page.getByText("Progress is temporarily unavailable.", { exact: true }),
  ).toBeVisible();
  fail = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByText("No workouts recorded yet.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".fitness-progress-metrics")).toContainText(
    "Not recorded",
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
