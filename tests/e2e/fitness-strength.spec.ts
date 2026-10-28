import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const headers = (version?: number) => ({
  Origin: "http://localhost:3100",
  "Idempotency-Key": randomUUID(),
  ...(version ? { "If-Match": `"${version}"` } : {}),
});
async function start(page: Page) {
  expect(
    (
      await page.request.post("/api/auth/sign-up/email", {
        headers: headers(),
        data: {
          name: "Strength member",
          email: `strength-${randomUUID()}@example.com`,
          password: "Synthetic-strength-password-123",
        },
      })
    ).status(),
  ).toBe(200);
  const me = await (await page.request.get("/api/v1/me")).json();
  expect(
    (
      await page.request.put("/api/v1/preferences", {
        headers: headers(me.preferences.version),
        data: {
          timezone: "UTC",
          weekStartsOn: 1,
          weightUnit: "lb",
          distanceUnit: "km",
        },
      })
    ).status(),
  ).toBe(200);
  await page.goto("/fitness");
}
async function saved(page: Page) {
  await expect(page.locator(".fitness-save-state")).toHaveText("Saved");
}
test("prepare, schedule, train, recover, finish and repeat a strength workout", async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  await start(page);
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }).getByRole("link"),
  ).toHaveText(["Calendar", "Fitness", "Food", "Tasks", "Assistant"]);
  await page.getByRole("link", { name: "Create workout", exact: true }).click();
  await page.getByLabel("Workout name", { exact: true }).fill("Strength A");
  if (testInfo.project.name !== "desktop")
    await page
      .getByRole("button", { name: "Add exercise", exact: true })
      .click();
  await page
    .locator(".fitness-exercise-panel")
    .getByRole("button", { name: "Create exercise", exact: true })
    .click();
  const create = page.getByRole("region", {
    name: "Create exercise",
    exact: true,
  });
  await create.getByLabel("Exercise name", { exact: true }).fill("Squat");
  await create
    .getByRole("button", { name: "Create and add to workout", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".fitness-panel-notice")).toHaveCount(0);
  if (testInfo.project.name === "phone") {
    await page
      .getByRole("button", { name: "Back to workout", exact: true })
      .click();
  }
  await page.getByLabel("Target reps", { exact: true }).fill("8");
  await page.getByLabel("Target load (lb)", { exact: true }).fill("100");
  await page
    .getByRole("button", { name: "More details for set 1", exact: true })
    .click();
  await page.getByRole("button", { name: "Add set", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Edit rest after set 1: Add rest",
      exact: true,
    })
    .click();
  await page.getByLabel("Rest (seconds)", { exact: true }).fill("30");
  await page.getByLabel("Rest (seconds)", { exact: true }).press("Enter");
  await page
    .getByRole("button", { name: "More details for set 2", exact: true })
    .click();
  await page
    .getByLabel("Target duration (seconds)", { exact: true })
    .nth(1)
    .fill("30");
  await page.getByRole("button", { name: "Save workout", exact: true }).click();
  await expect(page).toHaveURL(/\/fitness$/);
  const card = page.locator("section.panel").filter({
    has: page.getByRole("heading", { name: "Strength A", exact: true }),
  });
  await card.getByRole("button", { name: "Schedule", exact: true }).click();
  const schedule = page.getByRole("dialog", {
    name: "Schedule workout",
    exact: true,
  });
  await schedule.getByLabel("Start", { exact: true }).fill("2026-10-14T15:00");
  await schedule.getByLabel("End", { exact: true }).fill("2026-10-14T16:00");
  await schedule
    .getByRole("button", { name: "Schedule workout", exact: true })
    .click();
  await expect(schedule).toHaveCount(0);
  expect(
    (await (await page.request.get("/api/v1/strength-workouts")).json()).items,
  ).toHaveLength(0);
  await page.goto("/?date=2026-10-14&view=day");
  await page
    .getByRole("region", { name: "Daily time grid" })
    .getByRole("button", { name: /Strength A.*planned/ })
    .dblclick();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Start workout", exact: true })
    .click();
  await expect(page).toHaveURL(/\/fitness\/session\//);
  const id = page.url().split("/").at(-1)!;
  const read = async () =>
    await (await page.request.get(`/api/v1/strength-workouts/${id}`)).json();
  await openWorkoutDetails(page);
  await expect(page.getByLabel("Workout name", { exact: true })).toHaveValue(
    "Strength A",
  );
  await expect(
    page.getByLabel("Actual reps", { exact: true }).first(),
  ).toHaveValue("");
  await page.locator(".fitness-set-targets").first().locator("summary").click();
  await expect(
    page.getByLabel("Target load (lb)", { exact: true }).first(),
  ).toHaveValue("100");
  await page.getByLabel("Actual reps", { exact: true }).first().fill("7");
  await saved(page);
  if (testInfo.project.name === "desktop")
    await expect(
      page.getByLabel("Actual reps", { exact: true }).first(),
    ).toBeFocused();
  await expect
    .poll(async () => (await read()).exercises[0].sets[0].reps)
    .toBe(7);
  await page.getByLabel("Actual load (lb)", { exact: true }).first().fill("90");
  await saved(page);
  await page
    .getByRole("group", { name: "Set 1", exact: true })
    .getByLabel("Completed", { exact: true })
    .check();
  await saved(page);
  await expect(page.getByRole("timer", { name: "Rest timer" })).toBeVisible();
  await page
    .getByRole("group", { name: "Set 2", exact: true })
    .getByLabel("Skipped", { exact: true })
    .check();
  await saved(page);
  const row = await read();
  expect(row.exercises[0].sets[0].weightKg).toBeCloseTo(40.8233133, 5);
  expect(row.exercises[0].sets[0].targetWeightKg).toBeCloseTo(45.359237, 5);
  // Reload immediately after an edit: the recovery draft must not disappear.
  await page
    .getByLabel("Workout notes", { exact: true })
    .fill("Felt strong today");
  await page.reload();
  await openWorkoutDetails(page);
  await expect(page.getByLabel("Workout notes", { exact: true })).toHaveValue(
    "Felt strong today",
  );
  await saved(page);
  const keys: string[] = [];
  let lost = false;
  await page.route(`**/api/v1/strength-workouts/${id}`, async (route) => {
    if (route.request().method() === "PUT") {
      keys.push(route.request().headers()["idempotency-key"]!);
      if (!lost) {
        lost = true;
        expect((await route.fetch()).status()).toBe(200);
        await route.abort("failed");
        return;
      }
    }
    await route.continue();
  });
  await page.getByLabel("Actual reps", { exact: true }).first().fill("9");
  await page
    .getByRole("button", { name: "Retry same change", exact: true })
    .click();
  await saved(page);
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  await page.unroute(`**/api/v1/strength-workouts/${id}`);
  await page
    .getByRole("button", { name: "Finish workout", exact: true })
    .click();
  await saved(page);
  await expect(
    page.getByRole("heading", { name: / - Summary$/, level: 1 }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("fitness-session.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const plans = await (await page.request.get("/api/v1/strength-plans")).json();
  expect(plans.items[0].exercises[0].sets[0].targetReps).toBe(8);
  await page
    .getByRole("button", { name: "Repeat workout", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Repeat this workout?", exact: true })
    .getByRole("button", { name: "Start workout", exact: true })
    .click();
  await expect(page).not.toHaveURL(new RegExp(id));
  await expect(
    page.getByLabel("Actual reps", { exact: true }).first(),
  ).toHaveValue("");
  await expect(
    page
      .getByRole("group", { name: "Set 1", exact: true })
      .getByLabel("Completed", { exact: true }),
  ).not.toBeChecked();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Discard workout", exact: true })
    .click();
  await expect(page).toHaveURL(/#history/);
  await page
    .locator("#history")
    .getByRole("link", { name: /^Strength A/ })
    .click();
  await expect(
    page.getByLabel("Actual reps", { exact: true }).first(),
  ).toHaveValue("9");
});
test("a newer saved workout blocks autosave and preserves the local draft across refresh", async ({
  page,
}) => {
  await start(page);
  const created = await (
    await page.request.post("/api/v1/strength-workouts", {
      headers: headers(),
      data: {
        title: "Workout",
        startedAt: new Date().toISOString(),
        notes: null,
        linkedTimeBlockId: null,
      },
    })
  ).json();
  await page.goto(`/fitness/session/${created.id}`);
  await expect(page).toHaveURL(/\/fitness\/session\//);
  await openWorkoutDetails(page);
  await expect(page.getByLabel("Workout name", { exact: true })).toBeVisible();
  const id = page.url().split("/").at(-1)!;
  const current = await (
    await page.request.get(`/api/v1/strength-workouts/${id}`)
  ).json();
  expect(
    (
      await page.request.put(`/api/v1/strength-workouts/${id}`, {
        headers: headers(current.version),
        data: {
          title: "Changed elsewhere",
          startedAt: current.startedAt,
          endedAt: null,
          notes: "Remote notes",
          linkedTimeBlockId: null,
          exercises: [],
        },
      })
    ).status(),
  ).toBe(200);
  await page
    .getByLabel("Workout notes", { exact: true })
    .fill("My local notes");
  await expect(
    page.getByRole("alert").filter({ hasText: "changed since" }),
  ).toBeVisible();
  await page.reload();
  await openWorkoutDetails(page);
  await expect(page.getByLabel("Workout notes", { exact: true })).toHaveValue(
    "My local notes",
  );
  await expect(
    page.getByText("Recovered draft conflicts with a newer saved workout", {
      exact: true,
    }),
  ).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", {
      name: "Discard local edits and reload",
      exact: true,
    })
    .click();
  await openWorkoutDetails(page);
  await expect(page.getByLabel("Workout name", { exact: true })).toHaveValue(
    "Changed elsewhere",
  );
  await expect(page.getByLabel("Workout notes", { exact: true })).toHaveValue(
    "Remote notes",
  );
});

async function openWorkoutDetails(page: Page) {
  const details = page.locator(".fitness-workout-details");
  await expect(details).toBeVisible();
  if ((await details.getAttribute("open")) === null)
    await details.locator("summary").click();
}
