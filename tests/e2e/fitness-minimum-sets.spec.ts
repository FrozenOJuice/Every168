import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("exercise editors keep one editable set through removal, mode changes and recovery", async ({
  page,
}) => {
  const write = async (path: string, data: object) => {
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
  await write("/api/auth/sign-up/email", {
    name: "Minimum sets",
    email: `minimum-${randomUUID()}@example.com`,
    password: "Synthetic-minimum-password-123",
  });
  const exercise = await write("/api/v1/exercises", {
    name: "Minimum practice",
  });
  const plan = await write("/api/v1/strength-plans", {
    title: "Minimum practice",
    isDraft: true,
    exercises: [{ exerciseId: exercise.id, sets: [] }],
  });
  await page.goto(`/fitness/workout/${plan.id}`);
  await page
    .getByRole("button", {
      name: "Expand Minimum practice exercise",
      exact: true,
    })
    .click();
  const workout = page.getByRole("region", {
    name: "Workout workspace",
    includeHidden: true,
  });
  const count = workout.getByLabel("Sets", { exact: true });
  await expect(count).toHaveValue("1");
  await expect(
    workout.getByLabel("Target reps", { exact: true }),
  ).toBeEnabled();
  await workout.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(/\/fitness$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto(`/fitness/workout/${plan.id}`);
  await page
    .getByRole("button", {
      name: "Expand Minimum practice exercise",
      exact: true,
    })
    .click();
  await expect(count).toHaveValue("1");
  await workout
    .getByRole("button", { name: "Toggle workout notes", exact: true })
    .click();
  await workout
    .getByLabel("Workout notes", { exact: true })
    .fill("Keep these recovered notes");
  await workout.getByLabel("Target reps", { exact: true }).fill("12");
  await page.evaluate((id) => {
    const key = Object.keys(sessionStorage).find(
      (key) =>
        key.startsWith("168hours:workout-builder:") && key.endsWith(`:${id}`),
    );
    if (!key) throw new Error("Expected a workout recovery draft");
    const stored = JSON.parse(sessionStorage.getItem(key)!);
    stored.draft.exercises[0].sets = [];
    sessionStorage.setItem(key, JSON.stringify(stored));
  }, plan.id);
  await page.reload();
  await page
    .getByRole("button", {
      name: "Expand Minimum practice exercise",
      exact: true,
    })
    .click();
  await expect(count).toHaveValue("1");
  await expect(
    workout.getByLabel("Workout notes", { exact: true }),
  ).toHaveValue("Keep these recovered notes");
  await expect(workout.getByLabel("Target reps", { exact: true })).toHaveValue(
    "",
  );
  await workout.getByLabel("Target reps", { exact: true }).fill("12");
  await workout.getByLabel("Target load (kg)", { exact: true }).fill("100");
  await workout
    .getByRole("button", { name: "Advanced editor", exact: true })
    .click();
  const remove = workout.getByRole("button", {
    name: "Remove set 1",
    exact: true,
  });
  await expect(remove).toBeDisabled();
  await expect(remove).toHaveAccessibleDescription("Keep at least one set");
  await workout.getByRole("button", { name: "Add set", exact: true }).click();
  await expect(remove).toBeEnabled();
  await expect(
    workout.getByRole("button", { name: "Remove set 2", exact: true }),
  ).toBeEnabled();
  await workout.getByLabel("Target reps", { exact: true }).nth(1).fill("8");
  await remove.click();
  await expect(
    workout.locator(".fitness-workout-set-list > .fitness-workout-set"),
  ).toHaveCount(1);
  await expect(remove).toBeDisabled();
  await workout
    .getByRole("button", { name: "Reset to basic", exact: true })
    .click();
  await expect(count).toHaveValue("1");
  await expect(
    workout.getByLabel("Target reps", { exact: true }),
  ).toBeEnabled();
  await expect(workout.getByLabel("Target reps", { exact: true })).toHaveValue(
    "8",
  );
  await expect(
    workout.getByLabel("Target load (kg)", { exact: true }),
  ).toHaveValue("100");
  await workout
    .getByRole("button", { name: "Advanced editor", exact: true })
    .click();
  await expect(remove).toBeDisabled();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await workout
    .getByRole("button", { name: "Save workout", exact: true })
    .click();
  await expect(page).toHaveURL(/\/fitness$/);
  const saved = await (
    await page.request.get(`/api/v1/strength-plans/${plan.id}`)
  ).json();
  expect(saved.notes).toBe("Keep these recovered notes");
  expect(saved.exercises[0].sets).toHaveLength(1);
  expect(saved.exercises[0].sets[0]).toMatchObject({
    targetReps: 8,
    targetWeightKg: 100,
  });
  await page
    .locator(".fitness-workout-card")
    .filter({ hasText: "Minimum practice" })
    .getByRole("button", { name: "Start workout", exact: true })
    .click();
  await page.getByRole("button", { name: "Edit workout", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Expand Minimum practice exercise",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Advanced editor", exact: true })
    .click();
  await expect(remove).toBeDisabled();
  await expect(
    workout.getByRole("button", {
      name: "Remove Minimum practice exercise",
      exact: true,
    }),
  ).toBeEnabled();
});
