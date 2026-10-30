import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("creator navigation precedes mobile views and basic unit fields have room", async ({
  page,
}, info) => {
  expect(
    (
      await page.request.post("/api/auth/sign-up/email", {
        headers: { Origin: "http://localhost:3100" },
        data: {
          name: "Creator layout",
          email: `creator-layout-${randomUUID()}@example.com`,
          password: "Synthetic-creator-password-123",
        },
      })
    ).ok(),
  ).toBe(true);
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
  const exercise = await write("/api/v1/exercises", {
    name: "History press",
    loggingType: "reps_load",
  });
  const previous = await write("/api/v1/strength-workouts", {
    title: "Prior workout",
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
          sets: [{ reps: 12, weightKg: 50, completed: true }],
        },
      ],
    },
    previous.version,
  );
  await page.goto("/fitness");
  await page.getByRole("link", { name: "Create workout", exact: true }).click();
  const back = page.getByRole("button", {
    name: "Back to Fitness",
    exact: true,
  });
  const views = page.getByRole("group", {
    name: "Workout creation view",
    exact: true,
  });
  const workout = page.getByRole("region", {
    name: "Workout workspace",
    includeHidden: true,
  });
  const name = workout.getByLabel("Workout name", { exact: true });
  const addExercise = workout.getByRole("button", {
    name: "Add exercise",
    exact: true,
  });
  if (info.project.name === "phone") await expect(addExercise).toBeVisible();
  else {
    await expect(addExercise).toHaveCount(0);
    await page.setViewportSize({ width: 1100, height: 900 });
    await expect(addExercise).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(addExercise).toHaveCount(0);
  }
  await expect(back).toBeVisible();
  if (info.project.name === "phone") {
    const b = await back.boundingBox(),
      v = await views.boundingBox();
    expect(b!.y + b!.height).toBeLessThanOrEqual(v!.y);
    expect((await name.boundingBox())!.y).toBeLessThan(300);
  } else await expect(views).toBeHidden();
  await page.screenshot({ path: info.outputPath("creator-entry.png") });
  await name.fill("Layout workout");
  if (info.project.name === "phone") await addExercise.click();
  // Back remains an editor-level action even while browsing the library.
  await back.click();
  const confirm = page.getByRole("dialog", {
    name: "Save your changes?",
    exact: true,
  });
  await expect(confirm).toBeVisible();
  await confirm
    .getByRole("button", { name: "Keep editing", exact: true })
    .click();
  await expect(name).toHaveValue("Layout workout");
  if (info.project.name === "phone")
    await views
      .getByRole("button", { name: "Add exercises", exact: true })
      .click();
  const library = page.locator(".fitness-exercise-panel");
  await expect(library.locator(".fitness-favourites-label")).toBeVisible();
  await expect(
    library.getByRole("button", { name: "Hidden", exact: true }),
  ).toHaveCount(0);
  await page
    .locator(".fitness-exercise-panel")
    .getByRole("button", { name: "Add History press", exact: true })
    .click();
  const card = workout.getByRole("region", {
    name: "History press exercise 1",
    exact: true,
  });
  await expect(card).toBeVisible();
  await expect(workout.locator(".fitness-inline-recall")).toHaveCount(0);
  await expect(workout.getByRole("button", { name: /Last time/ })).toHaveCount(
    0,
  );
  const weight = card.getByLabel("Target weight (kg)", { exact: true });
  if (info.project.name === "phone") {
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      const weightBox = await weight.boundingBox();
      expect(
        (await card.locator(".fitness-exercise-heading-copy").boundingBox())!
          .width,
      ).toBeGreaterThan(130);
      const repsBox = await card
        .getByLabel("Target reps", { exact: true })
        .boundingBox();
      expect(weightBox!.y).toBeGreaterThan(repsBox!.y);
      expect(weightBox!.width).toBeGreaterThan(130);
      await weight.fill("125.5");
      await expect(weight).toHaveValue("125.5");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
  await page.screenshot({ path: info.outputPath("creator-targets.png") });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await workout
    .getByRole("button", { name: "Save workout", exact: true })
    .click();
  await expect(page).toHaveURL(/\/fitness$/);
  await page
    .locator("#my-workouts .fitness-workout-card")
    .filter({
      has: page.getByRole("heading", { name: "Layout workout", exact: true }),
    })
    .getByRole("link", { name: "Edit", exact: true })
    .click();
  await workout
    .getByRole("button", { name: "Expand History press exercise", exact: true })
    .click();
  await expect(
    workout.getByLabel("Target reps", { exact: true }),
  ).toBeVisible();
  await expect(workout.locator(".fitness-inline-recall")).toHaveCount(0);
  if (info.project.name === "phone") {
    await addExercise.click();
    await expect(page.locator(".fitness-exercise-panel")).toBeVisible();
  } else await expect(addExercise).toHaveCount(0);
});
