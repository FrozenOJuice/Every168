import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("summary surfaces records and outcomes, keeps long phone metrics readable and compares recorded results consistently", async ({
  page,
}, info) => {
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
    name: "Summary polish",
    email: `summary-polish-${randomUUID()}@example.com`,
    password: "Synthetic-polish-password-123",
  });
  const me = await (await page.request.get("/api/v1/me")).json();
  await write(
    "/api/v1/preferences",
    { timezone: "UTC", weekStartsOn: 1, weightUnit: "kg", distanceUnit: "km" },
    me.preferences.version,
  );
  const bench = await write("/api/v1/exercises", { name: "Bench press" });
  const row = await write("/api/v1/exercises", {
    name: "Single-arm dumbbell row",
  });
  const timed = await write("/api/v1/exercises", { name: "Timed intervals" });
  const track = await write("/api/v1/exercises", { name: "Track intervals" });
  const exercises = (current: boolean) => [
    {
      exerciseId: bench.id,
      loggingType: "reps_load",
      sets: current
        ? [
            { reps: 10, weightKg: 50, targetReps: 12, targetWeightKg: 50 },
            { reps: 8, weightKg: null, targetReps: 12, targetWeightKg: 50 },
            {
              completed: false,
              skipped: true,
              targetReps: 12,
              targetWeightKg: 50,
            },
          ]
        : [{ reps: 8, weightKg: 40 }],
    },
    {
      exerciseId: row.id,
      loggingType: "reps_load",
      sets: current
        ? [
            {
              completed: false,
              skipped: true,
              targetReps: 12,
              targetWeightKg: 20,
            },
          ]
        : [{ reps: 8, weightKg: 20 }],
    },
    {
      exerciseId: timed.id,
      loggingType: "duration",
      sets: current
        ? [{ completed: false, targetDurationSeconds: 90 }]
        : [{ durationSeconds: 80 }],
    },
    {
      exerciseId: track.id,
      loggingType: "distance_laps_duration",
      sets: [
        {
          distanceMeters: current ? 400 : 200,
          durationSeconds: current ? 100 : 80,
          laps: 1,
        },
      ],
    },
  ];
  const earlier = await write("/api/v1/strength-workouts", {
    title: "Earlier mixed workout",
    startedAt: "2026-10-24T18:00:00Z",
  });
  const previous = await write(
    `/api/v1/strength-workouts/${earlier.id}`,
    {
      title: earlier.title,
      startedAt: earlier.startedAt,
      endedAt: "2026-10-24T19:00:00Z",
      exercises: exercises(false),
    },
    earlier.version,
  );
  const session = await write("/api/v1/strength-workouts", {
    title: "Upper body strength and track intervals - evening session",
    startedAt: "2026-10-25T10:00:00Z",
  });
  const finished = await write(
    `/api/v1/strength-workouts/${session.id}`,
    {
      title: session.title,
      startedAt: session.startedAt,
      endedAt: "2026-10-26T01:42:44Z",
      notes: "Stopped early to protect a sore shoulder.",
      pauses: [
        { startsAt: "2026-10-25T11:00:00Z", endsAt: "2026-10-25T23:30:00Z" },
      ],
      exercises: exercises(true),
    },
    session.version,
  );
  await page.goto(`/fitness/session/${finished.id}`);
  const results = page.getByRole("region", {
    name: "Workout results",
    exact: true,
  });
  await expect(results.getByRole("definition").first()).toContainText(
    "3h 12m 44s",
  );
  const breakdown = results.locator('dl[aria-label="Workout time breakdown"]');
  await expect(breakdown).toContainText("Total elapsed time15h 42m 44s");
  await expect(breakdown).toContainText("Time paused12h 30m");
  await expect(results).not.toContainText("paused time excluded");
  const notes = results.getByRole("region", {
    name: "Workout notes",
    exact: true,
  });
  await expect(notes).toHaveClass("fitness-live-workout-notes");
  await expect(notes).toContainText(
    "Stopped early to protect a sore shoulder.",
  );
  const footer = page.locator(".fitness-summary-footer");
  await expect(footer.locator(":scope > .button")).toHaveCount(4);
  await expect(footer.locator(".fitness-session-actions")).toHaveCount(0);
  expect(
    await footer.evaluate(
      (element) => getComputedStyle(element).borderTopWidth,
    ),
  ).toBe("0px");
  await expect(
    footer.getByRole("button", { name: "Save as new workout", exact: true }),
  ).toBeVisible();
  await footer
    .getByRole("button", { name: "Delete recorded workout", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Delete recorded workout?" }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Delete recorded workout?" }),
  ).toContainText("Your reusable workout and planned time stay.");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByText("More actions", { exact: true })).toHaveCount(0);
  await footer.screenshot({ path: info.outputPath("summary-footer.png") });
  await notes.screenshot({ path: info.outputPath("summary-notes.png") });
  await results
    .locator(".fitness-summary-overview")
    .screenshot({ path: info.outputPath("summary-overview.png") });
  const benchResult = results.getByRole("region", {
    name: "Bench press results 1",
    exact: true,
  });
  await expect(
    benchResult.locator(".fitness-summary-highlights"),
  ).toContainText("2 new records");
  await expect(
    benchResult.getByRole("list", {
      name: "Bench press recorded sets",
      includeHidden: true,
    }),
  ).not.toBeVisible();
  const skipped = results.getByRole("region", {
    name: "Single-arm dumbbell row results 2",
    exact: true,
  });
  await expect(skipped.locator(".fitness-review-result")).toHaveText("Skipped");
  const unfinished = results.getByRole("region", {
    name: "Timed intervals results 3",
    exact: true,
  });
  await expect(unfinished.locator(".fitness-review-result")).toHaveText(
    "Unfinished",
  );
  await expect(results).not.toContainText("Recorded: No completed sets");
  const longest = results
    .getByRole("region", { name: "Track intervals results 4", exact: true })
    .locator(".fitness-summary-highlights");
  await expect(longest).toContainText("Longest recorded distance");
  await expect(longest).toContainText("Longest recorded duration");
  await expect(longest.locator('[data-performance="true"]')).toHaveCount(0);
  await page
    .locator(".fitness-review-exercises")
    .screenshot({ path: info.outputPath("summary-records-and-outcomes.png") });
  await page
    .getByRole("button", { name: "Show all sets", exact: true })
    .click();
  await expect(benchResult).toContainText("8 reps · Weight not recorded");
  await expect(benchResult).toContainText("Planned: 1×12 | 50 kg");
  await page
    .getByRole("button", { name: "Hide all sets", exact: true })
    .click();
  await page
    .getByText("Compare with previous workout", { exact: true })
    .click();
  const comparison = page.locator(".fitness-workout-comparison");
  const lastExercise = await results
    .locator(".fitness-review-exercise")
    .last()
    .boundingBox();
  const comparisonBox = await comparison.boundingBox();
  expect(
    comparisonBox!.y - lastExercise!.y - lastExercise!.height,
  ).toBeGreaterThanOrEqual(24);
  expect(
    await comparison.evaluate(
      (element) => getComputedStyle(element).borderTopWidth,
    ),
  ).toBe("0px");
  const toggle = comparison.getByRole("button", {
    name: "Compare with previous workout",
    exact: true,
  });
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  expect((await toggle.boundingBox())!.width).toBeCloseTo(
    comparisonBox!.width,
    0,
  );
  const time = comparison.getByRole("region", {
    name: "Workout time comparison",
    exact: true,
  });
  await expect(time.getByRole("definition").nth(0)).toHaveText("3h 12m 44s");
  await expect(time.getByRole("definition").nth(1)).toHaveText("1h");
  const source = comparison.getByRole("link", {
    name: /^Open workout: Earlier mixed workout/,
  });
  await expect(source).toHaveClass(/fitness-workout-reference-link/);
  await expect(source).toContainText("Oct 24, 2026");
  const table = comparison.getByRole("table", {
    name: "Bench press recorded results comparison",
    exact: true,
  });
  await expect(
    table.getByRole("row", { name: "Highest weight 50 kg 40 kg", exact: true }),
  ).toBeVisible();
  await expect(
    table.getByRole("row", { name: "Most reps in a set 10 8", exact: true }),
  ).toBeVisible();
  await expect(comparison).not.toContainText("Session duration");
  await expect(comparison).not.toContainText("Recorded volume");
  await comparison
    .locator(".fitness-comparison-time")
    .screenshot({ path: info.outputPath("comparison-time.png") });
  await table.screenshot({ path: info.outputPath("comparison-results.png") });
  await comparison.screenshot({
    path: info.outputPath("comparison-panel.png"),
  });
  await toggle.click();
  await expect(table).not.toBeVisible();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  if (info.project.name === "phone") {
    await page.setViewportSize({ width: 320, height: 740 });
    const stats = results.locator(".fitness-summary-stats > div");
    const first = await stats.nth(0).boundingBox();
    const second = await stats.nth(1).boundingBox();
    expect(second!.y).toBeGreaterThan(first!.y);
    const rectCount = await stats
      .nth(0)
      .locator("dd")
      .evaluate((element) => {
        const range = document.createRange();
        range.selectNodeContents(element.firstChild!);
        return range.getClientRects().length;
      });
    expect(rectCount).toBe(1);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .locator(".fitness-summary-overview")
      .screenshot({ path: info.outputPath("summary-overview-320.png") });
    await table.screenshot({
      path: info.outputPath("comparison-results-320.png"),
    });
  }
  expect(
    (
      await (
        await page.request.get(`/api/v1/strength-workouts/${finished.id}`)
      ).json()
    ).version,
  ).toBe(finished.version);
  await source.click();
  await expect(
    page.getByRole("heading", {
      name: "Earlier mixed workout - Summary",
      exact: true,
    }),
  ).toBeVisible();
  const baseline = page
    .getByRole("region", { name: "Bench press results 1", exact: true })
    .locator(".fitness-summary-highlights");
  await expect(baseline).toHaveText("First recorded result");
  await expect(baseline.locator('[data-performance="true"]')).toHaveCount(0);
  expect(
    (
      await (
        await page.request.get(`/api/v1/strength-workouts/${previous.id}`)
      ).json()
    ).version,
  ).toBe(previous.version);
});
