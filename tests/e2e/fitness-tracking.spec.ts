import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const headers = (version?: number) => ({
  Origin: "http://localhost:3100",
  "Idempotency-Key": randomUUID(),
  ...(version ? { "If-Match": `"${version}"` } : {}),
});

test("exercise-specific fields, advanced values and rest lines work in building and training", async ({
  page,
}, testInfo) => {
  expect(
    (
      await page.request.post("/api/__test/register", {
        headers: headers(),
        data: {
          name: "Tracking member",
          email: `tracking-${randomUUID()}@example.com`,
          password: "Synthetic-tracking-password-123",
        },
      })
    ).status(),
  ).toBe(200);
  await page.goto("/fitness/exercises");
  await page
    .getByRole("button", { name: "Create exercise", exact: true })
    .click();
  const editor = page.getByRole("region", {
    name: "Create exercise",
    exact: true,
  });
  await editor
    .getByLabel("Exercise name", { exact: true })
    .fill("Weighted hold");
  await editor.getByRole("checkbox", { name: "Duration", exact: true }).check();
  await editor.getByRole("checkbox", { name: "Reps", exact: true }).uncheck();
  await editor
    .getByRole("button", { name: "Create exercise", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  const custom = (
    await (
      await page.request.get("/api/v1/exercises?search=Weighted%20hold")
    ).json()
  ).items[0];
  expect(custom.loggingType).toBe("duration_load");
  await page.goto("/fitness/workout/new");
  const workout = page.getByRole("region", {
    name: "Workout workspace",
    includeHidden: true,
  });
  await workout
    .getByLabel("Workout name", { exact: true })
    .fill("Mixed tracking");
  const library = page.getByRole("complementary", {
    name: "Exercise library panel",
  });
  for (const name of ["Plank", "Bench press", "Push-up", "Weighted hold"]) {
    if (testInfo.project.name === "phone")
      await page
        .getByRole("button", { name: "Add exercises", exact: true })
        .click();
    await library
      .getByRole("searchbox", { name: "Find an exercise", exact: true })
      .fill(name);
    if (testInfo.project.name === "desktop")
      await library.getByRole("button", { name, exact: true }).hover();
    await library
      .getByRole("button", { name: `Add ${name}`, exact: true })
      .click();
    if (testInfo.project.name === "phone")
      await expect(
        page.getByRole("button", { name: "Your workout", exact: true }),
      ).toHaveAttribute("aria-pressed", "true");
  }
  const cards = workout.locator(".fitness-workout-exercise-list > section");
  const plank = cards.nth(0),
    bench = cards.nth(1),
    pushup = cards.nth(2),
    weighted = cards.nth(3);
  for (const card of [plank, bench, pushup, weighted])
    await card
      .getByRole("button", { name: "Advanced editor", exact: true })
      .click();
  await expect(
    plank.getByLabel("Target duration (seconds)", { exact: true }),
  ).toBeVisible();
  await expect(plank.getByLabel("Target reps", { exact: true })).toBeHidden();
  await expect(
    plank.getByLabel("Target weight (kg)", { exact: true }),
  ).toBeHidden();
  await expect(bench.getByLabel("Target reps", { exact: true })).toBeVisible();
  await expect(
    bench.getByLabel("Target weight (kg)", { exact: true }),
  ).toBeVisible();
  await expect(pushup.getByLabel("Target reps", { exact: true })).toBeVisible();
  await expect(
    pushup.getByLabel("Target weight (kg)", { exact: true }),
  ).toBeHidden();
  await expect(
    weighted.getByLabel("Target duration (seconds)", { exact: true }),
  ).toBeVisible();
  await expect(
    weighted.getByLabel("Target weight (kg)", { exact: true }),
  ).toBeVisible();
  await expect(
    weighted.getByLabel("Target reps", { exact: true }),
  ).toBeHidden();
  await plank
    .getByLabel("Target duration (seconds)", { exact: true })
    .fill("45");
  await plank
    .getByRole("button", { name: /Configure measurements for/ })
    .click();
  await plank.getByRole("checkbox", { name: "Reps", exact: true }).check();
  await plank.getByRole("checkbox", { name: "Weight", exact: true }).check();
  await plank.getByLabel("Target reps", { exact: true }).fill("3");
  await plank.getByLabel("Target weight (kg)", { exact: true }).fill("5");
  await plank.getByRole("checkbox", { name: "Reps", exact: true }).uncheck();
  await plank.getByRole("checkbox", { name: "Weight", exact: true }).uncheck();
  await expect(plank.getByLabel("Target reps", { exact: true })).toHaveCount(0);
  await expect(
    plank.getByRole("button", { name: /More details for set/ }),
  ).toHaveCount(0);
  await plank.getByRole("button", { name: "Add set", exact: true }).click();
  const rows = plank.locator(".fitness-workout-set-list > [data-reorder-item]");
  await expect(
    rows.nth(1).getByLabel("Target duration (seconds)", { exact: true }),
  ).toHaveValue("45");
  await rows
    .first()
    .getByRole("button", {
      name: "Edit rest after set 1: Add rest",
      exact: true,
    })
    .click();
  const restInput = rows.first().getByLabel("Rest (seconds)", { exact: true });
  await expect(restInput).toBeFocused();
  expect((await restInput.boundingBox())!.width).toBeLessThanOrEqual(70);
  await expect(
    rows.first().getByRole("button", { name: "Done", exact: true }),
  ).toHaveCount(0);
  await rows.first().getByLabel("Rest (seconds)", { exact: true }).fill("90");
  await rows
    .first()
    .getByLabel("Rest (seconds)", { exact: true })
    .press("Enter");
  await expect(
    rows.first().getByRole("button", {
      name: "Edit rest after set 1: Rest 1m 30s",
      exact: true,
    }),
  ).toBeFocused();
  await expect(rows.nth(1).locator(".fitness-rest-between-sets")).toHaveCount(
    0,
  );

  await expect(
    rows.nth(1).getByLabel("Rest (seconds)", { exact: true }),
  ).toHaveCount(0);
  await rows
    .first()
    .getByRole("button", { name: /Edit rest after set 1:/ })
    .click();
  await restInput.fill("0");
  await rows
    .nth(1)
    .getByLabel("Target duration (seconds)", { exact: true })
    .click();
  await expect(
    rows.first().getByRole("button", {
      name: "Edit rest after set 1: No rest",
      exact: true,
    }),
  ).toBeVisible();
  await rows
    .first()
    .getByRole("button", { name: /Edit rest after set 1:/ })
    .click();
  await restInput.fill("90");
  await page.screenshot({
    path: testInfo.outputPath("compact-rest-editor.png"),
    fullPage: false,
  });
  await restInput.press("Enter");
  await plank.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath("exercise-specific-sets.png"),
    fullPage: true,
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await workout
    .getByRole("button", { name: "Save workout", exact: true })
    .click();
  await expect(page).toHaveURL(/\/fitness$/);
  const plan = (await (await page.request.get("/api/v1/strength-plans")).json())
    .items[0];
  expect(
    plan.exercises.map((e: { loggingType: string }) => e.loggingType),
  ).toEqual(["duration", "reps_load", "reps", "duration_load"]);
  expect(plan.exercises[0].sets[0]).toMatchObject({
    targetReps: 3,
    targetWeightKg: 5,
    targetDurationSeconds: 45,
    restSeconds: 90,
  });
  const savedCard = workout.locator(".fitness-workout-card").filter({
    has: page.getByRole("heading", { name: "Mixed tracking", exact: true }),
  });
  await savedCard
    .getByRole("button", { name: "Start workout", exact: true })
    .click();
  await expect(page).toHaveURL(/\/fitness\/session\//);
  const sessionCards = workout.locator(
    ".fitness-workout-exercise-list > section",
  );
  const sessionPlank = sessionCards.first();
  await expect(
    sessionPlank.getByLabel("Actual reps", { exact: true }).first(),
  ).toBeHidden();
  await expect(
    sessionPlank
      .getByLabel("Actual duration (seconds)", { exact: true })
      .first(),
  ).toBeVisible();
  await sessionPlank
    .getByLabel("Actual duration (seconds)", { exact: true })
    .first()
    .fill("42");
  await expect(page.locator(".fitness-save-state")).toHaveText("Saved");
  await sessionPlank
    .getByRole("group", { name: "Set 1", exact: true })
    .getByLabel("Completed", { exact: true })
    .check();
  await expect(page.getByRole("timer", { name: "Rest timer" })).toBeVisible();
  await sessionPlank
    .locator(".fitness-set-targets")
    .first()
    .locator("summary")
    .click();
  await expect(
    sessionPlank.getByLabel("Target reps", { exact: true }),
  ).toHaveCount(0);
  await expect(
    sessionPlank.getByLabel("Actual reps", { exact: true }),
  ).toHaveCount(0);
  await sessionPlank
    .getByRole("button", { name: /Configure measurements for/ })
    .click();
  await sessionPlank
    .getByRole("checkbox", { name: "Reps", exact: true })
    .check();
  await sessionPlank
    .getByRole("checkbox", { name: "Weight", exact: true })
    .check();
  await expect(
    sessionPlank.getByLabel("Target reps", { exact: true }).first(),
  ).toHaveValue("3");
  await expect(
    sessionPlank.getByLabel("Target weight (kg)", { exact: true }).first(),
  ).toHaveValue("5");
  await expect(page.locator(".fitness-save-state")).toHaveText("Saved");
  expect(
    (
      await page.request.put(`/api/v1/exercises/${custom.id}`, {
        headers: headers(custom.version),
        data: { name: custom.name, loggingType: "reps" },
      })
    ).status(),
  ).toBe(200);
  const session = await (
    await page.request.get(
      `/api/v1/strength-workouts/${page.url().split("/").at(-1)}`,
    )
  ).json();
  expect(session.exercises[3].loggingType).toBe("duration_load");
  expect(session.exercises[0].sets[0]).toMatchObject({
    durationSeconds: 42,
    targetReps: 3,
    targetWeightKg: 5,
    completed: true,
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
