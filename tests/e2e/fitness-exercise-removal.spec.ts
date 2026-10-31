import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.use({ reducedMotion: "reduce", actionTimeout: 10000 });

test("exercise removal undo restores the right occurrence and preserves other edits", async ({
  page,
}, info) => {
  const post = async (path: string, data: object) => {
    const response = await page.request.post(path, {
      headers: {
        Origin: "http://localhost:3100",
        "Idempotency-Key": randomUUID(),
      },
      data,
    });
    expect(response.ok()).toBe(true);
    return response.json();
  };
  await post("/api/__test/register", {
    name: "Removal tester",
    email: `remove-${randomUUID()}@example.com`,
    password: "Synthetic-removal-password-123",
  });
  const exercise = await post("/api/v1/exercises", {
    name: "Squat",
    loggingType: "reps_load",
  });
  const other = await post("/api/v1/exercises", {
    name: "Row",
    loggingType: "reps_load",
  });
  const plan = await post("/api/v1/strength-plans", {
    title: "Undo workout",
    exercises: [
      {
        exerciseId: exercise.id,
        sets: [{ targetReps: 8, targetWeightKg: 20 }],
      },
      {
        exerciseId: exercise.id,
        notes: "Keep my tempo notes",
        intentTags: ["Technique"],
        sets: [
          { targetReps: 12, targetWeightKg: 25, restSeconds: 90 },
          { targetReps: 12, targetWeightKg: 25, restSeconds: 90 },
          { targetReps: 12, targetWeightKg: 25 },
        ],
      },
      { exerciseId: other.id, sets: [{ targetReps: 6 }] },
    ],
  });
  await page.goto(`/fitness/workout/${plan.id}`);
  const workspace = page.getByRole("region", {
    name: "Workout workspace",
    exact: true,
  });
  const second = workspace.getByRole("region", {
    name: "Squat exercise 2",
    exact: true,
  });
  await expect(second).toBeVisible();
  await page.clock.install({ time: new Date() });
  await second
    .getByRole("button", { name: "Remove Squat exercise", exact: true })
    .click();
  await expect(second).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const toast = page.locator(".app-toast");
  await expect(toast).toContainText("Squat removed from workout.");
  const undo = toast.getByRole("button", { name: "Undo", exact: true });
  await undo.focus();
  await page.clock.runFor(9000);
  await expect(undo).toBeVisible();
  const first = workspace.getByRole("region", {
    name: "Squat exercise 1",
    exact: true,
  });
  await first
    .getByRole("button", { name: "Expand Squat exercise", exact: true })
    .click();
  await first.getByLabel("Target reps", { exact: true }).fill("9");
  await undo.click();
  await expect(second).toBeFocused();
  await expect(second.getByLabel("Sets", { exact: true })).toHaveValue("3");
  await expect(second.getByLabel("Target reps", { exact: true })).toHaveValue(
    "12",
  );
  await expect(
    second.getByLabel("Target weight (kg)", { exact: true }),
  ).toHaveValue("25");
  await expect(
    second.getByText("Keep my tempo notes", { exact: true }),
  ).toBeVisible();
  await expect(first.getByLabel("Target reps", { exact: true })).toHaveValue(
    "9",
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: info.outputPath("restored-exercise.png") });
  await workspace
    .getByRole("button", { name: "Save workout", exact: true })
    .click();
  await expect(page).toHaveURL(/\/fitness$/);
  const saved = await (
    await page.request.get(`/api/v1/strength-plans/${plan.id}`)
  ).json();
  expect(saved.exercises).toHaveLength(3);
  expect(saved.exercises[0].sets[0].targetReps).toBe(9);
  expect(saved.exercises[1]).toEqual(plan.exercises[1]);
  expect(saved.exercises[2]).toEqual(plan.exercises[2]);

  // Repeated removals offer Undo for the most recent entry only.
  await page.goto(`/fitness/workout/${plan.id}`);
  await second
    .getByRole("button", { name: "Remove Squat exercise", exact: true })
    .click();
  await workspace
    .getByRole("region", { name: "Row exercise 2", exact: true })
    .getByRole("button", { name: "Remove Row exercise", exact: true })
    .click();
  await expect(toast).toContainText("Row removed from workout.");
  await undo.click();
  await expect(
    workspace.getByRole("region", { name: "Row exercise 2", exact: true }),
  ).toBeFocused();
  await expect(second).toHaveCount(0);
  await workspace
    .getByRole("region", { name: "Row exercise 2", exact: true })
    .getByRole("button", { name: "Remove Row exercise", exact: true })
    .click();
  await workspace
    .getByRole("button", { name: "Remove Squat exercise", exact: true })
    .click();
  await expect(
    workspace.getByRole("region", { name: /exercise \d/ }),
  ).toHaveCount(0);
  await undo.click();
  await expect(
    workspace.getByRole("region", { name: "Squat exercise 1", exact: true }),
  ).toBeFocused();
});
