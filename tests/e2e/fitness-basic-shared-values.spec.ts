import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.use({ actionTimeout: 10000 });

test("Basic preserves shared rest on count changes and rounds duration display without changing saved values", async ({
  page,
}) => {
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
    name: "Basic values",
    email: `basic-values-${randomUUID()}@example.com`,
    password: "Synthetic-basic-password-123",
  });
  const press = await post("/api/v1/exercises", {
    name: "Shared press",
    loggingType: "reps_load",
  });
  const hold = await post("/api/v1/exercises", {
    name: "Shared hold",
    loggingType: "duration",
  });
  const plan = await post("/api/v1/strength-plans", {
    title: "Shared values",
    exercises: [
      {
        exerciseId: press.id,
        loggingType: "reps_load",
        sets: [
          { targetReps: 12, targetWeightKg: 50, restSeconds: 90 },
          { targetReps: 12, targetWeightKg: 50, restSeconds: 90 },
          { targetReps: 12, targetWeightKg: 50 },
        ],
      },
      {
        exerciseId: hold.id,
        loggingType: "duration",
        sets: [{ targetDurationSeconds: 100 }],
      },
    ],
  });
  await page.goto(`/fitness/workout/${plan.id}`);
  const workout = page.getByRole("region", {
    name: "Workout workspace",
    includeHidden: true,
  });
  const pressCard = workout.getByRole("region", {
    name: "Shared press exercise 1",
    exact: true,
  });
  await pressCard
    .getByRole("button", { name: "Expand Shared press exercise", exact: true })
    .click();
  for (const count of [4, 2, 1, 5, 3]) {
    const input = pressCard.getByLabel("Sets", { exact: true });
    await input.fill(String(count));
    await input.press("Tab");
    await expect(input).toHaveValue(String(count));
    await expect(
      pressCard.getByRole("button", { name: "Advanced editor", exact: true }),
    ).toHaveAttribute("aria-expanded", "false");
    const rest = pressCard.getByRole("button", {
      name: "Rest between sets",
      exact: true,
    });
    if (count === 1) await expect(rest).toBeDisabled();
    else await expect(rest).toContainText("1m 30s");
    await expect(
      pressCard.getByLabel("Target reps", { exact: true }),
    ).toHaveValue("12");
  }
  const holdCard = workout.getByRole("region", {
    name: "Shared hold exercise 2",
    exact: true,
  });
  await holdCard
    .getByRole("button", { name: "Expand Shared hold exercise", exact: true })
    .click();
  const chooseUnit = async (label: string) => {
    await holdCard
      .getByRole("button", { name: "Target duration unit", exact: true })
      .click();
    await page
      .getByRole("listbox", { name: "Target duration unit", exact: true })
      .getByRole("option", { name: label, exact: true })
      .click();
  };
  await chooseUnit("hr");
  await expect(
    holdCard.getByLabel("Target duration (hours)", { exact: true }),
  ).toHaveValue("0.028");
  await chooseUnit("sec");
  await expect(
    holdCard.getByLabel("Target duration (seconds)", { exact: true }),
  ).toHaveValue("100");
  await chooseUnit("hr");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await workout
    .getByRole("button", { name: "Save workout", exact: true })
    .click();
  await expect(page).toHaveURL(/\/fitness$/);
  const read = async () =>
    (await page.request.get(`/api/v1/strength-plans/${plan.id}`)).json();
  const saved = await read();
  expect(
    saved.exercises[0].sets.map(
      (set: { restSeconds: number | null }) => set.restSeconds,
    ),
  ).toEqual([90, 90, null]);
  expect(saved.exercises[1].sets[0].targetDurationSeconds).toBe(100);
  await page.goto(`/fitness/workout/${plan.id}`);
  await holdCard
    .getByRole("button", { name: "Expand Shared hold exercise", exact: true })
    .click();
  await chooseUnit("hr");
  const hours = holdCard.getByLabel("Target duration (hours)", { exact: true });
  await hours.fill("0.0025");
  await expect(hours).toHaveValue("0.0025");
  await hours.press("Tab");
  await expect(hours).toHaveValue("0.0025");
  await workout
    .getByRole("button", { name: "Save workout", exact: true })
    .click();
  await expect(page).toHaveURL(/\/fitness$/);
  expect((await read()).exercises[1].sets[0].targetDurationSeconds).toBe(9);
});
