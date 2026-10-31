import { randomUUID } from "node:crypto";
import { expect, test, type Page, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function openExercise(scope: Page | Locator, name: string) {
  const button = scope.getByRole("button", {
    name: new RegExp(`^(Expand|Collapse) ${name} exercise$`),
  });
  await expect(button).toBeVisible();
  if ((await button.getAttribute("aria-expanded")) === "false")
    await button.click();
}

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
  await write("/api/__test/register", {
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
    "Planned: 3×12 | 20 kg",
  );
  await expect(
    page.getByRole("region", { name: "Current set", exact: true }),
  ).toHaveCount(1);
  await page.screenshot({
    path: testInfo.outputPath("live-exercise-list.png"),
    fullPage: true,
  });
  if (testInfo.project.name === "phone") {
    const assistant = await page
      .getByRole("button", { name: "Ask Assistant", exact: true })
      .boundingBox();
    expect(assistant!.y).toBeLessThan(64);
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  // Choose the second exercise first without changing the stored order.
  await openExercise(benchCard, "Bench press");
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
  await expect(benchSet.getByRole("spinbutton")).toHaveCount(2);
  await expect(benchCard.locator(".fitness-live-stack-row")).toHaveCount(3);
  await expect(
    benchCard.locator('.fitness-live-stack-row[data-state="upcoming"]'),
  ).toHaveCount(2);
  await expect(
    benchCard.getByRole("button", { name: /Set [23]: unfinished/ }),
  ).toHaveCount(0);

  await expect(benchSet.getByLabel("Actual weight (kg)")).toHaveValue("40");
  await benchSet.getByLabel("Actual weight (kg)").fill("20");
  await expect(benchSet.locator(".fitness-live-target")).toHaveText(
    "Planned: 1×12 | 40 kg",
  );
  await expect(
    benchCard.locator(".fitness-exercise-target-summary"),
  ).toContainText("Planned:");
  await expect(
    benchCard.locator(".fitness-exercise-target-summary"),
  ).toContainText("40 kg");
  await benchSet.getByLabel("Actual weight (kg)").fill("40");
  await benchSet
    .getByRole("button", { name: "Actual weight unit", exact: true })
    .click();
  await page.getByRole("option", { name: "lb", exact: true }).click();
  await expect(benchSet.getByLabel("Actual weight (lb)")).toHaveValue("88.18");
  await expect(benchSet.locator(".fitness-live-target")).toContainText(
    "88.18 lb",
  );
  await expect(
    benchCard.locator(".fitness-exercise-target-summary"),
  ).toContainText("88.18 lb");

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
    testInfo.project.name === "desktop" ? 360 : 440,
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
  await expect(
    benchCard.locator('.fitness-live-stack-row[data-state="completed"]'),
  ).toContainText("88.18 lb");

  await expect(page.getByRole("timer", { name: "Rest timer" })).toBeVisible();
  const restBeforeOtherActions = await page.evaluate(() =>
    JSON.parse(
      sessionStorage.getItem(
        Object.keys(sessionStorage).find((key) =>
          key.startsWith("168hours:rest:"),
        )!,
      )!,
    ),
  );
  const rowSet = rowCard.getByRole("region", {
    name: "Current set",
    exact: true,
  });
  await rowSet.getByRole("button", { name: "Skip set", exact: true }).click();
  await saved();
  await rowCard
    .getByRole("button", { name: "Undo skip of set 1", exact: true })
    .click();
  await saved();
  expect(
    await page.evaluate(() =>
      JSON.parse(
        sessionStorage.getItem(
          Object.keys(sessionStorage).find((key) =>
            key.startsWith("168hours:rest:"),
          )!,
        )!,
      ),
    ),
  ).toEqual(restBeforeOtherActions);

  await cards.last().scrollIntoViewIfNeeded();
  const statusBounds = await page.locator(".fitness-live-status").boundingBox();
  expect(statusBounds!.y).toBeGreaterThanOrEqual(
    testInfo.project.name === "phone" ? 64 : 0,
  );
  expect(statusBounds!.y).toBeLessThan(100);
  await page.screenshot({ path: testInfo.outputPath("live-rest-pinned.png") });
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
    await openExercise(benchCard, "Bench press");
    await expect(
      benchSet.getByRole("heading", { name: "Set 2 of 3" }),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "Skip rest" }).click();
  await saved();
  await expect(benchSet.getByLabel("Actual duration (seconds)")).toHaveValue(
    "30",
  );
  await expect(benchSet.getByRole("spinbutton")).toHaveCount(1);
  await benchSet.getByLabel("Actual duration (seconds)").fill("25");
  await page.reload();
  await openExercise(benchCard, "Bench press");
  await expect(benchSet.getByLabel("Actual duration (seconds)")).toHaveValue(
    "25",
  );
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
  await expect(
    page.locator(".fitness-live-status .fitness-session-save-feedback"),
  ).toContainText("Save not confirmed");
  await page.screenshot({ path: testInfo.outputPath("live-save-error.png") });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Retry save", exact: true }).click();
  await saved();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  await page.unroute(`**/api/v1/strength-workouts/${session.id}`);
  await expect(page.getByRole("timer", { name: "Rest timer" })).toHaveCount(0);
  await benchSet.getByRole("button", { name: "Skip set", exact: true }).click();
  await saved();
  await expect(
    benchCard.locator('.fitness-live-stack-row[data-state="skipped"] p'),
  ).toHaveCount(0);
  await expect(benchCard.getByText(/Ready for the next exercise/)).toHaveCount(
    0,
  );
  await benchCard
    .getByRole("button", { name: "Choose exercise", exact: true })
    .click();
  const choices = page.getByRole("menu", {
    name: "Choose next exercise",
    exact: true,
  });
  await expect(choices.getByRole("menuitem")).toHaveCount(2);
  const chooseTrigger = benchCard.getByRole("button", {
    name: "Choose exercise",
    exact: true,
  });
  const nextBounds = await benchCard
    .getByRole("button", { name: "Next exercise: Cable row", exact: true })
    .boundingBox();
  const chooseBounds = await chooseTrigger.boundingBox();
  if (testInfo.project.name === "phone")
    expect(nextBounds!.y).toBeGreaterThan(chooseBounds!.y);
  else {
    expect(nextBounds!.x).toBeGreaterThan(chooseBounds!.x);
    expect(nextBounds!.y).toBeCloseTo(chooseBounds!.y, 0);
  }
  await chooseTrigger.click();
  await expect(choices).toHaveCount(0);
  await expect(chooseTrigger).toHaveAttribute("aria-expanded", "false");
  await chooseTrigger.click();
  await expect(choices.getByRole("menuitem")).toHaveCount(2);
  await expect(
    choices.getByRole("menuitem", {
      name: "Cable row Planned: 3×12 | 20 kg",
      exact: true,
    }),
  ).toBeVisible();
  await choices
    .getByRole("menuitem", { name: /^Mixed intervals Planned:/ })
    .focus();
  await page.keyboard.press("Escape");
  await expect(
    benchCard.getByRole("button", { name: "Choose exercise", exact: true }),
  ).toBeFocused();
  await expect(choices).toHaveCount(0);
  await benchCard
    .getByRole("button", { name: "Choose exercise", exact: true })
    .click();
  await page.screenshot({
    path: testInfo.outputPath("choose-exercise.png"),
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const orderBeforeChoosing = (await read()).exercises.map(
    (item: { id: string }) => item.id,
  );
  await choices
    .getByRole("menuitem", { name: /^Mixed intervals Planned:/ })
    .click();
  await expect(
    intervalCard.getByRole("heading", { name: "Set 1 of 1" }),
  ).toBeFocused();
  expect(
    (await read()).exercises.map((item: { id: string }) => item.id),
  ).toEqual(orderBeforeChoosing);
  await openExercise(benchCard, "Bench press");
  await expect(
    rowCard.getByRole("button", { name: "Expand Cable row exercise" }),
  ).toBeVisible();
  await benchCard
    .getByRole("button", { name: "Next exercise: Cable row", exact: true })
    .click();
  await expect(
    rowCard.getByRole("heading", { name: "Set 1 of 3" }),
  ).toBeFocused();
  await expect(
    benchCard.getByRole("button", { name: "Expand Bench press exercise" }),
  ).toBeVisible();
  await openExercise(benchCard, "Bench press");
  // Jump to another exercise; its planned values need no typing.
  await openExercise(intervalCard, "Mixed intervals");
  const intervalSet = intervalCard.getByRole("region", {
    name: "Current set",
    exact: true,
  });
  await expect(intervalSet.getByRole("spinbutton")).toHaveCount(5);

  await intervalSet
    .getByRole("button", { name: "Complete set", exact: true })
    .click();
  await saved();
  // Correct a completed set; an explicitly cleared measurement stays unknown.
  await benchCard
    .getByRole("button", { name: "Edit results of set 1", exact: true })
    .click();
  await saved();
  await benchSet.getByLabel("Actual weight (kg)").fill("0");
  await benchSet.getByLabel("Actual reps").fill("0");
  await page.reload();
  await expect(benchSet.getByLabel("Actual reps")).toHaveValue("0");
  await expect(
    benchSet.getByRole("button", { name: "Done correcting", exact: true }),
  ).toBeDisabled();
  await benchSet.getByLabel("Actual reps").fill("");
  await saved();
  await benchSet
    .getByRole("button", { name: "Done correcting", exact: true })
    .click();
  await saved();
  const corrected = (await read()).exercises.find(
    (item: { exerciseId: string }) => item.exerciseId === bench.id,
  ).sets[0];
  expect(corrected).toMatchObject({
    completed: true,
    skipped: false,
    reps: null,
    weightKg: 0,
  });
  // The remaining exercise remains independently selectable and unfinished.
  await openExercise(rowCard, "Cable row");
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
  await expect(
    page.getByRole("heading", { name: / - Summary$/, level: 1 }),
  ).toBeVisible();
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
  await write("/api/__test/register", {
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
  await openExercise(page, "Skipped practice");
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
  await openExercise(page, "Skipped practice");
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
    await expect(
      current.getByLabel("Actual reps", { exact: true }),
    ).toHaveValue("12");
    await expect(
      current.getByLabel("Actual weight (kg)", { exact: true }),
    ).toHaveValue("20");
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
  await saved();
  await current.getByLabel("Actual reps", { exact: true }).fill("");
  await current.getByLabel("Actual weight (kg)", { exact: true }).fill("");
  await saved();
  const unavailable = current.getByRole("button", {
    name: "Complete set",
    exact: true,
  });
  await expect(unavailable).toBeDisabled();
  await expect(unavailable).toHaveCSS("cursor", "default");
  let rejected = false;
  await page.route(
    `**/api/v1/strength-workouts/${session.id}`,
    async (route) => {
      if (route.request().method() === "PUT" && !rejected) {
        rejected = true;
        return route.fulfill({
          status: 422,
          contentType: "application/json",
          body: JSON.stringify({
            error: {
              code: "BUSINESS_RULE",
              message: "This change could not be saved. Please retry.",
            },
          }),
        });
      }
      return route.continue();
    },
  );
  await current.getByLabel("Actual reps", { exact: true }).fill("5");
  const feedback = page.locator(
    ".fitness-live-status .fitness-session-save-feedback",
  );
  await expect(feedback).toContainText("Changes not saved");
  const retry = page.getByRole("button", { name: "Retry save", exact: true });
  await expect(retry).toHaveCount(1);
  await expect(retry).toHaveClass(/primary/);
  await retry.click();
  await saved();
  await expect(feedback).toHaveCount(0);
  await expect(current).toBeVisible();
  expect((await read()).exercises[0].sets[2].reps).toBe(5);
});

test("follow the workout from planned targets through the next exercise to finishing", async ({
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
  await write("/api/__test/register", {
    name: "Normal workout",
    email: `normal-${randomUUID()}@example.com`,
    password: "Synthetic-normal-password-123",
  });
  const first = await write("/api/v1/exercises", { name: "First exercise" });
  const next = await write("/api/v1/exercises", { name: "Next exercise" });
  const plan = await write("/api/v1/strength-plans", {
    title: "Normal workout",
    isDraft: false,
    exercises: [first, next].map((exercise) => ({
      exerciseId: exercise.id,
      sets: [{ targetReps: 12, targetWeightKg: 50 }],
    })),
  });
  const session = await write(
    `/api/v1/strength-plans/${plan.id}/begin`,
    { startedAt: new Date().toISOString() },
    plan.version,
  );
  await page.goto(`/fitness/session/${session.id}`);
  const current = page.getByRole("region", {
    name: "Current set",
    exact: true,
  });
  const initialFinish = page
    .getByRole("group", { name: "Workout controls", exact: true })
    .getByRole("button", { name: "Finish workout", exact: true });
  await expect(initialFinish).toBeVisible();
  await expect(initialFinish).toBeDisabled();
  await expect(initialFinish).not.toHaveClass(/primary/);
  await current.getByLabel("Actual weight (kg)").fill("20");
  await expect(current.locator(".fitness-live-target")).toHaveText(
    "Planned: 1×12 | 50 kg",
  );
  await current
    .getByRole("button", { name: "Complete set", exact: true })
    .click();
  await expect(
    page.locator('.fitness-live-stack-row[data-state="completed"]'),
  ).toContainText("20 kg");
  await page.screenshot({
    path: testInfo.outputPath("exercise-handoff.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Next exercise: Next exercise", exact: true })
    .click();
  await expect(
    current.getByRole("heading", { name: "Set 1 of 1" }),
  ).toBeFocused();
  await expect(current.getByLabel("Actual weight (kg)")).toHaveValue("50");
  await current
    .getByRole("button", { name: "Complete set", exact: true })
    .click();
  await expect(
    page.getByText(/All sets handled. Finish workout below./),
  ).toHaveCount(0);
  const finish = page.getByRole("button", {
    name: "Finish workout",
    exact: true,
  });
  await expect(finish).toHaveCount(1);
  await expect(
    page
      .getByRole("group", { name: "Workout controls", exact: true })
      .getByRole("button", { name: "Finish workout", exact: true }),
  ).toBeVisible();
  await expect(finish).toHaveClass(/primary/);
  await expect(finish).toBeEnabled();
  await expect(finish).toBeFocused();
  await page
    .getByRole("button", { name: "Pause workout", exact: true })
    .click();
  const resume = page.getByRole("button", {
    name: "Resume workout",
    exact: true,
  });
  await expect(resume).not.toHaveClass(/primary/);
  await expect(finish).toHaveClass(/primary/);
  await page.screenshot({
    path: testInfo.outputPath("finish-ready-controls.png"),
  });
  await resume.click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const finishKeys: string[] = [];
  let releaseFinish!: () => void;
  const finishGate = new Promise<void>((resolve) => {
    releaseFinish = resolve;
  });
  await page.route(
    `**/api/v1/strength-workouts/${session.id}`,
    async (route) => {
      if (
        route.request().method() !== "PUT" ||
        !route.request().postDataJSON().endedAt
      )
        return route.continue();
      finishKeys.push(route.request().headers()["idempotency-key"]!);
      if (finishKeys.length === 1) {
        await finishGate;
        return route.fulfill({
          status: 422,
          contentType: "application/json",
          body: JSON.stringify({
            error: {
              code: "BUSINESS_RULE",
              message: "Could not finish this workout. Try again.",
            },
          }),
        });
      }
      if (finishKeys.length === 2) {
        expect((await route.fetch()).status()).toBe(200);
        return route.abort("failed");
      }
      return route.continue();
    },
  );
  await finish.click();
  await expect(
    page.getByRole("button", { name: "Finishing…", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("heading", { name: / - Summary$/, level: 1 }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Edit workout", exact: true }),
  ).toBeDisabled();
  releaseFinish();
  const feedback = page.locator(
    ".fitness-live-status .fitness-session-save-feedback",
  );
  await expect(feedback).toContainText("Changes not saved");
  await expect(
    page.getByRole("heading", { name: / - Summary$/, level: 1 }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Retry save", exact: true }).click();
  await expect(feedback).toContainText("Save not confirmed");
  await expect(
    page.getByRole("heading", { name: / - Summary$/, level: 1 }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Finish pending", exact: true }),
  ).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath("finish-save-error.png") });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Retry save", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: / - Summary$/, level: 1 }),
  ).toBeVisible();
  expect(finishKeys).toHaveLength(3);
  expect(finishKeys[0]).not.toBe(finishKeys[1]);
  expect(finishKeys[1]).toBe(finishKeys[2]);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".fitness-save-state")).toHaveText("Saved");
  const result = await (
    await page.request.get(`/api/v1/strength-workouts/${session.id}`)
  ).json();
  expect(result.endedAt).not.toBeNull();
  expect(result.exercises[0].sets[0]).toMatchObject({
    targetWeightKg: 50,
    weightKg: 20,
    completed: true,
  });
  expect(result.exercises[1].sets[0]).toMatchObject({
    targetWeightKg: 50,
    weightKg: 50,
    completed: true,
  });
});
