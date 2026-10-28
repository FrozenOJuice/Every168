import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.use({ reducedMotion: "reduce", actionTimeout: 10000 });

test("set Undo restores custom values and preserves subsequent edits", async ({
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
  await post("/api/auth/sign-up/email", {
    name: "Set removal tester",
    email: `set-remove-${randomUUID()}@example.com`,
    password: "Synthetic-removal-password-123",
  });
  const exercise = await post("/api/v1/exercises", {
    name: "Squat",
    loggingType: "reps_load",
  });
  const plan = await post("/api/v1/strength-plans", {
    title: "Set Undo workout",
    exercises: [
      {
        exerciseId: exercise.id,
        notes: "Retain notes",
        sets: [
          { targetReps: 8, targetWeightKg: 20, restSeconds: 60 },
          {
            targetReps: 12,
            targetWeightKg: 25,
            targetDurationSeconds: 45,
            measurementOverride: "reps_duration",
            restSeconds: 90,
          },
          { targetReps: 6, targetWeightKg: 30 },
        ],
      },
    ],
  });
  await page.goto(`/fitness/workout/${plan.id}`);
  const card = page.getByRole("region", {
    name: "Squat exercise 1",
    exact: true,
  });
  await card
    .getByRole("button", { name: "Expand Squat exercise", exact: true })
    .click();
  const sets = card.getByRole("group", { name: /^Set \d+$/ });
  await card.getByRole("button", { name: "Remove set 2", exact: true }).click();
  const toast = page.locator(".app-toast");
  await expect(toast).toContainText("Set 2 removed from Squat.");
  await expect(sets).toHaveCount(2);
  await sets.nth(0).getByLabel("Target reps", { exact: true }).fill("9");
  await toast.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(sets).toHaveCount(3);
  await expect(
    sets.nth(1).getByLabel("Target reps", { exact: true }),
  ).toBeFocused();
  await expect(
    sets.nth(1).getByLabel("Target reps", { exact: true }),
  ).toHaveValue("12");
  await expect(
    sets.nth(1).getByLabel("Target duration (seconds)", { exact: true }),
  ).toHaveValue("45");
  await expect(
    sets.nth(0).getByLabel("Target reps", { exact: true }),
  ).toHaveValue("9");
  await expect(
    sets
      .nth(1)
      .getByRole("button", { name: "Measurements for set 2", exact: true }),
  ).toHaveAttribute("data-custom", "true");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: info.outputPath("restored-set.png") });
  await page.getByRole("button", { name: "Save workout", exact: true }).click();
  await expect(page).toHaveURL(/\/fitness$/);
  const saved = await (
    await page.request.get(`/api/v1/strength-plans/${plan.id}`)
  ).json();
  expect(saved.exercises[0].sets[0].targetReps).toBe(9);
  expect(saved.exercises[0].sets.slice(1)).toEqual(
    plan.exercises[0].sets.slice(1),
  );
  expect(saved.exercises[0].notes).toBe("Retain notes");

  // Only the latest removal is restored, including when one set remains.
  await page.goto(`/fitness/workout/${plan.id}`);
  await card
    .getByRole("button", { name: "Expand Squat exercise", exact: true })
    .click();
  await card.getByRole("button", { name: "Remove set 2", exact: true }).click();
  await card.getByRole("button", { name: "Remove set 2", exact: true }).click();
  await expect(sets).toHaveCount(1);
  await expect(
    card.getByRole("button", { name: "Remove set 1", exact: true }),
  ).toBeDisabled();
  await toast.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(sets).toHaveCount(2);
  await expect(
    sets.nth(1).getByLabel("Target reps", { exact: true }),
  ).toHaveValue("6");
  await expect(
    sets.nth(1).getByLabel("Target reps", { exact: true }),
  ).toBeFocused();
});
