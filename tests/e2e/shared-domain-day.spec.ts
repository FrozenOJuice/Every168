import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("Food and Fitness share the selected day while workouts retain their own tools", async ({
  page,
}, info) => {
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
  await page.request.post("/api/auth/sign-up/email", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      name: "Shared day",
      email: `day-${randomUUID()}@example.com`,
      password: "Synthetic-domain-password-123",
    },
  });
  const me = await (await page.request.get("/api/v1/me")).json();
  await page.request.put("/api/v1/preferences", {
    headers: {
      Origin: "http://localhost:3100",
      "Idempotency-Key": randomUUID(),
      "If-Match": `"${me.preferences.version}"`,
    },
    data: {
      timezone: "UTC",
      weekStartsOn: 1,
      weightUnit: "kg",
      distanceUnit: "km",
    },
  });
  const exercise = await write("exercises", {
    name: "Evening walk",
    loggingType: "duration",
  });
  const plan = await write("strength-plans", {
    title: "Evening walk",
    exercises: [
      { exerciseId: exercise.id, sets: [{ targetDurationSeconds: 1200 }] },
    ],
  });
  await write(
    `strength-plans/${plan.id}/schedule`,
    { startsAt: "2026-10-24T17:00:00Z", endsAt: "2026-10-24T18:00:00Z" },
    plan.version,
  );
  await write("time-blocks", {
    title: "Lunch with Alex",
    startsAt: "2026-10-24T12:00:00Z",
    endsAt: "2026-10-24T13:00:00Z",
  });
  await write("food-entries/quick", {
    food: { name: "Breakfast", servingAmount: 1, servingUnit: "serving" },
    quantity: 1,
    consumedAt: "2026-10-24T08:00:00Z",
  });
  await page.goto("/food?date=2026-10-24");
  await page.getByRole("heading", { name: "Food", exact: true }).waitFor();
  await page.clock.install({ time: new Date("2026-10-24T10:00:00Z") });
  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  await navigation.getByRole("link", { name: "Fitness", exact: true }).click();
  const mobile = info.project.name !== "desktop";
  const tabs = page.getByRole("group", { name: "Fitness side panel" });
  if (mobile)
    await tabs.getByRole("button", { name: "Day", exact: true }).click();
  const panel = mobile
    ? page.getByRole("dialog", { name: "Your day", exact: true })
    : page.getByRole("complementary", { name: "Fitness day panel" });
  await expect(
    panel.getByRole("button", { name: "October 24, 2026", exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByRole("button", { name: /Next.*Evening walk/ }),
  ).toBeVisible();
  await expect(panel.getByText("Lunch with Alex", { exact: true })).toHaveCount(
    0,
  );
  await expect(panel.getByText("Breakfast", { exact: true })).toHaveCount(0);
  await panel
    .getByRole("button", { name: "All activities", exact: true })
    .click();
  await expect(
    panel.getByRole("button", { name: /Next.*Lunch with Alex/ }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: info.outputPath("fitness-day.png"),
    fullPage: true,
  });
  if (mobile) await panel.getByRole("button", { name: "Close dialog" }).click();
  await tabs.getByRole("button", { name: "Exercises", exact: true }).click();
  await page
    .getByRole("searchbox", { name: "Find an exercise", exact: true })
    .fill("walk");
  await page.getByRole("link", { name: "Create workout", exact: true }).click();
  await page.getByLabel("Workout title", { exact: true }).fill("Keep my draft");
  await tabs.getByRole("button", { name: "Day", exact: true }).click();
  await panel.getByRole("button", { name: "Fitness", exact: true }).click();
  await panel.getByRole("button", { name: "Next day", exact: true }).click();
  if (mobile) await panel.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.getByLabel("Workout title", { exact: true })).toHaveValue(
    "Keep my draft",
  );
  await tabs.getByRole("button", { name: "Exercises", exact: true }).click();
  await expect(
    page.getByRole("searchbox", { name: "Find an exercise", exact: true }),
  ).toHaveValue("walk");
  await navigation.getByRole("link", { name: "Food", exact: true }).click();
  if (mobile)
    await page.getByRole("button", { name: "Day", exact: true }).click();
  const food = mobile
    ? page.getByRole("dialog", { name: "Your day", exact: true })
    : page.getByRole("complementary", { name: "Food day panel" });
  await expect(
    food.getByRole("button", { name: "October 25, 2026", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.clock.setFixedTime(new Date());
  await page.goto("/fitness/programs/new?date=2026-10-24");
  await page
    .getByLabel("Program name", { exact: true })
    .fill("Unsaved program");
  if (mobile)
    await tabs.getByRole("button", { name: "Day", exact: true }).click();
  page.once("dialog", (dialog) => dialog.dismiss());
  await panel.getByRole("button", { name: /Next.*Evening walk/ }).click();
  await expect(panel).toBeVisible();
  if (mobile) await panel.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.getByLabel("Program name", { exact: true })).toHaveValue(
    "Unsaved program",
  );
  await expect(page).toHaveURL(/\/fitness\/programs\/new/);
  await page.getByLabel("Program name", { exact: true }).fill("");
  await navigation.getByRole("link", { name: "Fitness", exact: true }).click();
  await tabs.getByRole("button", { name: "Exercises", exact: true }).click();
  await page
    .getByRole("button", { name: "Create exercise", exact: true })
    .click();
  await page
    .getByLabel("Exercise name", { exact: true })
    .fill("Unsaved exercise");
  await tabs.getByRole("button", { name: "Day", exact: true }).click();
  page.once("dialog", (dialog) => dialog.dismiss());
  await panel.getByRole("button", { name: /Next.*Evening walk/ }).click();
  await expect(panel).toBeVisible();
  if (mobile) await panel.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.getByLabel("Exercise name", { exact: true })).toHaveValue(
    "Unsaved exercise",
  );
});
