import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("workout and exercise notes share a persistent toggle and preserve text when collapsed", async ({
  page,
}, info) => {
  await page.request.post("/api/auth/sign-up/email", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      name: "Notes workflow",
      email: `notes-${randomUUID()}@example.com`,
      password: "Synthetic-notes-password-123",
    },
  });
  const write = async (path: string, data: object) => {
    const r = await page.request.post(`/api/v1/${path}`, {
      headers: {
        Origin: "http://localhost:3100",
        "Idempotency-Key": randomUUID(),
      },
      data,
    });
    expect(r.ok()).toBe(true);
    return r.json();
  };
  const exercise = await write("exercises", { name: "Notes exercise" });
  const plan = await write("strength-plans", {
    title: "Notes workout",
    exercises: [{ exerciseId: exercise.id, sets: [{ targetReps: 8 }] }],
  });
  await page.goto(`/fitness/workout/${plan.id}`);
  await page
    .getByRole("button", {
      name: "Expand Notes exercise exercise",
      exact: true,
    })
    .click();
  const workout = page.locator(".fitness-builder-setup");
  const card = page.locator(".fitness-compact-exercise").first();
  for (const [scope, label, text] of [
    [workout, "Workout notes", "Keep this workout note"],
    [card, "Exercise notes", "Keep this exercise note"],
  ] as const) {
    const toggle = scope.getByRole("button", {
      name: `Toggle ${label.toLowerCase()}`,
      exact: true,
    });
    await expect(toggle).toBeVisible();
    await expect(scope.getByLabel(label, { exact: true })).toBeHidden();
    await toggle.click();
    await scope.getByLabel(label, { exact: true }).fill(text);
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(scope.getByLabel(label, { exact: true })).toBeHidden();
    await toggle.click();
    await expect(scope.getByLabel(label, { exact: true })).toHaveValue(text);
  }
  await expect(card.getByRole("button", { name: /Remove note/ })).toHaveCount(
    0,
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await card.locator(".fitness-notes-editor").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: info.outputPath("consistent-notes.png"),
    fullPage: true,
  });
  await page.reload();
  await page
    .getByRole("button", {
      name: "Expand Notes exercise exercise",
      exact: true,
    })
    .click();
  await expect(
    workout.getByLabel("Workout notes", { exact: true }),
  ).toHaveValue("Keep this workout note");
  const exerciseToggle = card.getByRole("button", {
    name: "Toggle exercise notes",
    exact: true,
  });
  if (!(await card.getByLabel("Exercise notes", { exact: true }).isVisible()))
    await exerciseToggle.click();
  await expect(card.getByLabel("Exercise notes", { exact: true })).toHaveValue(
    "Keep this exercise note",
  );
  await page.getByRole("button", { name: "Save workout", exact: true }).click();
  await expect(page).toHaveURL(/\/fitness$/);
  const saved = await (
    await page.request.get(`/api/v1/strength-plans/${plan.id}`)
  ).json();
  expect(saved.notes).toBe("Keep this workout note");
  expect(saved.exercises[0].notes).toBe("Keep this exercise note");
  await page.goto(`/fitness/workout/${plan.id}`);
  await page
    .getByRole("button", {
      name: "Expand Notes exercise exercise",
      exact: true,
    })
    .click();
  await expect(card.getByLabel("Exercise notes", { exact: true })).toHaveValue(
    "Keep this exercise note",
  );
  await card.getByLabel("Exercise notes", { exact: true }).fill("");
  await exerciseToggle.click();
  await page.getByRole("button", { name: "Save workout", exact: true }).click();
  await expect(page).toHaveURL(/\/fitness$/);
  const cleared = await (
    await page.request.get(`/api/v1/strength-plans/${plan.id}`)
  ).json();
  expect(cleared.exercises[0].notes).toBeNull();
  expect(cleared.notes).toBe("Keep this workout note");
});
