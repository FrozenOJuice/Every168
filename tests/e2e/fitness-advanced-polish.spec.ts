import { randomUUID } from "node:crypto";
import { expect, test, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.use({ actionTimeout: 10000 });

test("Advanced copies set units, keeps phone values readable and contains its focus ring", async ({
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
    name: "Advanced polish",
    email: `advanced-polish-${randomUUID()}@example.com`,
    password: "Synthetic-advanced-password-123",
  });
  const exercise = await post("/api/v1/exercises", {
    name: "Advanced press",
    loggingType: "reps_load",
  });
  const plan = await post("/api/v1/strength-plans", {
    title: "Advanced polish",
    exercises: [
      {
        exerciseId: exercise.id,
        loggingType: "reps_load",
        sets: [
          { targetReps: 12, targetWeightKg: 50, restSeconds: 90 },
          { targetReps: 8, targetWeightKg: 60, restSeconds: 90 },
          {
            targetReps: 6,
            targetWeightKg: 125.5,
            targetDurationSeconds: 100,
            targetDistanceMeters: 1200,
            targetLaps: 3,
            measurementOverride: "reps_distance_laps_duration_load",
          },
        ],
      },
    ],
  });
  if (info.project.name === "phone")
    await page.setViewportSize({ width: 320, height: 844 });
  await page.goto(`/fitness/workout/${plan.id}`);
  const card = page.getByRole("region", {
    name: "Advanced press exercise 1",
    exact: true,
  });
  await card
    .getByRole("button", {
      name: "Expand Advanced press exercise",
      exact: true,
    })
    .click();
  const reset = card.getByRole("button", {
    name: "Reset to basic",
    exact: true,
  });
  await expect(reset).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(reset).toHaveCSS("border-color", "rgb(223, 227, 220)");
  const sets = card.getByRole("group", { name: /^Set \d+$/ });
  const source = sets.nth(2);
  const choose = async (row: Locator, label: string, unit: string) => {
    await row.getByRole("button", { name: label, exact: true }).click();
    await page
      .getByRole("listbox", { name: label, exact: true })
      .getByRole("option", { name: unit, exact: true })
      .click();
  };
  await choose(source, "Target weight unit", "lb");
  await choose(source, "Target distance unit", "m");
  await choose(source, "Target duration unit", "hr");
  const addSet = card.getByRole("button", { name: "Add set", exact: true });
  await expect(addSet).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(addSet).toHaveCSS("border-style", "solid");
  const addBox = (await addSet.boundingBox())!;
  expect(addBox.height).toBeGreaterThanOrEqual(44);
  expect(addBox.x).toBeCloseTo(
    (await card.locator(".fitness-workout-set-list").boundingBox())!.x,
    0,
  );
  await addSet.click();
  await expect(sets).toHaveCount(4);
  const added = sets.nth(3);
  const verifyUnits = async () => {
    for (const [label, unit] of [
      ["Target weight unit", "lb"],
      ["Target distance unit", "m"],
      ["Target duration unit", "hr"],
    ])
      await expect(
        added.getByRole("button", { name: label, exact: true }),
      ).toHaveText(unit!);
    await expect(
      added.getByLabel("Target weight (lb)", { exact: true }),
    ).toHaveValue(
      await source
        .getByLabel("Target weight (lb)", { exact: true })
        .inputValue(),
    );
    await expect(
      added.getByLabel("Target distance (m)", { exact: true }),
    ).toHaveValue("1200");
    await expect(
      added.getByLabel("Target duration (hours)", { exact: true }),
    ).toHaveValue("0.028");
  };
  await verifyUnits();
  await added
    .getByRole("button", { name: "Remove set 4", exact: true })
    .click();
  await expect(sets).toHaveCount(3);
  await page
    .locator(".app-toast")
    .getByRole("button", { name: "Undo", exact: true })
    .click();
  await expect(sets).toHaveCount(4);
  await verifyUnits();
  const weight = added.getByLabel("Target weight (lb)", { exact: true });
  const control = weight.locator("..");
  await weight.click();
  await expect(weight).toBeFocused();
  const focus = await control.evaluate((node) => {
    const css = getComputedStyle(node, "::after");
    return {
      offset: css.top,
      width: css.borderTopWidth,
      style: css.borderTopStyle,
    };
  });
  expect(focus).toEqual({ offset: "-4px", width: "3px", style: "solid" });
  if (info.project.name === "phone") {
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      for (const label of [
        "Target weight (lb)",
        "Target distance (m)",
        "Target duration (hours)",
      ])
        expect(
          (await added.getByLabel(label, { exact: true }).boundingBox())!.width,
        ).toBeGreaterThan(130);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
  await control.scrollIntoViewIfNeeded();
  const box = (await control.boundingBox())!;
  await page.screenshot({
    path: info.outputPath("advanced-focus-ring.png"),
    clip: {
      x: box.x - 5,
      y: box.y - 5,
      width: box.width + 10,
      height: box.height + 10,
    },
  });
  await page.screenshot({ path: info.outputPath("advanced-fields.png") });
  await added
    .getByRole("button", { name: "Target weight unit", exact: true })
    .focus();
  expect(
    await control.evaluate(
      (node) => getComputedStyle(node, "::after").borderTopWidth,
    ),
  ).toBe("3px");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Save workout", exact: true }).click();
  await expect(page).toHaveURL(/\/fitness$/);
  const saved = await (
    await page.request.get(`/api/v1/strength-plans/${plan.id}`)
  ).json();
  expect(saved.exercises[0].sets[3]).toMatchObject({
    targetWeightKg: 125.5,
    targetDistanceMeters: 1200,
    targetDurationSeconds: 100,
    targetLaps: 3,
  });
});
