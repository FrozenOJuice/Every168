import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("mixed activities retain independent intent, measurements, recovery and progress", async ({
  page,
}, info) => {
  const write = async (
    path: string,
    data: object,
    version?: number,
    method: "post" | "put" = "post",
  ) => {
    const result = await page.request[method](path, {
      headers: {
        Origin: "http://localhost:3100",
        "Idempotency-Key": randomUUID(),
        ...(version ? { "If-Match": `"${version}"` } : {}),
      },
      data,
    });
    expect(result.ok()).toBe(true);
    return result.json();
  };
  await write("/api/__test/register", {
    name: "Mixed training",
    email: `mixed-${randomUUID()}@example.com`,
    password: "Synthetic-fitness-password-123",
  });
  const me = await (await page.request.get("/api/v1/me")).json();
  await write(
    "/api/v1/preferences",
    { timezone: "UTC", weekStartsOn: 1, weightUnit: "kg", distanceUnit: "mi" },
    me.preferences.version,
    "put",
  );
  const swim = await write("/api/v1/exercises", {
    name: "Swimming",
    loggingType: "distance_duration",
    intentTags: ["technique"],
  });
  const squat = await write("/api/v1/exercises", {
    name: "Squat",
    loggingType: "reps_load",
  });
  const plan = await write("/api/v1/strength-plans", {
    title: "Mixed practice",
    exercises: [
      { exerciseId: swim.id, sets: [{ targetDistanceMeters: 1609.344 }] },
      { exerciseId: squat.id, sets: [{ targetReps: 5 }] },
    ],
  });
  await page.goto(`/fitness/workout/${plan.id}`);
  await page
    .getByRole("button", { name: "Advanced editor", exact: true })
    .first()
    .click();
  await expect(
    page.getByLabel("Intent for Swimming", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByLabel("Target distance (mi)", { exact: true }).first(),
  ).toHaveValue("1");
  await page
    .getByRole("button", {
      name: "Configure measurements for Swimming",
      exact: true,
    })
    .click();
  await page
    .getByRole("group", {
      name: "Configure measurements for Swimming",
      exact: true,
    })
    .getByRole("checkbox", { name: "Laps", exact: true })
    .check();
  await page
    .getByRole("group", {
      name: "Configure measurements for Swimming",
      exact: true,
    })
    .getByRole("checkbox", { name: "Distance", exact: true })
    .uncheck();
  await page.getByLabel("Target laps", { exact: true }).first().fill("8");
  await page.getByRole("button", { name: "Save workout", exact: true }).click();
  await expect(page).toHaveURL(/\/fitness$/);
  const savedPlan = await (
    await page.request.get(`/api/v1/strength-plans/${plan.id}`)
  ).json();
  expect(savedPlan.exercises[0]).toMatchObject({
    loggingType: "laps_duration",
    intentTags: ["technique"],
  });
  expect(savedPlan.exercises[0].sets[0]).toMatchObject({
    targetDistanceMeters: 1609.344,
    targetLaps: 8,
  });
  const w = await write(
    `/api/v1/strength-plans/${plan.id}/begin`,
    { startedAt: new Date(Date.now() - 3600000).toISOString() },
    savedPlan.version,
  );
  await page.goto(`/fitness/session/${w.id}`);
  await page
    .getByRole("button", {
      name: "Configure measurements for Swimming",
      exact: true,
    })
    .click();
  await page
    .getByRole("group", {
      name: "Configure measurements for Swimming",
      exact: true,
    })
    .getByRole("checkbox", { name: "Distance", exact: true })
    .check();
  await page
    .getByRole("group", {
      name: "Configure measurements for Swimming",
      exact: true,
    })
    .getByRole("checkbox", { name: "Laps", exact: true })
    .uncheck();
  await page
    .getByLabel("Actual distance (mi)", { exact: true })
    .first()
    .fill("-1");
  await expect(page.locator(".fitness-save-state")).not.toHaveText("Saved");
  await page.reload();
  await expect(
    page.getByLabel("Actual distance (mi)", { exact: true }).first(),
  ).toHaveValue("-1");
  await page
    .getByLabel("Actual distance (mi)", { exact: true })
    .first()
    .fill("0.5");
  await page
    .getByLabel("Actual duration (seconds)", { exact: true })
    .first()
    .fill("900");
  await page.getByLabel("Completed", { exact: true }).first().check();
  await page.getByLabel("Actual reps", { exact: true }).last().fill("5");
  await page
    .getByLabel("Actual weight (kg)", { exact: true })
    .last()
    .fill("20");
  await page.getByLabel("Completed", { exact: true }).nth(1).check();
  await expect(page.locator(".fitness-save-state")).toHaveText("Saved");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("mixed-workout.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Finish workout", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Finish workout", exact: true }),
  ).not.toBeVisible();
  await expect(page.locator(".fitness-save-state")).toHaveText("Saved");
  const finished = await (
    await page.request.get(`/api/v1/strength-workouts/${w.id}`)
  ).json();
  expect(finished.exercises[0]).toMatchObject({
    intentTags: ["technique"],
    loggingType: "distance_duration",
  });
  expect(finished.exercises[0].sets[0].distanceMeters).toBeCloseTo(804.672);
  await page.goto(`/fitness/progress/${swim.id}`);
  await expect(page.locator(".fitness-progress-records")).toContainText(
    "0.5 mi",
  );
  await expect(page.locator(".fitness-progress-records")).toContainText("15m");
  const repeated = await write(
    `/api/v1/strength-workouts/${w.id}/repeat`,
    {},
    finished.version,
  );
  await page.goto(`/fitness/session/${repeated.id}`);
  await expect(
    page.getByLabel("Actual distance (mi)", { exact: true }).first(),
  ).toBeEmpty();
  await expect(
    page.getByLabel("Intent for Swimming", { exact: true }),
  ).toHaveCount(0);
});

test("custom activity defaults accept distance measurements without intent fields", async ({
  page,
}) => {
  const response = await page.request.post("/api/__test/register", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      name: "Activity creator",
      email: `activity-${randomUUID()}@example.com`,
      password: "Synthetic-fitness-password-123",
    },
  });
  expect(response.ok()).toBe(true);
  await page.goto("/fitness/exercises");
  await page
    .getByRole("button", { name: "Create exercise", exact: true })
    .click();
  await page
    .getByLabel("Exercise name", { exact: true })
    .fill("Cycling practice");
  const measurements = page.getByRole("group", {
    name: "Measurements",
    exact: true,
  });
  await measurements
    .getByRole("checkbox", { name: "Distance", exact: true })
    .check();
  await measurements
    .getByRole("checkbox", { name: "Duration", exact: true })
    .check();
  await measurements
    .getByRole("checkbox", { name: "Reps", exact: true })
    .uncheck();
  await measurements
    .getByRole("checkbox", { name: "Weight", exact: true })
    .uncheck();
  await expect(
    page.getByLabel("Intent tags (optional)", { exact: true }),
  ).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page
    .getByRole("region", { name: "Create exercise", exact: true })
    .getByRole("button", { name: "Create exercise", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Cycling practice", exact: true }),
  ).toBeVisible();
  const result = await (
    await page.request.get("/api/v1/exercises?search=Cycling")
  ).json();
  expect(result.items[0]).toMatchObject({
    loggingType: "distance_duration",
    intentTags: [],
  });
});
