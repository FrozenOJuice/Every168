import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("builder validates fields, copies set targets and preserves collapsed cards", async ({
  page,
}, testInfo) => {
  expect(
    (
      await page.request.post("/api/__test/register", {
        headers: { Origin: "http://localhost:3100" },
        data: {
          name: "Builder member",
          email: `builder-${randomUUID()}@example.com`,
          password: "Synthetic-builder-password-123",
        },
      })
    ).status(),
  ).toBe(200);
  await page.goto("/fitness/workout/new");
  const workout = page.getByRole("region", {
    name: "Workout workspace",
    includeHidden: true,
  });
  const save = workout.getByRole("button", {
    name: "Save workout",
    exact: true,
  });
  const title = workout.getByLabel("Workout name", { exact: true });
  await save.click();
  await expect(title).toBeFocused();
  await expect(title).toHaveAttribute("aria-invalid", "true");
  await title.fill("Focused builder");
  await save.click();
  const addExercise = workout.getByRole("button", {
    name: "Add exercise",
    exact: true,
  });
  if (testInfo.project.name === "phone")
    await expect(addExercise).toBeFocused();
  else
    await expect(
      workout.locator(".fitness-builder-library-hint"),
    ).toBeFocused();
  await expect(
    workout.getByText("Add at least one exercise.", { exact: true }),
  ).toBeVisible();
  if (testInfo.project.name === "phone") await addExercise.click();
  const library = page.getByRole("complementary", {
    name: "Exercise library panel",
  });
  if (testInfo.project.name === "desktop")
    await library
      .getByRole("button", { name: "Bench press", exact: true })
      .hover();
  await library
    .getByRole("button", { name: "Add Bench press", exact: true })
    .click();
  const card = workout.getByRole("region", {
    name: "Bench press exercise 1",
    exact: true,
  });
  const rows = card.locator(".fitness-workout-set-list > [data-reorder-item]");
  const first = rows.first();
  await card
    .getByRole("button", { name: "Advanced editor", exact: true })
    .click();
  await first.getByLabel("Target reps", { exact: true }).fill("0");
  await first.getByLabel("Target weight (kg)", { exact: true }).fill("-1");
  await card
    .getByRole("button", { name: "Collapse Bench press exercise", exact: true })
    .click();
  await save.click();
  await expect(first.getByLabel("Target reps", { exact: true })).toBeFocused();
  await expect(
    first.getByLabel("Target reps", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  await expect(
    first.getByLabel("Target weight (kg)", { exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await first.getByLabel("Target reps", { exact: true }).fill("8");
  await first.getByLabel("Target weight (kg)", { exact: true }).fill("40");
  await card.getByRole("button", { name: "Add set", exact: true }).click();
  const second = rows.nth(1);
  await expect(second.getByLabel("Target reps", { exact: true })).toHaveValue(
    "8",
  );
  await expect(
    second.getByLabel("Target weight (kg)", { exact: true }),
  ).toHaveValue("40");
  await second.getByLabel("Target reps", { exact: true }).fill("10");
  await card
    .getByRole("button", { name: "Collapse Bench press exercise", exact: true })
    .click();
  await expect(second.getByLabel("Target reps", { exact: true })).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath("collapsed-workout.png") });
  await card
    .getByRole("button", { name: "Expand Bench press exercise", exact: true })
    .click();
  await expect(second.getByLabel("Target reps", { exact: true })).toHaveValue(
    "10",
  );
  await card.getByRole("button", { name: "Remove set 2", exact: true }).click();
  await expect(
    card.getByRole("button", { name: "Remove set 1", exact: true }),
  ).toBeDisabled();
  await first.getByLabel("Target reps", { exact: true }).fill("");
  await first.getByLabel("Target weight (kg)", { exact: true }).fill("");
  await save.click();
  await expect(page).toHaveURL(/\/fitness$/);
  const plans = await (await page.request.get("/api/v1/strength-plans")).json();
  expect(plans.items[0].exercises[0].sets).toEqual([
    {
      targetReps: null,
      targetWeightKg: null,
      targetDurationSeconds: null,
      targetDistanceMeters: null,
      targetLaps: null,
      restSeconds: null,
      measurementOverride: null,
    },
  ]);
});
