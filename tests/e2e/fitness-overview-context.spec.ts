import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.use({ actionTimeout: 10000 });

test("workout previews stay compact and new workouts reset filters while the current picker retains them", async ({
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
    name: "Overview tester",
    email: `overview-${randomUUID()}@example.com`,
    password: "Synthetic-overview-password-123",
  });
  const exercise = await post("/api/v1/exercises", {
    name: "Preview exercise",
    loggingType: "reps",
  });
  for (let index = 0; index < 7; index++) {
    await post("/api/v1/strength-plans", {
      title: `Preview ${index}`,
      exercises: Array.from({ length: index === 6 ? 14 : 5 }, () => ({
        exerciseId: exercise.id,
        loggingType: "reps",
        sets: [{ targetReps: 10 }],
      })),
    });
  }
  await post("/api/v1/strength-plans", {
    title: "Short draft",
    isDraft: true,
    exercises: [
      {
        exerciseId: exercise.id,
        loggingType: "reps",
        sets: [{ targetReps: 10 }],
      },
    ],
  });
  await page.goto("/fitness");
  const cards = page.locator("#my-workouts .fitness-workout-card");
  await expect(cards).toHaveCount(info.project.name === "phone" ? 4 : 6);
  await expect(
    page.getByRole("button", { name: "Load more workouts", exact: true }),
  ).toBeVisible();
  const draft = cards.filter({
    has: page.getByRole("heading", { name: "Short draft", exact: true }),
  });
  const longCard = cards.filter({
    has: page.getByRole("heading", { name: "Preview 6", exact: true }),
  });
  await expect(longCard.getByRole("listitem")).toHaveCount(4);
  await expect(longCard.getByText("+10 more", { exact: true })).toBeVisible();
  await expect(
    longCard.getByRole("button", { name: "+10 more", exact: true }),
  ).toHaveCount(0);
  await expect(
    longCard.getByRole("button", { name: "Show fewer exercises", exact: true }),
  ).toHaveCount(0);
  if (info.project.name === "desktop") {
    expect((await draft.boundingBox())!.height).toBeCloseTo(
      (await longCard.boundingBox())!.height,
      0,
    );
  }
  await page.screenshot({
    path: info.outputPath("compact-workouts.png"),
    fullPage: info.project.name !== "phone",
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page
    .getByRole("button", { name: "Load more workouts", exact: true })
    .click();
  await expect(cards).toHaveCount(8);
  await expect(
    page.getByRole("button", { name: "Load more workouts", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Jump to section", exact: true }),
  ).toHaveCount(0);
  const nav = page.getByRole("navigation", {
    name: "Fitness views",
    exact: true,
  });
  await nav.getByRole("link", { name: "Exercises", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Exercise library", exact: true }),
  ).toBeVisible();
  await nav.getByRole("link", { name: "Training", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "My workouts", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));

  const create = () =>
    page.getByRole("link", { name: "Create workout", exact: true }).click();
  const openPicker = async () => {
    if (info.project.name === "phone")
      await page
        .getByRole("button", { name: "Add exercises", exact: true })
        .click();
  };
  await create();
  await openPicker();
  const library = page.locator(".fitness-exercise-panel");
  await library.getByRole("button", { name: "Filters", exact: true }).click();
  await library
    .getByRole("searchbox", { name: "Search muscle group", exact: true })
    .fill("Legs");
  await library.getByRole("button", { name: "Legs", exact: true }).click();
  await library
    .getByRole("searchbox", { name: "Find an exercise", exact: true })
    .fill("Squat");
  await expect(
    library.getByRole("button", { name: "Bench press", exact: true }),
  ).toHaveCount(0);
  if (info.project.name === "phone") {
    await page
      .getByRole("button", { name: "Your workout", exact: true })
      .click();
    await openPicker();
    await expect(
      library.getByRole("searchbox", { name: "Find an exercise", exact: true }),
    ).toHaveValue("Squat");
    await expect(
      library.getByRole("button", { name: "Remove Legs", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Your workout", exact: true })
      .click();
  }
  await page
    .getByRole("button", { name: "Back to Fitness", exact: true })
    .click();
  await create();
  await openPicker();
  await expect(
    library.getByRole("searchbox", { name: "Find an exercise", exact: true }),
  ).toHaveValue("");
  await expect(
    library.getByRole("button", { name: "Remove Legs", exact: true }),
  ).toHaveCount(0);
  await expect(
    library.getByRole("button", { name: "Bench press", exact: true }),
  ).toBeVisible();
});
