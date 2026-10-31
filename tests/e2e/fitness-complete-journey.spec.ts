import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  localDate,
  workoutSeconds,
} from "../../packages/domain-utils/src/time";
test.use({ actionTimeout: 10000 });
test("scheduled workout travels through Calendar, logging, pause, summary, correction and history with one time source", async ({
  page,
}, info) => {
  test.setTimeout(120000);
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
  const read = async (path: string) => {
    const response = await page.request.get(path);
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  };
  await write("/api/__test/register", {
    name: "Complete journey",
    email: `journey-${randomUUID()}@example.com`,
    password: "Synthetic-journey-password-123",
  });
  const me = await read("/api/v1/me");
  await write(
    "/api/v1/preferences",
    {
      timezone: "America/Edmonton",
      weekStartsOn: 1,
      weightUnit: "kg",
      distanceUnit: "km",
    },
    me.preferences.version,
  );
  const bench = await write("/api/v1/exercises", { name: "Journey bench" });
  const row = await write("/api/v1/exercises", { name: "Journey row" });
  const plan = await write("/api/v1/strength-plans", {
    title: "Complete journey",
    isDraft: false,
    notes: "Keep the planned targets separate from results.",
    exercises: [
      {
        exerciseId: bench.id,
        sets: [
          { targetReps: 12, targetWeightKg: 50, restSeconds: 90 },
          { targetReps: 12, targetWeightKg: 50 },
        ],
      },
      {
        exerciseId: row.id,
        sets: [
          { targetReps: 8, targetWeightKg: 30 },
          { targetReps: 8, targetWeightKg: 30 },
          { targetReps: 8, targetWeightKg: 30 },
        ],
      },
    ],
  });
  const now = new Date("2026-10-29T16:00:00Z");
  const date = localDate(now, "America/Edmonton");
  await page.clock.install({ time: now });
  await write("/api/v1/time-blocks", {
    title: "Later plan",
    startsAt: new Date(now.getTime() + 7200000).toISOString(),
    endsAt: new Date(now.getTime() + 10800000).toISOString(),
  });
  if (info.project.name === "phone")
    await page.setViewportSize({ width: 320, height: 844 });
  await page.goto(`/fitness?date=${date}`);
  await page.getByRole("button", { name: "Schedule", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Schedule workout", exact: true })
    .getByRole("button", { name: "Schedule workout", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Schedule workout", exact: true }),
  ).toHaveCount(0);
  const schedules = await read("/api/v1/strength-plans?kind=scheduled");
  expect(schedules.items).toHaveLength(1);
  const scheduled = schedules.items[0];
  const reservation = await read(
    `/api/v1/time-blocks/${scheduled.timeBlockId}`,
  );
  await page
    .getByRole("button", { name: "View in Calendar", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`date=${date}&view=day`));
  await page
    .getByRole("region", { name: "Daily time grid", exact: true })
    .getByRole("button", { name: /Complete journey.*planned/ })
    .dblclick();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Start workout", exact: true })
    .click();
  await expect(page).toHaveURL(/\/fitness\/session\//);
  const sessionId = new URL(page.url()).pathname.split("/").at(-1)!;
  const session = () => read(`/api/v1/strength-workouts/${sessionId}`);
  const saved = () =>
    expect(page.locator(".fitness-save-state")).toHaveText("Saved");
  const current = page.getByRole("region", {
    name: "Current set",
    exact: true,
  });
  await current.getByLabel("Actual reps", { exact: true }).fill("10");
  await current.getByLabel("Actual weight (kg)", { exact: true }).fill("55");
  await current
    .getByRole("button", { name: "Complete set", exact: true })
    .click();
  await saved();
  await page.clock.fastForward(30000);
  await page
    .getByRole("button", { name: "Pause workout", exact: true })
    .click();
  await saved();
  const elapsed = page.getByRole("timer", {
    name: "Workout elapsed time",
    exact: true,
  });
  const pausedTime = await elapsed.textContent();
  await page.clock.fastForward(120000);
  await expect(elapsed).toHaveText(pausedTime!);
  await expect(
    current.getByRole("button", { name: "Complete set", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(
    page.getByRole("status", { name: "Workout status", exact: true }),
  ).toHaveText("Paused");
  await page
    .getByRole("button", { name: "Resume workout", exact: true })
    .click();
  await saved();
  await current.getByRole("button", { name: "Skip set", exact: true }).click();
  await saved();
  await page
    .getByRole("button", { name: "Next exercise: Journey row", exact: true })
    .click();
  await current.getByLabel("Actual reps", { exact: true }).fill("9");
  await current.getByLabel("Actual weight (kg)", { exact: true }).fill("");
  await current
    .getByRole("button", { name: "Complete set", exact: true })
    .click();
  await saved();
  await current.getByLabel("Actual reps", { exact: true }).fill("99");
  await current.getByLabel("Actual weight (kg)", { exact: true }).fill("999");
  await saved();
  await page.clock.fastForward(30000);
  await page
    .getByRole("button", { name: "Finish workout", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Finish workout", exact: true })
    .click();
  const heading = page.getByRole("heading", {
    name: "Complete journey - Summary",
    exact: true,
  });
  await expect(heading).toBeVisible();
  const results = page.getByRole("region", {
    name: "Workout results",
    exact: true,
  });
  await expect(results).toContainText("2 / 5");
  await expect(results).toContainText("1 skipped set");
  await expect(results).toContainText("2 unfinished sets");
  await expect(results).not.toContainText("999 kg");
  const finished = await session();
  expect(finished.exercises[0].sets[0].weightKg).toBe(55);
  expect(finished.exercises[0].sets[0].targetWeightKg).toBe(50);
  expect(finished.exercises[1].sets[0].weightKg).toBeNull();
  expect(finished.pauses).toHaveLength(1);
  const verifyTime = async () => {
    const value = await session();
    const week = await read(`/api/v1/weeks/${date}`);
    const sources = week.entries.filter(
      (entry: { sourceId: string }) => entry.sourceId === sessionId,
    );
    expect(sources).toHaveLength(1);
    expect(sources[0].excludedIntervals).toEqual(value.pauses);
    expect(week.recordedSeconds).toBeCloseTo(workoutSeconds(value), 5);
    const unchanged = await read(`/api/v1/time-blocks/${reservation.id}`);
    expect(unchanged.startsAt).toBe(reservation.startsAt);
    expect(unchanged.endsAt).toBe(reservation.endsAt);
  };
  await verifyTime();
  expect(workoutSeconds(finished)).toBeGreaterThan(50);
  expect(workoutSeconds(finished)).toBeLessThan(100);
  await page
    .getByRole("button", { name: "Correct results", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Expand Journey bench exercise", exact: true })
    .click();
  const set = page
    .getByRole("region", { name: "Journey bench exercise 1", exact: true })
    .getByRole("group", { name: "Set 1", exact: true });
  await set.getByLabel("Actual reps", { exact: true }).fill("11");
  await set.getByLabel("Actual weight (kg)", { exact: true }).fill("60");
  await page
    .getByRole("button", { name: "Save corrections", exact: true })
    .click();
  await expect(heading).toBeVisible();
  await expect(results).toContainText("60 kg");
  await verifyTime();
  const corrected = await session();
  expect(corrected.exercises[0].sets[0].reps).toBe(11);
  expect(corrected.exercises[0].sets[0].targetReps).toBe(12);
  await page
    .getByRole("navigation", { name: "Fitness views" })
    .getByRole("link", { name: "History", exact: true })
    .click();
  const history = page.getByRole("region", {
    name: "Workout history",
    exact: true,
  });
  await expect(
    history.getByRole("link", { name: /Complete journey/ }),
  ).toHaveCount(1);
  await expect(history).toContainText("2 completed sets");
  await page.goto(`/fitness/exercises/${bench.id}`);
  const details = page.getByRole("region", {
    name: "Journey bench details",
    exact: true,
  });
  await expect(details.locator(".fitness-progress-records")).toContainText(
    "60 kg",
  );
  await expect(
    details.getByRole("region", { name: "Latest session", exact: true }),
  ).toContainText("11");
  const original = await read(`/api/v1/strength-plans/${plan.id}`);
  expect(original.version).toBe(plan.version);
  expect(original.exercises[0].sets[0].targetWeightKg).toBe(50);
  await page.goto(`/?date=${date}&view=day`);
  await expect(
    page.getByRole("region", { name: "Daily time grid", exact: true }),
  ).toBeVisible();
  const next = page.locator(".day-at-a-glance-next");
  await expect(next).toContainText("Later plan");
  await expect(next).not.toContainText("Complete journey");
  await expect(
    page.getByRole("region", { name: "Day activity", exact: true }),
  ).toContainText("Workout completed");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("complete-workout-calendar.png"),
  });
  await page
    .getByRole("region", { name: "Daily time grid", exact: true })
    .getByRole("button", { name: /Complete journey.*planned/ })
    .dblclick();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "View workout summary", exact: true })
    .click();
  await expect(heading).toBeVisible();
  expect((await read("/api/v1/strength-workouts")).items).toHaveLength(1);
  // Completion follows the linked workout even when its reservation moves
  // into a week that contains none of the recorded workout time.
  const futureStart = new Date(now.getTime() + 14 * 86400000);
  await write(
    `/api/v1/time-blocks/${reservation.id}`,
    {
      title: reservation.title,
      startsAt: futureStart.toISOString(),
      endsAt: new Date(futureStart.getTime() + 3600000).toISOString(),
    },
    reservation.version,
  );
  await page.goto(
    `/?date=${localDate(futureStart, "America/Edmonton")}&view=day`,
  );
  await expect(
    page.getByRole("region", { name: "Day activity", exact: true }),
  ).toContainText("Workout completed");
  await expect(page.locator(".day-at-a-glance-next")).toHaveCount(0);
});
