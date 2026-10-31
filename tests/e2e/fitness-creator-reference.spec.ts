import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.use({ actionTimeout: 10000 });
test("creator reference shares the details layout and returns to the retained workout", async ({
  page,
}, info) => {
  const post = async (path: string, data: object) => {
    const r = await page.request.post(path, {
      headers: {
        Origin: "http://localhost:3100",
        "Idempotency-Key": randomUUID(),
      },
      data,
    });
    expect(r.ok()).toBe(true);
    return r.json();
  };
  await post("/api/__test/register", {
    name: "Reference layout",
    email: `reference-layout-${randomUUID()}@example.com`,
    password: "Synthetic-reference-password-123",
  });
  const exercise = await post("/api/v1/exercises", {
    name: "Reference press",
    notes: "Keep your feet planted. Move with control.",
    equipment: ["Barbell"],
    muscles: ["Chest", "Arms"],
    loggingType: "reps_load",
  });
  const plan = await post("/api/v1/strength-plans", {
    title: "Reference workout",
    exercises: Array.from({ length: 8 }, () => ({
      exerciseId: exercise.id,
      loggingType: "reps_load",
      sets: [{ targetReps: 12, targetWeightKg: 50 }],
    })),
  });
  await page.goto(`/fitness/workout/${plan.id}`);
  const workout = page.getByRole("region", {
    name: "Workout workspace",
    includeHidden: true,
  });
  await workout
    .getByLabel("Workout name", { exact: true })
    .fill("Retained changes");
  const cards = workout.locator(".fitness-workout-exercise-list > section");
  const last = cards.last();
  await last
    .getByRole("button", {
      name: "Expand Reference press exercise",
      exact: true,
    })
    .click();
  await last.getByLabel("Target reps", { exact: true }).fill("10");
  const opener = last.getByRole("button", {
    name: "Exercise details for Reference press",
    exact: true,
  });
  await opener.scrollIntoViewIfNeeded();
  const scroll = workout.locator(".fitness-builder-scroll");
  const before = await scroll.evaluate((node) => node.scrollTop);
  await opener.click();
  const guide = page.getByRole("region", {
    name: "Reference press details",
    exact: true,
  });
  await expect(guide).toHaveClass(/fitness-exercise-reference/);
  await expect(
    guide.getByRole("heading", { name: "Reference press", exact: true }),
  ).toBeVisible();
  await expect(
    guide.getByRole("heading", { name: "Instructions", exact: true }),
  ).toBeVisible();
  await expect(guide).toContainText(
    "Keep your feet planted. Move with control.",
  );
  await expect(
    guide.getByRole("group", { name: "Exercise information", exact: true }),
  ).toHaveCount(0);
  await expect(guide.locator(".fitness-inline-recall")).toHaveCount(0);
  await expect(
    guide.getByRole("region", { name: "Your history", exact: true }),
  ).toHaveCount(0);
  const back = guide.getByRole("button", {
    name: "Back to workout",
    exact: true,
  });
  await expect(back).toHaveCSS("font-weight", "600");
  const star = guide.getByRole("button", {
    name: "Favourite Reference press",
    exact: true,
  });
  const starBox = (await star.boundingBox())!,
    backBox = (await back.boundingBox())!;
  expect(starBox.y + starBox.height / 2).toBeCloseTo(
    backBox.y + backBox.height / 2,
    0,
  );
  await star.click();
  await expect(
    guide.getByRole("button", {
      name: "Unfavourite Reference press",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  if (info.project.name === "phone") {
    await expect(
      page.getByRole("group", { name: "Workout creation view", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Back to Fitness", exact: true }),
    ).toBeHidden();
  }
  await page.screenshot({ path: info.outputPath("creator-reference.png") });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await back.click();
  await expect(opener).toBeFocused();
  expect(await scroll.evaluate((node) => node.scrollTop)).toBeCloseTo(
    before,
    0,
  );
  await expect(workout.getByLabel("Workout name", { exact: true })).toHaveValue(
    "Retained changes",
  );
  await expect(last.getByLabel("Target reps", { exact: true })).toHaveValue(
    "10",
  );
  await opener.click();
  await guide.focus();
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
  await page
    .getByRole("button", { name: "Back to Fitness", exact: true })
    .scrollIntoViewIfNeeded();
  if (info.project.name === "phone")
    await page
      .getByRole("group", { name: "Workout creation view", exact: true })
      .getByRole("button", { name: "Add exercises", exact: true })
      .click();
  const library = page.locator(".fitness-exercise-panel");
  await library
    .getByRole("button", { name: "Reference press", exact: true })
    .click();
  await expect(guide).toBeVisible();
  await expect(
    guide.getByRole("button", { name: "Back to workout", exact: true }),
  ).toHaveCSS("font-weight", "600");
  await guide
    .getByRole("button", { name: "Back to workout", exact: true })
    .click();
  await expect(guide).toHaveCount(0);
  await expect(
    workout.getByLabel("Workout name", { exact: true }),
  ).toBeVisible();
  await expect(workout.getByLabel("Workout name", { exact: true })).toHaveValue(
    "Retained changes",
  );
  if (info.project.name === "phone")
    await page
      .getByRole("group", { name: "Workout creation view", exact: true })
      .getByRole("button", { name: "Add exercises", exact: true })
      .click();
  await library
    .getByRole("button", { name: "Reference press", exact: true })
    .click();
  await guide
    .getByRole("button", { name: "Add Reference press", exact: true })
    .click();
  await expect(cards).toHaveCount(9);
  await expect(
    page.getByRole("button", { name: "Back to Fitness", exact: true }),
  ).toBeVisible();
  if (info.project.name === "phone")
    await expect(
      page.getByRole("group", { name: "Workout creation view", exact: true }),
    ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
