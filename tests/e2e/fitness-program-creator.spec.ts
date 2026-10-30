import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.use({ actionTimeout: 10000 });
test("program creator searches all ready workouts and preserves off-page names, dates and cancel destinations", async ({
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
    name: "Program creator",
    email: `program-creator-${randomUUID()}@example.com`,
    password: "Synthetic-program-password-123",
  });
  const exercise = await post("/api/v1/exercises", {
    name: "Program movement",
    loggingType: "reps",
  });
  const faraway = await post("/api/v1/strength-plans", {
    title: "Faraway workout",
    exercises: [{ exerciseId: exercise.id, sets: [{ targetReps: 8 }] }],
  });
  for (let index = 0; index < 13; index++)
    await post("/api/v1/strength-plans", {
      title: `Recent ${index}`,
      exercises: [{ exerciseId: exercise.id, sets: [{ targetReps: 8 }] }],
    });
  await post("/api/v1/strength-plans", {
    title: "Faraway draft",
    isDraft: true,
    exercises: [],
  });
  if (info.project.name === "phone")
    await page.setViewportSize({ width: 320, height: 844 });
  await page.clock.install({ time: new Date("2026-10-28T12:00:00Z") });
  await page.goto("/fitness");
  await page.getByRole("link", { name: "Create program", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(/\/fitness$/);
  await page.getByRole("link", { name: "Create program", exact: true }).click();
  await page.getByLabel("Program name", { exact: true }).fill("My rotation");
  await page.getByRole("button", { name: "Add workout", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Add Faraway workout to sequence",
      exact: true,
    }),
  ).toHaveCount(0);
  const search = page.getByRole("searchbox", {
    name: "Search workouts",
    exact: true,
  });
  await search.pressSequentially("Faraway");
  await expect(search).toBeFocused();
  await expect(
    page.getByRole("button", {
      name: "Add Faraway draft to sequence",
      exact: true,
    }),
  ).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Add Faraway workout to sequence",
      exact: true,
    })
    .click();
  await expect(page.getByRole("status")).toContainText("added at position 1");
  await page
    .getByRole("button", {
      name: "Add Faraway workout to sequence",
      exact: true,
    })
    .click();
  await search.fill("Recent");
  await expect(
    page.getByRole("button", {
      name: "Add Recent 12 to sequence",
      exact: true,
    }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page
      .locator(".fitness-program-picker-results")
      .evaluate((element) => element.scrollHeight > element.clientHeight),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .locator(".fitness-program-picker")
    .screenshot({ path: info.outputPath("program-workout-picker.png") });
  await search.focus();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Add workout", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Add workout", exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Add workout", exact: true }),
  ).toBeFocused();
  await expect(page.locator(".fitness-program-steps li")).toHaveCount(2);
  await page.reload();
  await expect(page.getByLabel("Program name", { exact: true })).toHaveValue(
    "My rotation",
  );
  await expect(page.locator(".fitness-program-steps li strong")).toHaveText([
    "Faraway workout",
    "Faraway workout",
  ]);
  await page
    .getByRole("button", { name: "Move step 2 up", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remove step 2", exact: true })
    .click();
  await page.getByRole("button", { name: "Start date", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "Choose day", exact: true });
  await expect(picker).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Start date", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Start date", exact: true }).click();
  await picker.getByRole("button", { name: /October 26, 2026/ }).click();
  await expect(
    page.getByRole("button", { name: "Start date", exact: true }),
  ).toHaveText("Oct 26, 2026");
  await page.getByLabel("Monday", { exact: true }).check();
  await expect(
    page.getByText(/Suggest training dates from this day/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Discard program changes?", exact: true })
    .getByRole("button", { name: "Keep editing", exact: true })
    .click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("program-creator.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Save program", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Next: Faraway workout", exact: true }),
  ).toBeVisible();
  const path = new URL(page.url()).pathname;
  const saved = await (
    await page.request.get(
      `/api/v1/training-programs/${path.split("/").at(-1)}`,
    )
  ).json();
  expect(saved.startDate).toBe("2026-10-26");
  expect(saved.trainingDays).toEqual([1]);
  expect(
    saved.steps.map((step: { workoutId: string }) => step.workoutId),
  ).toEqual([faraway.id]);
  await page.getByRole("link", { name: "Edit program", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await page.goto("/fitness/programs/new");
  await page.getByLabel("Program name", { exact: true }).fill("Discard this");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Discard program changes?", exact: true })
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
  await expect(page).toHaveURL(/\/fitness$/);
});
