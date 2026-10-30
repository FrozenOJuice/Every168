import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("numeric replacement, adding sets and mixed summaries survive saving", async ({
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
  const summary = mixedCard.locator(".fitness-exercise-target-summary:visible");
  const phone = info.project.name === "phone";
  await expect(summary).toHaveText(
    phone ? "5 sets · Mixed targets" : "1×45s / 1×8 / 1×12 | 80 kg / + 2 sets",
  );
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
  await expect(
    mixedCard.getByRole("button", { name: "Copy between sets", exact: true }),
  ).toHaveCount(0);
  await mixedCard.getByRole("button", { name: "Add set", exact: true }).click();
  await expect(sets).toHaveCount(6);
  await expect(
    sets.nth(5).getByLabel("Target duration (minutes)", { exact: true }),
  ).toHaveValue("1.5");
  await expect(
    sets.nth(5).getByLabel("Target laps", { exact: true }),
  ).toHaveValue("2");
  // Click entry and keyboard entry replace existing digits in every target type.
  const labels = [
    "Target reps",
    "Target weight (kg)",
    "Target duration (seconds)",
    "Target distance (km)",
    "Target laps",
  ];
  const values = ["8", "80", "45", "2.25", "2"];
  const quick = entryCard.locator(".fitness-quick-targets");
  await expect(quick.locator(".fitness-rest-summary")).toHaveText(
    "Rest as needed",
  );
  await quick
    .getByRole("button", { name: "Target duration unit", exact: true })
    .click();
  await page.getByRole("option", { name: "sec", exact: true }).click();
  for (let i = 0; i < labels.length; i++) {
    const input = quick.getByLabel(labels[i]!, { exact: true });
    await input.click();
    await input.pressSequentially(values[i]!);
    await expect(input).toHaveValue(values[i]!);
  }
  await quick.getByLabel("Target reps", { exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(
    quick.getByLabel("Target weight (kg)", { exact: true }),
  ).toBeFocused();
  await page.keyboard.type("85");
  await expect(
    quick.getByLabel("Target weight (kg)", { exact: true }),
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
  if (phone) {
    const checkLayout = async () => {
      for (const card of [mixedCard, entryCard]) {
        const list = card.locator(".fitness-workout-set-list");
        expect(
          await list.evaluate(
            (element) => element.scrollWidth <= element.clientWidth + 1,
          ),
        ).toBe(true);
        const problems = await card
          .locator(".fitness-set-editor-row")
          .evaluateAll((rows) =>
            rows.flatMap((row) => {
              const bounds = row.getBoundingClientRect();
              const actions = row
                .querySelector(".fitness-set-actions")!
                .getBoundingClientRect();
              return Array.from(
                row.querySelectorAll(".fitness-set-measurements input"),
              )
                .filter((input) => {
                  const field = input.getBoundingClientRect();
                  return (
                    field.width &&
                    (field.left < bounds.left ||
                      field.right > bounds.right + 1 ||
                      field.top < actions.bottom)
                  );
                })
                .map(
                  (input) =>
                    input.getAttribute("aria-label") ?? "clipped field",
                );
            }),
          );
        expect(problems).toEqual([]);
      }
    };
    await checkLayout();
    const assistant = page.getByRole("button", {
      name: "Ask Assistant",
      exact: true,
    });
    const assistantBox = (await assistant.boundingBox())!;
    expect(assistantBox.y + assistantBox.height).toBeLessThan(72);
    await assistant.click();
    await page
      .getByRole("button", { name: "Close quick chat", exact: true })
      .click();
    await expect(assistant).toBeFocused();
    await entrySets.nth(0).scrollIntoViewIfNeeded();
    await page.screenshot({
      path: info.outputPath("phone-all-measurements.png"),
    });
    const viewport = page.viewportSize()!;
    await page.setViewportSize({ ...viewport, width: 320 });
    await checkLayout();
    await entrySets.nth(0).scrollIntoViewIfNeeded();
    await page.screenshot({
      path: info.outputPath("phone-320-measurements.png"),
    });
    await page.setViewportSize(viewport);
  }
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
  await expect(summary).toHaveText(
    phone ? "6 sets · Mixed targets" : "1×45s / 1×8 / 1×12 | 80 kg / + 3 sets",
  );
  await expect(
    sets.nth(3).getByRole("button", {
      name: "Edit rest after set 4: Rest 1m",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save workout", exact: true }).click();
  await expect(page).toHaveURL(/\/fitness$/);
  const saved = await (
    await page.request.get(`/api/v1/strength-plans/${plan.id}`)
  ).json();
  expect(saved.exercises[0].notes).toBe("Keep exercise notes");
  expect(saved.exercises[0].sets.slice(0, 5)).toEqual(plan.exercises[0].sets);
  expect(saved.exercises[0].sets[5]).toEqual(plan.exercises[0].sets[4]);
  expect(saved.exercises[1].sets[1]).toMatchObject({
    targetReps: 6,
    targetWeightKg: 85,
    targetDurationSeconds: 45,
    targetDistanceMeters: 2250,
    targetLaps: 2,
  });
});
