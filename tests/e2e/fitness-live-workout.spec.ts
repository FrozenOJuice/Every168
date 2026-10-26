import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("choose and reorder live exercises, confirm targets, adjust results and recover", async ({
  page,
}, testInfo) => {
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
  await write("/api/auth/sign-up/email", {
    name: "Live training",
    email: `live-${randomUUID()}@example.com`,
    password: "Synthetic-live-password-123",
  });
  const bench = await write("/api/v1/exercises", { name: "Bench press" });
  const intervals = await write("/api/v1/exercises", {
    name: "Mixed intervals",
  });
  const row = await write("/api/v1/exercises", { name: "Cable row" });
  const plan = await write("/api/v1/strength-plans", {
    title: "Afternoon training",
    isDraft: false,
    exercises: [
      {
        exerciseId: row.id,
        loggingType: "reps_load",
        sets: Array.from({ length: 3 }, () => ({
          targetReps: 12,
          targetWeightKg: 20,
        })),
      },
      {
        exerciseId: bench.id,
        loggingType: "reps_load",
        notes: "Keep a steady tempo.",
        sets: [
          { targetReps: 12, targetWeightKg: 40, restSeconds: 90 },
          {
            measurementOverride: "duration",
            targetDurationSeconds: 30,
            targetWeightKg: 99,
            restSeconds: 0,
          },
          { targetReps: 8, targetWeightKg: 40 },
        ],
      },
      {
        exerciseId: intervals.id,
        loggingType: "reps_distance_laps_duration_load",
        sets: [
          {
            targetReps: 10,
            targetWeightKg: 0,
            targetDurationSeconds: 60,
            targetDistanceMeters: 1000,
            targetLaps: 2,
          },
        ],
      },
    ],
  });
  const session = await write(
    `/api/v1/strength-plans/${plan.id}/begin`,
    {
      startedAt: new Date(Date.now() - 3600000).toISOString(),
    },
    plan.version,
  );
  const read = async () =>
    (await page.request.get(`/api/v1/strength-workouts/${session.id}`)).json();
  const saved = async () =>
    expect(page.locator(".fitness-save-state")).toHaveText("Saved");
  await page.goto(`/fitness/session/${session.id}`);
  const cards = page.locator(".fitness-live-exercise-list > section");
  const rowCard = cards.filter({
    has: page.getByRole("heading", { name: "Cable row", exact: true }),
  });
  const benchCard = cards.filter({
    has: page.getByRole("heading", { name: "Bench press", exact: true }),
  });
  const intervalCard = cards.filter({
    has: page.getByRole("heading", { name: "Mixed intervals", exact: true }),
  });
  await expect(cards).toHaveCount(3);
  await expect(rowCard.locator(".fitness-exercise-target-summary")).toHaveText(
    "3×12 | 20 kg",
  );
  await expect(
    page.getByRole("region", { name: "Current set", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath("live-exercise-list.png"),
    fullPage: true,
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  // Choose the second exercise first without changing the stored order.
  await benchCard
    .getByRole("button", { name: "Expand Bench press exercise" })
    .click();
  let persisted = await read();
  expect(persisted.exercises[1].sets[0]).toMatchObject({
    reps: null,
    weightKg: null,
    completed: false,
  });
  const benchSet = benchCard.getByRole("region", {
    name: "Current set",
    exact: true,
  });
  await expect(benchSet.getByRole("spinbutton")).toHaveCount(0);
  await expect(benchCard.locator(".fitness-live-stack-row")).toHaveCount(3);
  await expect(
    benchCard.locator('.fitness-live-stack-row[data-state="upcoming"]'),
  ).toHaveCount(2);
  await expect(
    benchCard.getByRole("button", { name: /Set [23]: unfinished/ }),
  ).toHaveCount(0);

  await expect(benchSet.locator(".fitness-live-results")).toContainText("40");
  await expect(
    benchSet.getByRole("button", { name: "Complete set", exact: true }),
  ).toBeEnabled();
  await benchCard
    .locator(".fitness-exercise-body")
    .evaluate((element) =>
      Promise.all(
        element.getAnimations().map((animation) => animation.finished),
      ),
    );
  const activeHeight = await benchSet.evaluate(
    (element) => element.getBoundingClientRect().height,
  );
  expect(activeHeight).toBeLessThan(
    testInfo.project.name === "desktop" ? 90 : 160,
  );
  await expect(benchCard.locator(".fitness-rest-between-sets")).toHaveCount(2);
  await benchCard
    .getByRole("button", {
      name: "Edit rest after set 1: Rest 1m 30s",
      exact: true,
    })
    .click();
  await benchCard
    .getByRole("textbox", { name: "Rest minutes", exact: true })
    .fill("2");
  await benchCard
    .getByRole("textbox", { name: "Rest seconds", exact: true })
    .fill("10");
  await benchCard
    .getByRole("textbox", { name: "Rest seconds", exact: true })
    .press("Enter");
  await saved();
  await expect(
    benchCard.getByRole("button", {
      name: "Edit rest after set 1: Rest 2m 10s",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("live-expanded.png"),
    fullPage: true,
  });
  await benchSet
    .getByRole("button", { name: "Complete set", exact: true })
    .click();
  await saved();
  await expect(
    benchSet.getByRole("heading", { name: "Set 2 of 3" }),
  ).toBeVisible();
  await expect(page.getByRole("timer", { name: "Rest timer" })).toBeVisible();
  // Moving a live exercise keeps its active set and saved results attached.
  const reorder = benchCard.getByRole("button", { name: /Reorder exercise/ });
  await reorder.focus();
  await reorder.press("ArrowUp");
  await saved();
  await expect(cards.first()).toHaveAccessibleName("Bench press exercise 1");
  await expect(
    benchSet.getByRole("heading", { name: "Set 2 of 3" }),
  ).toBeVisible();
  persisted = await read();
  expect(persisted.exercises[0].exerciseId).toBe(bench.id);
  expect(persisted.exercises[0].sets[0]).toMatchObject({
    completed: true,
    reps: 12,
    weightKg: 40,
  });
  if (testInfo.project.name === "desktop") {
    await benchCard
      .getByRole("button", { name: "Collapse Bench press exercise" })
      .click();
    await benchCard
      .locator(".fitness-exercise-body")
      .evaluate((element) =>
        Promise.all(
          element.getAnimations().map((animation) => animation.finished),
        ),
      );
    const grip = await reorder.boundingBox();
    const destination = await intervalCard.boundingBox();
    if (!grip || !destination)
      throw new Error("Expected visible reorder handles");
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      grip.x + grip.width / 2,
      destination.y + destination.height / 2,
      { steps: 12 },
    );
    await page.mouse.up();
    await saved();
    await expect(cards.last()).toHaveAccessibleName("Bench press exercise 3");
    await reorder.focus();
    await reorder.press("ArrowUp");
    await saved();
    await reorder.press("ArrowUp");
    await saved();
    await benchCard
      .getByRole("button", { name: "Expand Bench press exercise" })
      .click();
    await expect(
      benchSet.getByRole("heading", { name: "Set 2 of 3" }),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "Dismiss timer" }).click();
  await benchSet
    .getByRole("button", { name: "Edit results", exact: true })
    .click();
  await saved();
  await expect(benchSet.getByLabel("Actual duration (seconds)")).toHaveValue(
    "30",
  );
  await expect(benchSet.getByRole("spinbutton")).toHaveCount(2);
  await benchSet.getByLabel("Actual duration (seconds)").fill("25");
  await page.reload();
  await benchCard
    .getByRole("button", { name: "Expand Bench press exercise" })
    .click();
  await expect(benchSet.locator(".fitness-live-results")).toContainText("25s");
  await saved();
  const keys: string[] = [];
  let lost = false;
  await page.route(
    `**/api/v1/strength-workouts/${session.id}`,
    async (route) => {
      if (route.request().method() === "PUT") {
        keys.push(route.request().headers()["idempotency-key"]!);
        if (!lost) {
          lost = true;
          expect((await route.fetch()).status()).toBe(200);
          await route.abort("failed");
          return;
        }
      }
      await route.continue();
    },
  );
  await benchSet
    .getByRole("button", { name: "Complete set", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Retry same change", exact: true })
    .click();
  await saved();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  await page.unroute(`**/api/v1/strength-workouts/${session.id}`);
  await expect(page.getByRole("timer")).toHaveCount(0);
  await benchSet.getByRole("button", { name: "Skip set", exact: true }).click();
  await saved();
  await expect(benchCard.getByText(/2 completed · 1 skipped/)).toBeVisible();
  await expect(
    rowCard.getByRole("button", { name: "Expand Cable row exercise" }),
  ).toBeVisible();
  // Jump to another exercise; its planned values need no typing.
  await intervalCard
    .getByRole("button", { name: "Expand Mixed intervals exercise" })
    .click();
  const intervalSet = intervalCard.getByRole("region", {
    name: "Current set",
    exact: true,
  });
  await expect(intervalSet.locator(".fitness-live-results > div")).toHaveCount(
    5,
  );
  await expect(intervalSet.getByRole("spinbutton")).toHaveCount(0);
  await intervalSet
    .getByRole("button", { name: "Complete set", exact: true })
    .click();
  await saved();
  // Correct a completed set; an explicitly cleared measurement stays unknown.
  await benchCard
    .getByRole("button", { name: "Undo completion of set 1", exact: true })
    .click();
  await benchSet
    .getByRole("button", { name: "Edit results", exact: true })
    .click();
  await saved();
  await benchSet.getByLabel("Actual load (kg)").fill("0");
  await benchSet.getByLabel("Actual reps").fill("");
  await saved();
  await benchSet
    .getByRole("button", { name: "Done editing", exact: true })
    .click();
  await expect(benchSet.locator(".fitness-live-results dd")).toHaveText([
    "—",
    "0",
  ]);
  await benchSet
    .getByRole("button", { name: "Complete set", exact: true })
    .click();
  await saved();
  // The remaining exercise remains independently selectable and unfinished.
  await rowCard
    .getByRole("button", { name: "Expand Cable row exercise" })
    .click();
  await rowCard
    .getByRole("button", { name: "Complete set", exact: true })
    .click();
  await saved();
  await expect(
    rowCard.getByRole("heading", { name: "Set 2 of 3" }),
  ).toBeVisible();
  await benchCard
    .getByRole("button", { name: "Collapse Bench press exercise" })
    .click();
  await intervalCard
    .getByRole("button", { name: "Collapse Mixed intervals exercise" })
    .click();
  await page.screenshot({
    path: testInfo.outputPath("live-progress.png"),
    fullPage: true,
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Finish workout", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Finish workout", exact: true })
    .click();
  await saved();
  await expect(page.getByText("Workout review", { exact: true })).toBeVisible();
  const result = await read();
  expect(result.endedAt).not.toBeNull();
  expect(result.exercises[0].sets[0]).toMatchObject({
    completed: true,
    reps: null,
    weightKg: 0,
    targetReps: 12,
    targetWeightKg: 40,
  });
  expect(result.exercises[0].sets[1]).toMatchObject({
    completed: true,
    durationSeconds: 25,
    weightKg: null,
    targetWeightKg: 99,
    measurementOverride: "duration",
  });
  expect(result.exercises[0].sets[2]).toMatchObject({
    skipped: true,
    completed: false,
    reps: null,
    weightKg: null,
  });
  expect(result.exercises[1].sets[1]).toMatchObject({
    completed: false,
    reps: null,
    weightKg: null,
  });
  expect(result.exercises[2].sets[0]).toMatchObject({
    completed: true,
    reps: 10,
    weightKg: 0,
    durationSeconds: 60,
    distanceMeters: 1000,
    laps: 2,
  });
  const source = await (
    await page.request.get(`/api/v1/strength-plans/${plan.id}`)
  ).json();
  expect(source.exercises[0].exerciseId).toBe(row.id);
  expect(source.exercises[1].sets).toHaveLength(3);
});

test("both skipped sets can be completed later and disabled actions use a normal cursor", async ({
  page,
}) => {
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
  await write("/api/auth/sign-up/email", {
    name: "Skipped sets",
    email: `skipped-${randomUUID()}@example.com`,
    password: "Synthetic-skipped-password-123",
  });
  const exercise = await write("/api/v1/exercises", {
    name: "Skipped practice",
  });
  const plan = await write("/api/v1/strength-plans", {
    title: "Skipped practice",
    isDraft: false,
    exercises: [
      {
        exerciseId: exercise.id,
        sets: Array.from({ length: 3 }, () => ({
          targetReps: 12,
          targetWeightKg: 20,
        })),
      },
    ],
  });
  const session = await write(
    `/api/v1/strength-plans/${plan.id}/begin`,
    { startedAt: new Date().toISOString() },
    plan.version,
  );
  const read = async () =>
    (await page.request.get(`/api/v1/strength-workouts/${session.id}`)).json();
  const saved = async () =>
    expect(page.locator(".fitness-save-state")).toHaveText("Saved");
  await page.goto(`/fitness/session/${session.id}`);
  await page
    .getByRole("button", { name: "Expand Skipped practice exercise" })
    .click();
  const current = page.getByRole("region", {
    name: "Current set",
    exact: true,
  });
  for (let i = 0; i < 2; i++) {
    await current
      .getByRole("button", { name: "Skip set", exact: true })
      .click();
    await saved();
  }
  const skipped = await read();
  expect(skipped.exercises[0].sets.slice(0, 2)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        skipped: true,
        completed: false,
        reps: null,
        weightKg: null,
      }),
    ]),
  );
  await current
    .getByRole("button", { name: "Complete set", exact: true })
    .click();
  await saved();
  await page.reload();
  await page
    .getByRole("button", { name: "Expand Skipped practice exercise" })
    .click();
  for (let i = 1; i <= 2; i++) {
    await page
      .getByRole("button", { name: `Undo skip of set ${i}`, exact: true })
      .click();
    await saved();
  }
  await expect(
    current.getByRole("heading", { name: "Set 1 of 3" }),
  ).toBeVisible();
  const undone = await read();
  expect(undone.exercises[0].sets[2]).toMatchObject({
    completed: true,
    reps: 12,
    weightKg: 20,
  });
  for (let i = 1; i <= 2; i++) {
    await expect(
      current.getByRole("heading", { name: `Set ${i} of 3` }),
    ).toBeVisible();
    const complete = current.getByRole("button", {
      name: "Complete set",
      exact: true,
    });
    await expect(complete).toBeEnabled();
    await expect(current.locator(".fitness-live-results dd")).toHaveText([
      "12",
      "20",
    ]);
    await complete.click();
    await saved();
  }
  const completed = await read();
  for (const set of completed.exercises[0].sets.slice(0, 2)) {
    expect(set).toMatchObject({
      skipped: false,
      completed: true,
      reps: 12,
      weightKg: 20,
    });
  }
  await expect(current).toHaveCount(0);
  await page
    .getByRole("button", { name: "Undo completion of set 3", exact: true })
    .click();
  await saved();
  await current
    .getByRole("button", { name: "Edit results", exact: true })
    .click();
  await saved();
  await current.getByLabel("Actual reps", { exact: true }).fill("");
  await current.getByLabel("Actual load (kg)", { exact: true }).fill("");
  await saved();
  const unavailable = current.getByRole("button", {
    name: "Complete set",
    exact: true,
  });
  await expect(unavailable).toBeDisabled();
  await expect(unavailable).toHaveCSS("cursor", "default");
  await expect(
    current.getByRole("button", { name: "Done editing", exact: true }),
  ).toHaveCSS("cursor", "default");
});
