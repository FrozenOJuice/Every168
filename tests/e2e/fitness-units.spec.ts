import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function setup(page: Page) {
  const post = async (path: string, data: object, version?: number) => {
    const response = await page.request.post(path, {
      headers: {
        Origin: "http://localhost:3100",
        "Idempotency-Key": randomUUID(),
        ...(version ? { "If-Match": `"${version}"` } : {}),
      },
      data,
    });
    expect(response.ok()).toBe(true);
    return response.json();
  };
  await post("/api/auth/sign-up/email", {
    name: "Unit tester",
    email: `units-${randomUUID()}@example.com`,
    password: "Synthetic-unit-password-123",
  });
  const exercise = await post("/api/v1/exercises", {
    name: "Mixed measurements",
    loggingType: "distance_duration_load",
  });
  const plan = await post("/api/v1/strength-plans", {
    title: "Unit practice",
    exercises: [
      {
        exerciseId: exercise.id,
        loggingType: "distance_duration_load",
        sets: [
          {
            targetWeightKg: 100,
            targetDurationSeconds: 90,
            targetDistanceMeters: 1000,
          },
        ],
      },
    ],
  });
  return { plan, exercise, post };
}
async function choose(page: Page, label: string, name: string) {
  const dialog = page.getByRole("dialog", {
    name: "Fitness units",
    exact: true,
  });
  await dialog.getByRole("button", { name: label, exact: true }).click();
  await dialog.getByRole("option", { name, exact: true }).click();
}
test("global units convert unsaved editors, live results and history without rewriting measurements", async ({
  page,
}, info) => {
  const { plan, exercise, post } = await setup(page);
  const endpoint = `/api/v1/strength-plans/${plan.id}`;
  await page.goto(`/fitness/workout/${plan.id}`);
  await page
    .getByRole("button", {
      name: "Expand Mixed measurements exercise",
      exact: true,
    })
    .click();
  await page
    .getByLabel("Workout title", { exact: true })
    .fill("Unsaved unit practice");
  await page.getByRole("button", { name: "Units", exact: true }).click();
  await choose(page, "Load unit", "Pounds (lb)");
  await choose(page, "Distance unit", "Yards (yd)");
  await choose(page, "Duration unit", "Minutes (min)");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: info.outputPath("fitness-units.png") });
  await page.getByRole("button", { name: "Save units", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByLabel("Workout title", { exact: true })).toHaveValue(
    "Unsaved unit practice",
  );
  const load = page.getByLabel("Target load (lb)", { exact: true });
  await expect(load).toHaveValue("220.462262");
  await expect(
    page.getByLabel("Target distance (yd)", { exact: true }),
  ).toHaveValue("1093.613298");
  await expect(
    page.getByLabel("Target duration (minutes)", { exact: true }),
  ).toHaveValue("1.5");
  expect((await (await page.request.get(endpoint)).json()).version).toBe(
    plan.version,
  );
  await page.getByRole("button", { name: "Units", exact: true }).click();
  await choose(page, "Load unit", "Kilograms (kg)");
  await page.getByRole("button", { name: "Save units", exact: true }).click();
  await expect(
    page.getByLabel("Target load (kg)", { exact: true }),
  ).toHaveValue("100");
  await page.reload();
  await page
    .getByRole("button", {
      name: "Expand Mixed measurements exercise",
      exact: true,
    })
    .click();
  await expect(
    page.getByLabel("Target duration (minutes)", { exact: true }),
  ).toHaveValue("1.5");
  await page.getByLabel("Target distance (yd)", { exact: true }).fill("100");
  await page.getByLabel("Target duration (minutes)", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Save workout", exact: true }).click();
  await expect(page).toHaveURL(/\/fitness$/);
  const saved = await (await page.request.get(endpoint)).json();
  expect(saved.exercises[0].sets[0]).toMatchObject({
    targetWeightKg: 100,
    targetDistanceMeters: 91.44,
    targetDurationSeconds: 120,
  });
  const session = await post(
    `${endpoint}/begin`,
    { startedAt: new Date(Date.now() - 600000).toISOString() },
    saved.version,
  );
  await page.goto(`/fitness/session/${session.id}`);
  await page
    .getByRole("button", {
      name: "Expand Mixed measurements exercise",
      exact: true,
    })
    .click();
  const current = page.getByRole("region", {
    name: "Current set",
    exact: true,
  });
  await expect(
    current.locator("dt").filter({ hasText: "Distance (yd)" }),
  ).toBeVisible();
  await expect(current.locator("dd").last()).toHaveText("100");
  await expect(current).toContainText("2 min");
  await current
    .getByRole("button", { name: "Complete set", exact: true })
    .click();
  await expect(page.locator(".fitness-save-state")).toHaveText("Saved");
  await page
    .getByRole("button", { name: "Finish workout", exact: true })
    .click();
  await expect(page.locator(".fitness-save-state")).toHaveText("Saved");
  await expect(
    page.getByRole("region", { name: "Workout results", exact: true }),
  ).toContainText("2 min");
  await page.goto(`/fitness/exercises/${exercise.id}`);
  await expect(page.locator(".fitness-recall-section")).toContainText("100 yd");
  await expect(page.locator(".fitness-recall-section")).toContainText("2 min");
  await page.goto("/settings");
  await expect(page.getByLabel("Distance", { exact: true })).toHaveValue("yd");
  await expect(
    page.getByLabel("Fitness duration", { exact: true }),
  ).toHaveValue("min");
});
test("failed unit changes keep the dialog and retry the same preference write", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/fitness");
  await page.getByRole("button", { name: "Units", exact: true }).click();
  await choose(page, "Distance unit", "Metres (m)");
  await choose(page, "Duration unit", "Hours (h)");
  const keys: string[] = [];
  await page.route("**/api/v1/preferences", async (route) => {
    keys.push(route.request().headers()["idempotency-key"]!);
    if (keys.length === 1) {
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Save units", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Fitness units",
    exact: true,
  });
  await expect(
    dialog.getByRole("button", { name: "Retry same change", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "Retry same change", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(keys).toHaveLength(2);
  expect(keys[1]).toBe(keys[0]);
  await page.reload();
  await page.getByRole("button", { name: "Units", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Distance unit", exact: true }),
  ).toContainText("Metres (m)");
  await expect(
    dialog.getByRole("button", { name: "Duration unit", exact: true }),
  ).toContainText("Hours (h)");
});
