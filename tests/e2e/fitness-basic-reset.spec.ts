import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("custom exercise settings reset with confirmation and can be adjusted afterward", async ({
  page,
}, info) => {
  await page.request.post("/api/auth/sign-up/email", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      name: "Basic reset",
      email: `basic-${randomUUID()}@example.com`,
      password: "Synthetic-basic-password-123",
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
  const exercise = await write("exercises", { name: "Reset practice" });
  const plan = await write("strength-plans", {
    title: "Reset practice",
    exercises: [
      {
        exerciseId: exercise.id,
        notes: "Keep this note",
        intentTags: ["technique"],
        sets: [
          { targetReps: 8, targetWeightKg: 20, restSeconds: 60 },
          {
            measurementOverride: "duration",
            targetDurationSeconds: 45,
            targetReps: 10,
          },
        ],
      },
    ],
  });
  await page.goto(`/fitness/workout/${plan.id}`);
  const card = page.locator(".fitness-compact-exercise").first();
  const reset = card.getByRole("button", {
    name: "Reset to basic",
    exact: true,
  });
  await expect(reset).toHaveAttribute("aria-expanded", "true");
  await card
    .getByRole("button", {
      name: "Collapse Reset practice exercise",
      exact: true,
    })
    .click();
  await card
    .getByRole("button", {
      name: "Expand Reset practice exercise",
      exact: true,
    })
    .click();
  await expect(reset).toBeVisible();
  await reset.click();
  const dialog = page.getByRole("dialog", {
    name: "Reset Reset practice to basic?",
    exact: true,
  });
  await expect(dialog.getByRole("spinbutton")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    card.getByLabel("Target duration (seconds)", { exact: true }),
  ).toHaveValue("45");
  await reset.click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: info.outputPath("reset-to-basic.png"),
    fullPage: true,
  });
  await dialog
    .getByRole("button", { name: "Reset to basic", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    card.getByRole("button", { name: "Advanced editor", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
  await expect(card.getByLabel("Sets", { exact: true })).toHaveValue("2");
  await expect(card.getByLabel("Target reps", { exact: true })).toBeEmpty();
  await card.getByLabel("Target reps", { exact: true }).fill("6");
  await card.getByLabel(/Target load/).fill("25");
  await card
    .getByRole("button", { name: "Rest between sets", exact: true })
    .click();
  await card
    .getByRole("textbox", { name: "Rest minutes", exact: true })
    .fill("1");
  await card
    .getByRole("textbox", { name: "Rest seconds", exact: true })
    .fill("30");
  await page.getByRole("button", { name: "Save workout", exact: true }).click();
  await expect(page).toHaveURL(/\/fitness$/);
  const saved = await (
    await page.request.get(`/api/v1/strength-plans/${plan.id}`)
  ).json();
  expect(saved.exercises[0]).toMatchObject({
    notes: "Keep this note",
    intentTags: ["technique"],
  });
  expect(saved.exercises[0].sets).toMatchObject([
    {
      measurementOverride: null,
      targetReps: 6,
      targetDurationSeconds: null,
      restSeconds: 90,
    },
    {
      measurementOverride: null,
      targetReps: 6,
      targetDurationSeconds: null,
      restSeconds: null,
    },
  ]);
  await page.goto(`/fitness/workout/${plan.id}`);
  await expect(
    card.getByRole("button", { name: "Advanced editor", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
});
