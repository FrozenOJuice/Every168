import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("sets inherit defaults or keep independent measurements through recovery and training", async ({
  page,
}, info) => {
  await page.request.post("/api/auth/sign-up/email", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      name: "Set measurements",
      email: `set-${randomUUID()}@example.com`,
      password: "Synthetic-set-password-123",
    },
  });
  const write = async (path: string, data: object, version?: number) => {
    const r = await page.request.post(`/api/v1/${path}`, {
      headers: {
        Origin: "http://localhost:3100",
        "Idempotency-Key": randomUUID(),
        ...(version ? { "If-Match": `"${version}"` } : {}),
      },
      data,
    });
    expect(r.ok()).toBe(true);
    return r.json();
  };
  const exercise = await write("exercises", { name: "Set practice" });
  const plan = await write("strength-plans", {
    title: "Set practice",
    exercises: [
      {
        exerciseId: exercise.id,
        sets: [{ targetReps: 8 }, { targetReps: 10 }],
      },
    ],
  });
  await page.goto(`/fitness/workout/${plan.id}`);
  await page
    .getByRole("button", { name: "Expand Set practice exercise", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Reset to basic", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  const sets = page.locator(".fitness-workout-set-list > [data-reorder-item]");
  const first = sets.nth(0),
    second = sets.nth(1);
  const configure = first.getByRole("button", {
    name: "Measurements for set 1",
    exact: true,
  });
  const configureDefaults = page.getByRole("button", {
    name: "Configure measurements for Set practice",
    exact: true,
  });
  await expect(
    page.locator(".fitness-card-measurements fieldset"),
  ).toBeHidden();
  await configureDefaults.click();
  await expect(configureDefaults).toHaveAttribute("aria-expanded", "true");
  await expect(configure).toHaveAttribute("data-custom", "false");
  await expect(configure).toHaveAccessibleDescription(
    "Uses exercise measurements",
  );
  await configure.click();
  const selection = first.getByRole("group", {
    name: "Measurements for set 1",
    exact: true,
  });
  await selection
    .getByRole("checkbox", { name: "Duration", exact: true })
    .check();
  await expect(configure).toHaveAttribute("data-custom", "true");
  await expect(configure).toHaveAccessibleDescription(
    "This set uses custom measurements",
  );
  const firstReps = (await first
    .getByLabel("Target reps", { exact: true })
    .boundingBox())!;
  const firstLoad = (await first
    .getByLabel("Target weight (kg)", { exact: true })
    .boundingBox())!;
  const duration = (await first
    .getByLabel("Target duration (seconds)", { exact: true })
    .boundingBox())!;
  await expect(second.locator('[data-measurement="duration"]')).toHaveCount(0);
  await expect(second.locator(".fitness-set-measurement-slot")).toHaveCount(2);
  if (info.project.name === "phone") {
    expect(duration.y).toBeGreaterThan(firstReps.y + firstReps.height);
    expect(duration.x).toBeCloseTo(firstReps.x, 0);
  } else {
    expect(duration.y).toBeCloseTo(firstReps.y, 0);
    expect(duration.x).toBeGreaterThan(firstLoad.x);
  }
  await configure.click();
  await expect(selection).toBeHidden();
  await expect(configure).toHaveAttribute("data-custom", "true");
  if (info.project.name === "desktop") {
    await page
      .getByRole("heading", { name: "Set practice", exact: true })
      .hover();
    await configure.hover();
    await expect(
      page.getByRole("tooltip", {
        name: "Custom measurements · Add or remove measurements",
        exact: true,
      }),
    ).toBeVisible();
  }
  await configure.click();
  await selection
    .getByRole("checkbox", { name: "Reps", exact: true })
    .uncheck();
  await expect(first.locator('[data-measurement="reps"]')).toHaveCount(0);
  await selection
    .getByRole("checkbox", { name: "Weight", exact: true })
    .uncheck();
  await first
    .getByLabel("Target duration (seconds)", { exact: true })
    .fill("45");
  await expect(
    second.getByLabel("Target duration (seconds)", { exact: true }),
  ).toHaveCount(0);
  const defaults = page.getByRole("group", {
    name: "Configure measurements for Set practice",
    exact: true,
  });
  await selection.getByRole("checkbox", { name: "Reps", exact: true }).check();
  await selection
    .getByRole("checkbox", { name: "Weight", exact: true })
    .check();
  await selection
    .getByRole("checkbox", { name: "Duration", exact: true })
    .uncheck();
  await expect(
    first.getByRole("button", { name: "Use exercise defaults", exact: true }),
  ).toBeDisabled();
  await expect(configure).toHaveAttribute("data-custom", "false");
  await defaults.getByRole("checkbox", { name: "Laps", exact: true }).check();
  await expect(first.getByLabel("Target laps", { exact: true })).toBeVisible();
  await selection
    .getByRole("checkbox", { name: "Duration", exact: true })
    .check();
  await selection
    .getByRole("checkbox", { name: "Reps", exact: true })
    .uncheck();
  await selection
    .getByRole("checkbox", { name: "Weight", exact: true })
    .uncheck();
  await selection
    .getByRole("checkbox", { name: "Laps", exact: true })
    .uncheck();
  await expect(
    first.getByLabel("Target duration (seconds)", { exact: true }),
  ).toHaveValue("45");
  await expect(second.getByLabel("Target laps", { exact: true })).toBeVisible();
  await expect(first.getByLabel("Target laps", { exact: true })).toHaveCount(0);
  const reset = first.getByRole("button", {
    name: "Use exercise defaults",
    exact: true,
  });
  if (info.project.name === "desktop") {
    await reset.hover();
    const tooltip = page.getByRole("tooltip", {
      name: "Reset to exercise measurements",
      exact: true,
    });
    await expect(tooltip).toBeVisible();
    await tooltip.hover();
    await expect(tooltip).toBeVisible();
    const box = await tooltip.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  }
  await reset.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(reset).toBeFocused();
  await expect(
    page.getByRole("tooltip", {
      name: "Reset to exercise measurements",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("measurement-tooltip.png"),
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await expect(selection).toBeVisible();
  await reset.click();
  await expect(configure).toHaveAttribute("data-custom", "false");
  await expect(first.getByLabel("Target reps", { exact: true })).toHaveValue(
    "8",
  );
  await selection
    .getByRole("checkbox", { name: "Duration", exact: true })
    .check();
  await expect(
    first.getByLabel("Target duration (seconds)", { exact: true }),
  ).toHaveValue("45");
  await selection
    .getByRole("checkbox", { name: "Reps", exact: true })
    .uncheck();
  await selection
    .getByRole("checkbox", { name: "Weight", exact: true })
    .uncheck();
  await selection
    .getByRole("checkbox", { name: "Laps", exact: true })
    .uncheck();
  await configure.click();
  await page.reload();
  await page
    .getByRole("button", { name: "Expand Set practice exercise", exact: true })
    .click();
  await expect(configure).toHaveAttribute("data-custom", "true");
  await expect(configureDefaults).toHaveAttribute("aria-expanded", "false");
  await expect(
    page.getByRole("button", { name: "Reset to basic", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(
    first.getByLabel("Target duration (seconds)", { exact: true }),
  ).toHaveValue("45");
  await expect(first.getByLabel("Target reps", { exact: true })).toHaveCount(0);
  await expect(second.getByLabel("Target laps", { exact: true })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await first.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: info.outputPath("per-set-measurements.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Save workout", exact: true }).click();
  await expect(page).toHaveURL(/\/fitness$/);
  const saved = await (
    await page.request.get(`/api/v1/strength-plans/${plan.id}`)
  ).json();
  expect(saved.exercises[0].sets[0]).toMatchObject({
    measurementOverride: "duration",
    targetDurationSeconds: 45,
    targetReps: 8,
  });
  expect(saved.exercises[0].sets[1].measurementOverride).toBeNull();
  const session = await write(
    `strength-plans/${plan.id}/begin`,
    { startedAt: new Date().toISOString() },
    saved.version,
  );
  await page.goto(`/fitness/session/${session.id}`);

  const active = page.getByRole("region", { name: "Current set", exact: true });

  await expect(
    active.getByLabel("Actual duration (seconds)", { exact: true }),
  ).toHaveValue("45");
  await expect(active.getByLabel("Actual reps", { exact: true })).toHaveCount(
    0,
  );
  await active
    .getByLabel("Actual duration (seconds)", { exact: true })
    .fill("40");
  await expect(page.locator(".fitness-save-state")).toHaveText("Saved");
});
