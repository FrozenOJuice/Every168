import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("exercise and workout forms omit intent fields while saving existing tags intact", async ({
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
    name: "Intent removal",
    email: `intent-removal-${randomUUID()}@example.com`,
    password: "Synthetic-intent-password-123",
  });
  const exercise = await post("/api/v1/exercises", {
    name: "Tagged movement",
    loggingType: "reps_load",
    intentTags: ["technique"],
  });
  const plan = await post("/api/v1/strength-plans", {
    title: "Tagged workout",
    exercises: [
      {
        exerciseId: exercise.id,
        intentTags: ["recovery"],
        sets: [{ targetReps: 8 }],
      },
    ],
  });
  await page.goto("/fitness");
  await page
    .locator("#exercises")
    .getByRole("button", { name: "Create exercise", exact: true })
    .click();
  const creator = page.getByRole("region", {
    name: "Create exercise",
    exact: true,
  });
  await expect(creator.getByLabel(/Intent/)).toHaveCount(0);
  await creator
    .getByLabel("Exercise name", { exact: true })
    .fill("New movement");
  await creator
    .getByRole("button", { name: "Create exercise", exact: true })
    .click();
  await expect(creator).toHaveCount(0);
  const created = await (
    await page.request.get("/api/v1/exercises?search=New%20movement")
  ).json();
  expect(created.items[0].intentTags).toEqual([]);
  await page.goto(`/fitness/exercises/${exercise.id}`);
  await expect(
    page.getByRole("heading", { name: "Tagged movement", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Default intent:/)).toHaveCount(0);
  await page.screenshot({
    path: info.outputPath("exercise-details-toolbar.png"),
  });
  await page
    .getByRole("button", { name: "Exercise actions", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Edit exercise", exact: true })
    .click();
  await expect(page.getByLabel(/Intent/)).toHaveCount(0);
  await page
    .getByLabel("Exercise name", { exact: true })
    .fill("Renamed movement");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Renamed movement", exact: true }),
  ).toBeVisible();
  expect(
    (await (await page.request.get(`/api/v1/exercises/${exercise.id}`)).json())
      .intentTags,
  ).toEqual(["technique"]);
  await page.goto(`/fitness/workout/${plan.id}`);
  await page
    .getByRole("button", {
      name: "Expand Tagged movement exercise",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Advanced editor", exact: true })
    .click();
  await expect(page.getByLabel(/Intent/)).toHaveCount(0);
  await page
    .getByLabel("Workout name", { exact: true })
    .fill("Renamed workout");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Save workout", exact: true }).click();
  await expect(page).toHaveURL(/\/fitness$/);
  const saved = await (
    await page.request.get(`/api/v1/strength-plans/${plan.id}`)
  ).json();
  expect(saved.exercises[0].intentTags).toEqual(["recovery"]);
});
