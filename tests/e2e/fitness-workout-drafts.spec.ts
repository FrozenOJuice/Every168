import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.use({ actionTimeout: 10000 });

test("workout creation keeps save actions fixed and saves unfinished drafts", async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  expect(
    (
      await page.request.post("/api/auth/sign-up/email", {
        headers: { Origin: "http://localhost:3100" },
        data: {
          name: "Draft member",
          email: `draft-${randomUUID()}@example.com`,
          password: "Synthetic-draft-password-123",
        },
      })
    ).status(),
  ).toBe(200);
  await page.goto("/fitness");
  const right = page.getByRole("region", {
    name: "Workout workspace",
    exact: true,
    includeHidden: true,
  });
  const create = () =>
    right.getByRole("link", { name: "Create workout", exact: true }).click();
  await create();
  await expect(
    right.getByRole("link", { name: "← My workouts", exact: true }),
  ).toHaveCount(0);
  await right
    .getByRole("button", { name: "Save workout", exact: true })
    .click();
  await expect(
    right.getByText("Enter a workout name.", { exact: true }),
  ).toBeVisible();
  await right.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page).toHaveURL(/\/fitness$/);
  const cards = right.locator(".fitness-workout-card");
  let draft = cards.filter({
    has: page.getByRole("heading", { name: "Untitled workout", exact: true }),
  });
  await expect(draft.getByText("Draft", { exact: true })).toBeVisible();
  await expect(
    draft.getByRole("button", { name: "Start workout", exact: true }),
  ).toHaveCount(0);
  await expect(
    draft.getByRole("button", { name: "Schedule", exact: true }),
  ).toHaveCount(0);
  await draft
    .getByRole("link", { name: "Continue editing", exact: true })
    .click();
  const save = right.getByRole("button", { name: "Save workout", exact: true });
  const before = (await save.boundingBox())!;
  await right.getByLabel("Workout name", { exact: true }).fill("Push draft");
  await expect(right.getByLabel("Workout notes", { exact: true })).toBeHidden();
  await right
    .getByRole("button", { name: "Toggle workout notes", exact: true })
    .click();
  await right
    .getByLabel("Workout notes", { exact: true })
    .fill("Keep these notes");
  if (testInfo.project.name === "phone")
    await right
      .getByRole("button", { name: "Add exercise", exact: true })
      .click();
  else
    await expect(
      right.getByRole("button", { name: "Add exercise", exact: true }),
    ).toHaveCount(0);
  const left = page.locator(".fitness-exercise-panel");
  const bench = left.getByRole("button", { name: "Bench press", exact: true });
  if (testInfo.project.name === "desktop") await bench.hover();
  for (let index = 0; index < 2; index++) {
    if (index > 0 && testInfo.project.name === "phone")
      await page
        .getByRole("button", { name: "Add exercises", exact: true })
        .click();
    await left
      .getByRole("button", { name: "Add Bench press", exact: true })
      .click();
    await expect(right.locator(".fitness-exercise")).toHaveCount(index + 1);
  }
  await right.getByLabel("Target reps", { exact: true }).first().fill("8");
  const after = (await save.boundingBox())!;
  expect(Math.abs(after.y - before.y)).toBeLessThan(1);
  await right.locator(".fitness-builder-exercises").evaluate((node) => {
    node.scrollTop = node.scrollHeight;
  });
  expect(Math.abs((await save.boundingBox())!.y - before.y)).toBeLessThan(1);
  await expect(save).toBeInViewport();
  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  if (testInfo.project.name === "phone")
    expect(after.y + after.height).toBeLessThan(
      (await navigation.boundingBox())!.y,
    );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("workout-builder-fixed-footer.png"),
    fullPage: true,
  });
  await right.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page).toHaveURL(/\/fitness$/);
  draft = cards.filter({
    has: page.getByRole("heading", { name: "Push draft", exact: true }),
  });
  await page.reload();
  await expect(draft.getByText("Draft", { exact: true })).toBeVisible();
  await draft
    .getByRole("link", { name: "Continue editing", exact: true })
    .click();
  await expect(right.locator(".fitness-exercise")).toHaveCount(2);
  await expect(right.getByLabel("Workout notes", { exact: true })).toHaveValue(
    "Keep these notes",
  );
  await right
    .getByRole("button", { name: "Expand Bench press exercise", exact: true })
    .first()
    .click();
  await expect(
    right.getByLabel("Target reps", { exact: true }).first(),
  ).toHaveValue("8");
  await save.click();
  await expect(page).toHaveURL(/\/fitness$/);
  await expect(draft.getByText("Draft", { exact: true })).toHaveCount(0);
  await expect(
    draft.getByRole("button", { name: "Start workout", exact: true }),
  ).toBeVisible();
  await expect(
    draft.getByRole("button", { name: "Schedule", exact: true }),
  ).toBeVisible();
});

test("Back to Fitness leaves unchanged workouts and offers draft, discard and keep editing for changes", async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  expect(
    (
      await page.request.post("/api/auth/sign-up/email", {
        headers: { Origin: "http://localhost:3100" },
        data: {
          name: "Cancel member",
          email: `cancel-${randomUUID()}@example.com`,
          password: "Synthetic-cancel-password-123",
        },
      })
    ).status(),
  ).toBe(200);
  await page.goto("/fitness");
  const right = page.getByRole("region", {
    name: "Workout workspace",
    exact: true,
  });
  const create = () =>
    right.getByRole("link", { name: "Create workout", exact: true }).click();
  const cancel = () =>
    page.getByRole("button", { name: "Back to Fitness", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Save your changes?",
    exact: true,
  });
  await create();
  await cancel();
  await expect(page).toHaveURL(/\/fitness$/);
  await expect(dialog).toHaveCount(0);
  await create();
  await right
    .getByLabel("Workout name", { exact: true })
    .fill("Keep this draft");
  await cancel();
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByText(/Save this as a draft to finish later/),
  ).toHaveCount(0);
  const choices = dialog.locator(".fitness-confirm-actions");
  await expect(choices.getByRole("button")).toHaveText([
    "Keep editing",
    "Discard",
    "Save draft",
  ]);
  const keep = (await choices
    .getByRole("button", { name: "Keep editing", exact: true })
    .boundingBox())!;
  const discard = (await choices
    .getByRole("button", { name: "Discard", exact: true })
    .boundingBox())!;
  const save = (await choices
    .getByRole("button", { name: "Save draft", exact: true })
    .boundingBox())!;
  for (const box of [keep, discard, save])
    expect(box.height).toBeGreaterThanOrEqual(44);
  expect(keep.y).toBeCloseTo(discard.y, 0);
  if (testInfo.project.name === "phone") {
    expect(save.y).toBeGreaterThan(keep.y);
    expect(save.width).toBeCloseTo((await choices.boundingBox())!.width, 0);
  } else expect(save.y).toBeCloseTo(keep.y, 0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("unsaved-workout.png"),
    fullPage: true,
  });
  await dialog.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Back to Fitness", exact: true }),
  ).toBeFocused();
  await cancel();
  await dialog
    .getByRole("button", { name: "Keep editing", exact: true })
    .click();
  await expect(right.getByLabel("Workout name", { exact: true })).toHaveValue(
    "Keep this draft",
  );
  await cancel();
  await dialog.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(page).toHaveURL(/\/fitness$/);
  const card = right.locator(".fitness-workout-card").filter({
    has: page.getByRole("heading", { name: "Keep this draft", exact: true }),
  });
  await card
    .getByRole("link", { name: "Continue editing", exact: true })
    .click();
  await cancel();
  await expect(page).toHaveURL(/\/fitness$/);
  await expect(dialog).toHaveCount(0);
  await card
    .getByRole("link", { name: "Continue editing", exact: true })
    .click();
  await right
    .getByLabel("Workout name", { exact: true })
    .fill("Discard this title");
  await cancel();
  await dialog.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(page).toHaveURL(/\/fitness$/);
  await expect(card).toBeVisible();
});
