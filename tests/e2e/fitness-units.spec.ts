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
test("Settings unit defaults convert recovered workout edits without changing saved measurements", async ({
  page,
}) => {
  const { plan } = await setup(page);
  const editor = `/fitness/workout/${plan.id}`;
  await page.goto(editor);
  await expect(
    page.getByRole("button", { name: "Units", exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("Workout name", { exact: true })
    .fill("Unsaved unit practice");
  await page.goto("/settings");
  await page.getByLabel("Timezone", { exact: true }).fill("America/Edmonton");
  await page
    .getByRole("button", { name: "Use this device’s timezone" })
    .click();
  await expect(page.getByLabel("Timezone", { exact: true })).toHaveValue(
    await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone),
  );
  await page
    .getByLabel("Weight & strength load", { exact: true })
    .selectOption("lb");
  await page.getByLabel("Distance", { exact: true }).selectOption("yd");
  await page
    .getByLabel("Fitness duration", { exact: true })
    .selectOption("min");
  await page
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await expect(
    page.getByText("Preferences saved.", { exact: true }),
  ).toBeVisible();
  await page.goto(editor);
  await expect(page.getByLabel("Workout name", { exact: true })).toHaveValue(
    "Unsaved unit practice",
  );
  await page
    .getByRole("button", {
      name: "Expand Mixed measurements exercise",
      exact: true,
    })
    .click();
  await expect(
    page.getByLabel("Target load (lb)", { exact: true }),
  ).toHaveValue("220.46");
  await expect(
    page.getByLabel("Target distance (yd)", { exact: true }),
  ).toHaveValue("1093.613");
  await expect(
    page.getByLabel("Target duration (minutes)", { exact: true }),
  ).toHaveValue("1.5");
  const saved = await (
    await page.request.get(`/api/v1/strength-plans/${plan.id}`)
  ).json();
  expect(saved.version).toBe(plan.version);
  expect(saved.exercises[0].sets[0]).toMatchObject({
    targetWeightKg: 100,
    targetDistanceMeters: 1000,
    targetDurationSeconds: 90,
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("Settings retries uncertain unit preference saves with the same request key", async ({
  page,
}) => {
  await setup(page);
  await page.goto("/settings");
  await page.getByLabel("Timezone", { exact: true }).fill("America/Edmonton");
  await page
    .getByRole("button", { name: "Use this device’s timezone" })
    .click();
  await expect(page.getByLabel("Timezone", { exact: true })).toHaveValue(
    await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone),
  );
  await page.getByLabel("Distance", { exact: true }).selectOption("m");
  await page.getByLabel("Fitness duration", { exact: true }).selectOption("h");
  const keys: string[] = [];
  await page.route("**/api/v1/preferences", async (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    keys.push(route.request().headers()["idempotency-key"]!);
    if (keys.length === 1) {
      await route.fetch();
      return route.abort("failed");
    }
    return route.continue();
  });
  await page
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await page.getByRole("button", { name: "Retry save", exact: true }).click();
  await expect(
    page.getByText("Preferences saved.", { exact: true }),
  ).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(keys[1]).toBe(keys[0]);
  await page.reload();
  await expect(page.getByLabel("Distance", { exact: true })).toHaveValue("m");
  await expect(
    page.getByLabel("Fitness duration", { exact: true }),
  ).toHaveValue("h");
});
