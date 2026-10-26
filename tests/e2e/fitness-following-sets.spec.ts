import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("numeric replacement, selective copying and mixed summaries survive saving", async ({
  page,
}, info) => {
  await page.request.post("/api/auth/sign-up/email", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      name: "Following sets",
      email: `following-${randomUUID()}@example.com`,
      password: "Synthetic-following-password-123",
    },
  });
  const write = async (path: string, data: object) => {
    const response = await page.request.post(`/api/v1/${path}`, {
      headers: {
        Origin: "http://localhost:3100",
        "Idempotency-Key": randomUUID(),
      },
      data,
    });
    expect(response.ok()).toBe(true);
    return response.json();
  };
  const mixed = await write("exercises", { name: "Mixed practice" });
  const entry = await write("exercises", { name: "Target entry" });
  const plan = await write("strength-plans", {
    title: "Following sets",
    exercises: [
      {
        exerciseId: mixed.id,
        notes: "Keep exercise notes",
        sets: [
          { measurementOverride: "duration", targetDurationSeconds: 45 },
          { targetReps: 8, targetDurationSeconds: 999, restSeconds: 0 },
          { targetReps: 12, targetWeightKg: 80, restSeconds: 30 },
          { targetReps: 10, targetWeightKg: 100, restSeconds: 60 },
          {
            measurementOverride: "laps_duration",
            targetDurationSeconds: 90,
            targetLaps: 2,
            restSeconds: 42,
          },
        ],
      },
      {
        exerciseId: entry.id,
        loggingType: "reps_distance_laps_duration_load",
        sets: Array.from({ length: 2 }, () => ({
          targetReps: 12,
          targetWeightKg: 100,
          targetDurationSeconds: 60,
          targetDistanceMeters: 1500,
          targetLaps: 4,
        })),
      },
    ],
  });
  await page.goto(`/fitness/workout/${plan.id}`);
  const cards = page.locator(".fitness-compact-exercise");
  const mixedCard = cards.nth(0),
    entryCard = cards.nth(1);
  await expect(
    page.getByRole("button", { name: /^Expand .* exercise$/ }),
  ).toHaveCount(2);
  await mixedCard
    .getByRole("button", {
      name: "Expand Mixed practice exercise",
      exact: true,
    })
    .click();
  await entryCard
    .getByRole("button", { name: "Expand Target entry exercise", exact: true })
    .click();
  const sets = mixedCard.locator(
    ".fitness-workout-set-list > [data-reorder-item]",
  );
  const summary = mixedCard.locator(".fitness-exercise-target-summary");
  await expect(summary).toHaveText("1×45s / 1×8 / 1×12 | 80 kg / + 2 sets");
  await summary.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: info.outputPath("mixed-summary.png"),
    fullPage: true,
  });
  await expect(
    sets.nth(0).getByRole("button", {
      name: "Edit rest after set 1: Rest as needed",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    sets.nth(1).getByRole("button", {
      name: "Edit rest after set 2: No rest",
      exact: true,
    }),
  ).toBeVisible();
  const openCopy = (index: number) =>
    sets.nth(index).getByRole("button", {
      name: `Apply set ${index + 1} to following sets`,
      exact: true,
    });
  await openCopy(1).click();
  const menu = page.getByRole("menu", {
    name: "Apply set 2 to following sets",
    exact: true,
  });
  await expect(menu.getByRole("menuitem").first()).toBeFocused();
  await page.screenshot({
    path: info.outputPath("copy-menu.png"),
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(openCopy(1)).toBeFocused();
  await openCopy(1).click();
  await menu
    .getByRole("menuitem", {
      name: "Apply filled targets to following sets",
      exact: true,
    })
    .click();
  await expect(
    sets.nth(2).getByLabel("Target reps", { exact: true }),
  ).toHaveValue("8");
  await expect(
    sets.nth(3).getByLabel("Target reps", { exact: true }),
  ).toHaveValue("8");
  await expect(
    sets.nth(2).getByLabel("Target load (kg)", { exact: true }),
  ).toHaveValue("80");
  await expect(
    sets.nth(3).getByLabel("Target load (kg)", { exact: true }),
  ).toHaveValue("100");
  await expect(
    sets.nth(4).getByLabel("Target duration (minutes)", { exact: true }),
  ).toHaveValue("1");
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Targets applied to 2 following sets." }),
  ).toBeVisible();
  await openCopy(1).click();
  await expect(
    menu.getByRole("menuitem", {
      name: "Apply filled targets to following sets",
      exact: true,
    }),
  ).toBeDisabled();
  await menu
    .getByRole("menuitem", {
      name: "Apply rest to following sets",
      exact: true,
    })
    .click();
  await expect(
    sets.nth(2).getByRole("button", {
      name: "Edit rest after set 3: No rest",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    sets.nth(3).getByRole("button", {
      name: "Edit rest after set 4: No rest",
      exact: true,
    }),
  ).toBeVisible();
  await openCopy(0).click();
  await page
    .getByRole("menuitem", {
      name: "Apply rest to following sets",
      exact: true,
    })
    .click();
  await expect(
    sets.nth(3).getByRole("button", {
      name: "Edit rest after set 4: Rest as needed",
      exact: true,
    }),
  ).toBeVisible();
  const firstRest = sets.nth(0).locator(".fitness-rest-between-sets");
  await firstRest.getByRole("button").click();
  await firstRest.getByLabel("Rest minutes", { exact: true }).fill("1");
  await firstRest.getByLabel("Rest seconds", { exact: true }).fill("15");
  await firstRest.getByLabel("Rest seconds", { exact: true }).press("Enter");
  await openCopy(0).click();
  await page
    .getByRole("menuitem", {
      name: "Apply rest to following sets",
      exact: true,
    })
    .click();
  await expect(
    sets.nth(3).getByRole("button", {
      name: "Edit rest after set 4: Rest 1m 15s",
      exact: true,
    }),
  ).toBeVisible();
  await expect(openCopy(4)).toBeDisabled();
  await expect(sets.nth(4).locator(".fitness-rest-between-sets")).toHaveCount(
    0,
  );
  // Click entry and keyboard entry replace existing digits in every target type.
  const labels = [
    "Target reps",
    "Target load (kg)",
    "Target duration (seconds)",
    "Target distance (km)",
    "Target laps",
  ];
  const values = ["8", "80", "45", "2.25", "2"];
  const quick = entryCard.locator(".fitness-quick-targets");
  await expect(quick.locator(".fitness-rest-summary")).toHaveText(
    "Rest as needed",
  );
  await quick.getByLabel("Target duration (minutes)", { exact: true }).fill("");
  for (let i = 0; i < labels.length; i++) {
    const input = quick.getByLabel(labels[i]!, { exact: true });
    await input.click();
    await input.pressSequentially(values[i]!);
    await expect(input).toHaveValue(values[i]!);
  }
  await quick.getByLabel("Target reps", { exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(
    quick.getByLabel("Target load (kg)", { exact: true }),
  ).toBeFocused();
  await page.keyboard.type("85");
  await expect(
    quick.getByLabel("Target load (kg)", { exact: true }),
  ).toHaveValue("85");
  await entryCard
    .getByRole("button", { name: "Advanced editor", exact: true })
    .click();
  const entrySets = entryCard.locator(
    ".fitness-workout-set-list > [data-reorder-item]",
  );
  const advancedReps = entrySets
    .nth(1)
    .getByLabel("Target reps", { exact: true });
  await advancedReps.click();
  await advancedReps.pressSequentially("6");
  await expect(advancedReps).toHaveValue("6");
  await expect(
    entrySets.nth(0).getByLabel("Target reps", { exact: true }),
  ).toHaveValue("8");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await mixedCard.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: info.outputPath("following-sets.png"),
    fullPage: true,
  });
  await page.reload();
  await expect(
    page.getByRole("button", { name: /^Expand .* exercise$/ }),
  ).toHaveCount(2);
  await mixedCard
    .getByRole("button", {
      name: "Expand Mixed practice exercise",
      exact: true,
    })
    .click();
  await expect(summary).toHaveText("1×45s / 1×8 / 1×8 | 80 kg / + 2 sets");
  await expect(
    sets.nth(3).getByRole("button", {
      name: "Edit rest after set 4: Rest 1m 15s",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save workout", exact: true }).click();
  await expect(page).toHaveURL(/\/fitness$/);
  const saved = await (
    await page.request.get(`/api/v1/strength-plans/${plan.id}`)
  ).json();
  expect(saved.exercises[0].notes).toBe("Keep exercise notes");
  expect(
    saved.exercises[0].sets.map(
      (set: { restSeconds: number | null }) => set.restSeconds,
    ),
  ).toEqual([75, 75, 75, 75, 42]);
  expect(saved.exercises[0].sets[1]).toMatchObject({
    targetReps: 8,
    targetWeightKg: null,
    targetDurationSeconds: 999,
  });
  expect(saved.exercises[0].sets[2]).toMatchObject({
    targetReps: 8,
    targetWeightKg: 80,
  });
  expect(saved.exercises[0].sets[4]).toMatchObject({
    measurementOverride: "laps_duration",
    targetDurationSeconds: 90,
    targetLaps: 2,
  });
  expect(saved.exercises[1].sets[1]).toMatchObject({
    targetReps: 6,
    targetWeightKg: 85,
    targetDurationSeconds: 45,
    targetDistanceMeters: 2250,
    targetLaps: 2,
  });
});
