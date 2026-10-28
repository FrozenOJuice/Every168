import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("inline exercise library follows programs and preserves workout drafts", async ({
  page,
}, testInfo) => {
  const write = async (path: string, data: object, version?: number) => {
    const response = await page.request[version ? "put" : "post"](path, {
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
    name: "Connected fitness",
    email: `flow-${randomUUID()}@example.com`,
    password: "Synthetic-workout-password-123",
  });
  const exercise = await write("/api/v1/exercises", {
    name: "Recall squat",
    notes: "Move with control.",
  });
  const previous = await write("/api/v1/strength-workouts", {
    title: "Earlier workout",
    startedAt: "2026-10-12T15:00:00Z",
  });
  await write(
    `/api/v1/strength-workouts/${previous.id}`,
    {
      title: previous.title,
      startedAt: previous.startedAt,
      endedAt: "2026-10-12T16:00:00Z",
      exercises: [
        {
          exerciseId: exercise.id,
          sets: [
            { reps: 8, weightKg: 40 },
            { reps: 6, weightKg: 45 },
          ],
        },
      ],
    },
    previous.version,
  );
  await page.goto("/fitness");
  const navigation = page.getByRole("navigation", { name: "Fitness views" });
  await expect(navigation.getByRole("link")).toHaveText([
    "Training",
    "History",
  ]);
  await expect(page.locator(".fitness-exercise-panel")).toBeVisible();
  const programs = await page
    .locator(".fitness-program-overview")
    .boundingBox();
  const library = await page.locator(".fitness-exercise-panel").boundingBox();
  expect(library!.y).toBeGreaterThanOrEqual(programs!.y + programs!.height);
  await page
    .getByRole("searchbox", { name: "Find an exercise", exact: true })
    .fill("Recall");
  await page.getByRole("button", { name: "Recall squat", exact: true }).click();
  await expect(page.locator(".fitness-inline-recall")).toContainText(
    "8 reps × 40 kg",
  );
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.locator(".fitness-recall-section")).toContainText("45 kg");
  await navigation.getByRole("link", { name: "Training", exact: true }).click();
  await page.getByRole("link", { name: "Create workout", exact: true }).click();
  const workout = page.getByRole("region", {
    name: "Workout workspace",
    includeHidden: true,
  });
  await workout.getByLabel("Workout name", { exact: true }).fill("My session");
  if (testInfo.project.name === "phone")
    await expect(page.locator(".fitness-exercise-panel")).toBeHidden();
  else await expect(page.locator(".fitness-exercise-panel")).toBeVisible();
  const add = workout.getByRole("button", {
    name: "Add exercise",
    exact: true,
  });
  await add.click();
  const picker = page.locator(".fitness-library-view-builder");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".fitness-exercise-panel")).toBeVisible();
  await expect(
    picker.getByRole("searchbox", { name: "Find an exercise", exact: true }),
  ).toBeFocused();
  await picker.screenshot({ path: testInfo.outputPath("exercise-picker.png") });
  await expect(
    picker.getByRole("searchbox", { name: "Find an exercise", exact: true }),
  ).toHaveValue("Recall");
  await picker
    .getByRole("button", { name: "Recall squat", exact: true })
    .hover();
  await picker
    .getByRole("button", { name: "Add Recall squat", exact: true })
    .click();
  if (testInfo.project.name === "phone")
    await expect(page.locator(".fitness-exercise-panel")).toBeHidden();
  else await expect(page.locator(".fitness-exercise-panel")).toBeVisible();
  await expect(add).toBeFocused();
  await expect(workout.getByLabel("Workout name", { exact: true })).toHaveValue(
    "My session",
  );
  await expect(workout.locator(".fitness-inline-recall")).toContainText(
    "6 reps × 45 kg",
  );
  await workout.getByLabel("Target reps", { exact: true }).fill("8");
  await workout.locator(".fitness-inline-recall").getByRole("button").click();
  const details = page.getByRole("complementary", {
    name: "Exercise library panel",
    exact: true,
  });
  await expect(details.locator(".fitness-recall-section tbody tr")).toHaveCount(
    2,
  );
  await details.getByRole("button", { name: "Details", exact: true }).click();
  await expect(
    details.getByText("Move with control.", { exact: true }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await details
    .getByRole("button", { name: "Back to exercises", exact: true })
    .click();
  if (testInfo.project.name === "phone")
    await page
      .getByRole("button", { name: "Your workout", exact: true })
      .click();
  await expect(workout.getByLabel("Target reps", { exact: true })).toHaveValue(
    "8",
  );
  await add.click();
  await picker
    .getByRole("button", { name: "Create exercise", exact: true })
    .click();
  await picker
    .getByLabel("Exercise name", { exact: true })
    .fill("New variation");
  await picker.getByRole("button", { name: "Cancel", exact: true }).click();
  const discard = page.getByRole("dialog", {
    name: "Discard exercise changes?",
    exact: true,
  });
  await expect(discard).toBeVisible();
  await discard
    .getByRole("button", { name: "Keep editing", exact: true })
    .click();
  await expect(picker.getByLabel("Exercise name", { exact: true })).toHaveValue(
    "New variation",
  );
  await picker
    .getByRole("button", { name: "Create and add to workout", exact: true })
    .click();
  if (testInfo.project.name === "phone")
    await expect(page.locator(".fitness-exercise-panel")).toBeHidden();
  else await expect(page.locator(".fitness-exercise-panel")).toBeVisible();
  await expect(workout.locator(".fitness-exercise")).toHaveCount(2);
  await page.screenshot({
    path: testInfo.outputPath("connected-workout.png"),
    fullPage: true,
  });
  await workout
    .getByRole("button", { name: "Save workout", exact: true })
    .click();
  await expect(page).toHaveURL(/\/fitness$/);
  const card = page.locator(".fitness-workout-card").filter({
    has: page.getByRole("heading", { name: "My session", exact: true }),
  });
  await card
    .getByRole("button", { name: "Start workout", exact: true })
    .click();
  await expect(workout.locator(".fitness-inline-recall")).toContainText(
    "40 kg",
  );
  await navigation.getByRole("link", { name: "History", exact: true }).click();
  await expect(
    page.getByRole("link", { name: /Earlier workout/ }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /My session/ })).toBeVisible();
  await page.getByRole("link", { name: /Earlier workout/ }).click();
  await expect(page).toHaveURL(new RegExp(previous.id));
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
