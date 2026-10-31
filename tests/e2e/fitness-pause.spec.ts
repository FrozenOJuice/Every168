import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { workoutSeconds } from "../../packages/domain-utils/src/time";

test("pause freezes logging and both timers through refresh, resumes and excludes paused time on finish", async ({
  page,
}, info) => {
  const write = async (path: string, data: object, version?: number) => {
    const response = await page.request.post(path, {
      headers: {
        Origin: "http://localhost:3100",
        "Idempotency-Key": randomUUID(),
        ...(version ? { "If-Match": `"${version}"` } : {}),
      },
      data,
    });
    expect(response.ok()).toBe(true);
    return response.json();
  };
  await write("/api/__test/register", {
    name: "Pause training",
    email: `pause-${randomUUID()}@example.com`,
    password: "Synthetic-pause-password-123",
  });
  const exercise = await write("/api/v1/exercises", { name: "Paused bench" });
  const plan = await write("/api/v1/strength-plans", {
    title: "Pause training",
    isDraft: false,
    notes: "Keep a steady tempo.",
    exercises: [
      {
        exerciseId: exercise.id,
        sets: [
          { targetReps: 12, targetWeightKg: 50, restSeconds: 90 },
          { targetReps: 12, targetWeightKg: 50 },
        ],
      },
    ],
  });
  const session = await write(
    `/api/v1/strength-plans/${plan.id}/begin`,
    { startedAt: new Date(Date.now() - 60000).toISOString() },
    plan.version,
  );
  const read = async () =>
    (await page.request.get(`/api/v1/strength-workouts/${session.id}`)).json();
  const saved = async () =>
    expect(page.locator(".fitness-save-state")).toHaveText("Saved");
  await page.goto(`/fitness/session/${session.id}`);
  const current = page.getByRole("region", {
    name: "Current set",
    exact: true,
  });
  await expect(current).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: info.outputPath("running-controls.png") });
  const clockTime = new Date(Date.now() + 1000);
  await page.clock.install({ time: clockTime });
  await page.clock.pauseAt(new Date(clockTime.getTime() + 1000));
  await current
    .getByRole("button", { name: "Complete set", exact: true })
    .click();
  await page.clock.runFor(1000);
  await saved();
  await page.clock.runFor(30000);
  await page
    .getByRole("button", { name: "Pause workout", exact: true })
    .click();
  await saved();
  await page.clock.runFor(1000);
  const elapsed = page.getByRole("timer", {
    name: "Workout elapsed time",
    exact: true,
  });
  const rest = page
    .getByRole("timer", { name: "Rest timer", exact: true })
    .locator("strong");
  const frozenElapsed = await elapsed.textContent();
  const frozenRest = await rest.textContent();
  await expect(
    page.getByRole("status", { name: "Workout status", exact: true }),
  ).toHaveText("Paused");
  await expect(
    current.getByRole("button", { name: "Complete set", exact: true }),
  ).toBeDisabled();
  await expect(current.getByLabel("Actual weight (kg)")).toBeDisabled();
  await page.clock.runFor(120000);
  await expect(elapsed).toHaveText(frozenElapsed!);
  await expect(rest).toHaveText(frozenRest!);
  expect((await read()).pauses.at(-1).endsAt).toBeNull();
  // The workout itself stays paused; resume browser scheduling for hydration.
  await page.clock.resume();
  await page.reload();
  await expect(
    page.getByRole("status", { name: "Workout status", exact: true }),
  ).toHaveText("Paused");
  await expect(elapsed).toHaveText(frozenElapsed!);
  await expect(rest).toHaveText(frozenRest!);
  await expect(current.getByLabel("Actual weight (kg)")).toBeDisabled();
  await page
    .getByRole("button", { name: "Resume workout", exact: true })
    .click();
  await saved();
  await expect(current.getByLabel("Actual weight (kg)")).toBeEnabled();
  await page.clock.runFor(1000);
  const resumedRest = await rest.textContent();
  expect(resumedRest).not.toBe(frozenRest);
  await page
    .getByRole("button", { name: "Pause workout", exact: true })
    .click();
  await saved();
  await page.clock.runFor(60000);
  await page.locator(".fitness-live-status").scrollIntoViewIfNeeded();
  const controls = page.getByRole("group", {
    name: "Workout controls",
    exact: true,
  });
  const resumeBounds = await controls
    .getByRole("button", { name: "Resume workout", exact: true })
    .boundingBox();
  const finishBounds = await controls
    .getByRole("button", { name: "Finish workout", exact: true })
    .boundingBox();
  expect(Math.abs(resumeBounds!.y - finishBounds!.y)).toBeLessThan(1);
  expect(resumeBounds!.height).toBeGreaterThanOrEqual(44);
  if (info.project.name === "phone")
    expect(Math.abs(resumeBounds!.width - finishBounds!.width)).toBeLessThan(1);
  await page.screenshot({ path: info.outputPath("paused-workout.png") });
  if (info.project.name === "phone") {
    await page.setViewportSize({ width: 320, height: 740 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({ path: info.outputPath("paused-controls-320.png") });
  }
  // Resume real scheduling before dialog focus/animation interactions.
  await page.clock.resume();
  await page
    .getByRole("button", { name: "Finish workout", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Finish workout", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Correct results", exact: true }),
  ).toBeVisible();
  const finished = await read();
  expect(finished.pauses).toHaveLength(2);
  expect(
    finished.pauses.every(
      (pause: { endsAt: string | null }) => pause.endsAt !== null,
    ),
  ).toBe(true);
  expect(workoutSeconds(finished)).toBeGreaterThan(90);
  expect(workoutSeconds(finished)).toBeLessThan(110);
  await expect(page.getByText("Time paused", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Includes rest, excludes pauses", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("paused-workout-summary.png"),
  });
  // A direct discard removes only the session after explicit confirmation.
  const disposable = await write(
    `/api/v1/strength-plans/${plan.id}/begin`,
    { startedAt: new Date().toISOString() },
    plan.version,
  );
  await page.goto(`/fitness/session/${disposable.id}`);
  await page
    .getByRole("button", { name: "Discard workout", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Discard workout", exact: true })
    .click();
  await expect(page).toHaveURL(/\/fitness$/);
  expect(
    (
      await page.request.get(`/api/v1/strength-workouts/${disposable.id}`)
    ).status(),
  ).toBe(404);
  expect(
    (await page.request.get(`/api/v1/strength-plans/${plan.id}`)).status(),
  ).toBe(200);
});
