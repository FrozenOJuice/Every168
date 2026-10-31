import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("workout exercise details use the library pane and preserve the draft", async ({
  page,
}, testInfo) => {
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
  await write("/api/__test/register", {
    name: "Exercise panel",
    email: `panel-${randomUUID()}@example.com`,
    password: "Synthetic-panel-password-123",
  });
  const exercise = await write("/api/v1/exercises", {
    name: "Panel squat",
    notes: "Move with control.",
  });
  await page.goto("/fitness/workout/new");
  const workout = page.getByRole("region", {
    name: "Workout workspace",
    includeHidden: true,
  });
  const library = page.getByRole("complementary", {
    name: "Exercise library panel",
  });
  const mobile = testInfo.project.name !== "desktop";
  await workout
    .getByLabel("Workout name", { exact: true })
    .fill("Panel workout");
  if (mobile)
    await page
      .getByRole("button", { name: "Add exercises", exact: true })
      .click();
  const search = library.getByRole("searchbox", {
    name: "Find an exercise",
    exact: true,
  });
  await search.fill("Panel");
  await library
    .getByRole("button", { name: "Panel squat", exact: true })
    .hover();
  await library
    .getByRole("button", { name: "Add Panel squat", exact: true })
    .click();
  await workout.getByLabel("Target reps", { exact: true }).fill("8");
  const help = workout.getByRole("button", {
    name: "Exercise details for Panel squat",
    exact: true,
  });
  await help.click();
  const details = library.getByRole("region", {
    name: "Panel squat details",
    exact: true,
  });
  await expect(details).toBeVisible();
  await expect(details).toBeFocused();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    details.getByText("Move with control.", { exact: true }),
  ).toBeVisible();
  if (mobile) await expect(workout).toBeHidden();
  else {
    await expect(workout).toBeVisible();
    const left = (await workout.boundingBox())!;
    const right = (await details.boundingBox())!;
    expect(left.x + left.width).toBeLessThanOrEqual(right.x);
  }
  await details.getByRole("button", { name: "History", exact: true }).click();
  await expect(library.locator(".fitness-recall-section")).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("exercise-side-panel.png"),
    fullPage: true,
  });
  await details.press("Escape");
  await expect(search).toBeFocused();
  if (mobile)
    await page
      .getByRole("button", { name: "Your workout", exact: true })
      .click();
  await expect(workout.getByLabel("Workout name", { exact: true })).toHaveValue(
    "Panel workout",
  );
  await expect(workout.getByLabel("Target reps", { exact: true })).toHaveValue(
    "8",
  );
  if (mobile)
    await page
      .getByRole("button", { name: "Add exercises", exact: true })
      .click();
  await expect(search).toHaveValue("Panel");
  await library
    .getByRole("button", { name: "Panel squat", exact: true })
    .click();
  await expect(details).toBeVisible();
  await details
    .getByRole("button", { name: "Back to exercises", exact: true })
    .click();
  if (mobile)
    await page
      .getByRole("button", { name: "Your workout", exact: true })
      .click();
  await workout
    .getByRole("button", { name: "Save workout", exact: true })
    .click();
  await expect(page).toHaveURL(/\/fitness$/);
  await page
    .locator(".fitness-workout-card")
    .filter({ hasText: "Panel workout" })
    .getByRole("button", { name: "Start workout", exact: true })
    .click();
  await expect(page).toHaveURL(/\/fitness\/session\//);
  // Failed details reads keep the inline return action and retry available.
  await page.route(`**/api/v1/exercises/${exercise.id}`, (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "UNAVAILABLE",
          message: "Exercise details unavailable.",
        },
      }),
    }),
  );
  await page.reload();
  await help.click();
  await expect(library.getByRole("alert")).toContainText(
    "Exercise details unavailable.",
  );
  await library
    .getByRole("button", { name: "Back to workout", exact: true })
    .click();
  await expect(workout).toBeVisible();
  await expect(help).toBeFocused();
  await help.click();
  await expect(library.getByRole("alert")).toBeVisible();
  await library
    .getByRole("region", { name: "Exercise details", exact: true })
    .press("Escape");
  await expect(workout).toBeVisible();
  await expect(help).toBeFocused();
  await help.click();
  await expect(library.getByRole("alert")).toBeVisible();
  await page.unroute(`**/api/v1/exercises/${exercise.id}`);
  await library.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(details).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await details
    .getByRole("button", { name: "Back to workout", exact: true })
    .click();
  await expect(workout).toBeVisible();
  await expect(help).toBeFocused();
  await expect(workout).toBeVisible();
});
