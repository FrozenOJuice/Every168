import { randomUUID } from "node:crypto";
import { expect, test, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.use({ reducedMotion: "reduce", actionTimeout: 10000 });

test("measurement placement, duration units and steppers stay consistent", async ({
  page,
}, info) => {
  const chooseUnit = async (control: Locator, value: string) => {
    await control.click();
    await page
      .getByRole("option", {
        name: ({ s: "sec", h: "hr" } as Record<string, string>)[value] ?? value,
        exact: true,
      })
      .click();
  };
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
    name: "Measurements",
    email: `controls-${randomUUID()}@example.com`,
    password: "Synthetic-controls-password-123",
  });
  const exercise = await post("/api/v1/exercises", {
    name: "Practice",
    loggingType: "reps_load",
  });
  const timing = await post("/api/v1/exercises", {
    name: "Timing",
    loggingType: "duration",
  });
  const plan = await post("/api/v1/strength-plans", {
    title: "Measurement controls",
    exercises: [
      {
        exerciseId: exercise.id,
        sets: [
          { targetReps: 8, targetWeightKg: 20 },
          {
            targetReps: 10,
            targetWeightKg: 30,
            measurementOverride: "reps_duration_load",
            targetDurationSeconds: 5400,
          },
        ],
      },
      {
        exerciseId: timing.id,
        sets: [{ targetDurationSeconds: 90 }, { targetDurationSeconds: 90 }],
      },
      {
        exerciseId: exercise.id,
        sets: Array.from({ length: 3 }, () => ({
          targetReps: 12,
          targetWeightKg: 20,
        })),
      },
    ],
  });
  await page.goto(`/fitness/workout/${plan.id}`);
  const card = page.getByRole("region", {
    name: "Practice exercise 1",
    exact: true,
  });
  const timer = page.getByRole("region", {
    name: "Timing exercise 2",
    exact: true,
  });
  await card
    .getByRole("button", { name: "Expand Practice exercise", exact: true })
    .click();
  const summary = card.locator(".fitness-exercise-target-summary:visible");
  await summary.click();
  await expect(
    card.getByRole("button", { name: "Expand Practice exercise", exact: true }),
  ).toBeVisible();
  await summary.click();
  const rows = card.getByRole("group", { name: /^Set \d+$/ });
  const second = rows.nth(1);
  const duration = second.getByRole("spinbutton", {
    name: /^Target duration \(/,
  });
  const unit = second.getByRole("button", {
    name: "Target duration unit",
    exact: true,
  });
  await expect(duration).toHaveValue("1.5");
  await expect(unit).toHaveText("hr");
  await unit.focus();
  await unit.press("ArrowDown");
  await expect(
    page.getByRole("listbox", { name: "Target duration unit" }),
  ).toBeVisible();
  await page
    .getByRole("listbox", { name: "Target duration unit" })
    .press("Escape");
  await expect(unit).toBeFocused();
  const actionHeight = await second
    .locator(".fitness-set-actions > button")
    .first()
    .evaluate((el) => el.getBoundingClientRect().height);
  const inputHeight = await duration
    .locator("..")
    .evaluate((el) => el.getBoundingClientRect().height);
  expect(Math.abs(actionHeight - inputHeight)).toBeLessThanOrEqual(1);

  await chooseUnit(unit, "min");
  await expect(duration).toHaveValue("90");
  await chooseUnit(unit, "s");
  await expect(duration).toHaveValue("5400");
  await duration.fill("60");
  await chooseUnit(unit, "h");
  await expect(duration).toHaveValue("0.017");
  await chooseUnit(unit, "s");
  await expect(duration).toHaveValue("60");
  await duration.fill("");
  await chooseUnit(unit, "min");
  await expect(duration).toBeEmpty();
  await duration.fill("0");
  await chooseUnit(unit, "s");
  await expect(duration).toHaveValue("0");
  await chooseUnit(unit, "h");
  await duration.fill("1.5");

  // Custom measurements do not reserve empty slots in other sets.
  await expect(
    rows.nth(0).locator(".fitness-set-measurement-slot"),
  ).toHaveCount(2);
  await expect(
    rows.nth(0).locator('[data-measurement="duration"]'),
  ).toHaveCount(0);
  await expect(second.locator(".fitness-set-measurement-slot")).toHaveCount(3);
  // Both kinds of measurement use the same row and ordering.
  const selectedSlots = second.locator(
    '.fitness-set-measurement-slot:not([aria-hidden="true"])',
  );
  expect(
    await selectedSlots.evaluateAll((slots) =>
      slots.map((slot) => slot.getAttribute("data-measurement")),
    ),
  ).toEqual(["reps", "load", "duration"]);
  if (info.project.name === "desktop") {
    const topEdges = await selectedSlots.evaluateAll((slots) =>
      slots.map((slot) => slot.getBoundingClientRect().top),
    );
    expect(Math.max(...topEdges) - Math.min(...topEdges)).toBeLessThan(2);
  }
  await card
    .getByRole("button", {
      name: "Configure measurements for Practice",
      exact: true,
    })
    .click();
  await card
    .getByRole("group", {
      name: "Configure measurements for Practice",
      exact: true,
    })
    .getByRole("checkbox", { name: "Duration", exact: true })
    .check();
  const firstDurationSlot = rows
    .nth(0)
    .locator('[data-measurement="duration"]');
  const secondDurationSlot = second.locator('[data-measurement="duration"]');
  expect(
    Math.abs(
      (await firstDurationSlot.boundingBox())!.x -
        (await secondDurationSlot.boundingBox())!.x,
    ),
  ).toBeLessThan(2);
  await expect(duration).toHaveValue("1.5");
  await card
    .getByRole("button", {
      name: "Configure measurements for Practice",
      exact: true,
    })
    .click();

  // Local distance/load selectors convert without changing other sets or defaults.
  await rows
    .nth(0)
    .getByRole("button", { name: "Measurements for set 1", exact: true })
    .click();
  await rows
    .nth(0)
    .getByRole("checkbox", { name: "Distance", exact: true })
    .check();
  await rows
    .nth(0)
    .getByRole("button", { name: "Measurements for set 1", exact: true })
    .click();
  await expect(second.locator('[data-measurement="distance"]')).toHaveCount(0);
  const distance = rows
    .nth(0)
    .getByRole("spinbutton", { name: /^Target distance \(/ });
  const distanceUnit = rows
    .nth(0)
    .getByRole("button", { name: "Target distance unit", exact: true });
  await distance.fill("1.25");
  await chooseUnit(distanceUnit, "m");
  await expect(distance).toHaveValue("1250");
  await expect(card.locator(".fitness-summary-full")).toContainText("1,250 m");
  await distance.fill("750");
  await chooseUnit(distanceUnit, "km");
  await expect(distance).toHaveValue("0.75");
  const loadUnit = rows
    .nth(0)
    .getByRole("button", { name: "Target weight unit", exact: true });
  await chooseUnit(loadUnit, "lb");
  await expect(
    rows.nth(0).getByLabel("Target weight (lb)", { exact: true }),
  ).toHaveValue("44.09");
  await expect(card.locator(".fitness-summary-full")).toContainText("44.09 lb");
  await expect(
    second.getByRole("button", { name: "Target weight unit", exact: true }),
  ).toHaveText("kg");
  await chooseUnit(loadUnit, "kg");
  await expect(
    rows.nth(0).getByLabel("Target weight (kg)", { exact: true }),
  ).toHaveValue("20");
  await expect(
    distance
      .locator("..")
      .getByRole("button", { name: "Target distance unit" }),
  ).toHaveText("km");
  await expect(
    duration
      .locator("..")
      .getByRole("button", { name: "Target duration unit" }),
  ).toHaveText("hr");
  if (info.project.name === "desktop") {
    expect(
      await duration.evaluate((el) => el.getBoundingClientRect().width),
    ).toBeGreaterThanOrEqual(60);
  }
  const reps = second.getByLabel("Target reps", { exact: true });
  const arrows = second.locator(".fitness-number-arrows");
  if (info.project.name === "phone") {
    await expect(arrows.first()).toBeHidden();
    await reps.focus();
    await reps.press("ArrowUp");
    await expect(reps).toHaveValue("11");
    await reps.press("ArrowDown");
  } else {
    await second
      .getByRole("button", { name: "Increase Target reps", exact: true })
      .click();
    await expect(reps).toHaveValue("11");
    await second
      .getByRole("button", { name: "Decrease Target reps", exact: true })
      .click();
    const wrapper = (await reps.locator("..").boundingBox())!;
    const arrowBox = (await arrows.first().boundingBox())!;
    expect(
      Math.abs(wrapper.x + wrapper.width - arrowBox.x - arrowBox.width),
    ).toBeLessThan(2);
  }
  await expect(reps).toHaveValue("10");
  await second.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("advanced-measurements.png") });

  await timer
    .getByRole("button", { name: "Expand Timing exercise", exact: true })
    .click();
  const basicDuration = timer.getByRole("spinbutton", {
    name: /^Target duration \(/,
  });
  const basicUnit = timer.getByRole("button", {
    name: "Target duration unit",
    exact: true,
  });
  await expect(basicDuration).toHaveValue("1.5");
  await expect(basicUnit).toHaveText("min");
  await chooseUnit(basicUnit, "h");
  await expect(basicDuration).toHaveValue("0.025");
  await basicDuration.fill("2.25");
  await chooseUnit(basicUnit, "min");
  await expect(basicDuration).toHaveValue("135");
  await chooseUnit(basicUnit, "s");
  await expect(basicDuration).toHaveValue("8100");
  await expect(
    timer.locator(".fitness-exercise-target-summary:visible"),
  ).toContainText("8,100 s");
  const basicLoadCard = page.getByRole("region", {
    name: "Practice exercise 3",
    exact: true,
  });
  await basicLoadCard
    .getByRole("button", { name: "Expand Practice exercise", exact: true })
    .click();
  const basicLoadUnit = basicLoadCard.getByRole("button", {
    name: "Target weight unit",
    exact: true,
  });
  await chooseUnit(basicLoadUnit, "lb");
  await expect(
    basicLoadCard.locator(".fitness-exercise-target-summary:visible"),
  ).toHaveText("3×12 | 44.09 lb");
  await basicLoadCard
    .getByRole("spinbutton", { name: "Target weight (lb)", exact: true })
    .fill("225");
  await basicLoadCard
    .getByRole("button", { name: "Collapse Practice exercise", exact: true })
    .click();
  await expect(
    basicLoadCard.locator(".fitness-exercise-target-summary:visible"),
  ).toHaveText("3×12 | 225 lb");
  await page.screenshot({ path: info.outputPath("basic-duration.png") });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Save workout", exact: true }).click();
  await expect(page).toHaveURL(/\/fitness$/);
  const saved = await (
    await page.request.get(`/api/v1/strength-plans/${plan.id}`)
  ).json();
  expect(saved.exercises[2].sets[0].targetWeightKg).toBeCloseTo(
    225 * 0.45359237,
    6,
  );
  expect(saved.exercises[0].sets[0]).toMatchObject({
    targetDurationSeconds: null,
    targetDistanceMeters: 750,
    targetWeightKg: 20,
  });
  expect(saved.exercises[0].sets[1]).toMatchObject({
    targetDurationSeconds: 5400,
    targetReps: 10,
    targetWeightKg: 30,
    measurementOverride: null,
  });
  expect(
    saved.exercises[1].sets.map(
      (set: { targetDurationSeconds: number }) => set.targetDurationSeconds,
    ),
  ).toEqual([8100, 8100]);
});
