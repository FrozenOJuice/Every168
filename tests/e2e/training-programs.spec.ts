import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const headers = (version?: number) => ({
  Origin: "http://localhost:3100",
  "Idempotency-Key": randomUUID(),
  ...(version ? { "If-Match": `"${version}"` } : {}),
});
async function setup(page: Page) {
  const write = async (
    method: "post" | "put" | "delete",
    path: string,
    data: object = {},
    version?: number,
  ) => {
    const response = await page.request[method](path, {
      headers: headers(version),
      data,
    });
    expect(response.ok()).toBe(true);
    return response.json();
  };
  await write("post", "/api/auth/sign-up/email", {
    name: "Program tester",
    email: `program-${randomUUID()}@example.com`,
    password: "Synthetic-program-password-123",
  });
  const me = await (await page.request.get("/api/v1/me")).json();
  await write(
    "put",
    "/api/v1/preferences",
    { timezone: "UTC", weekStartsOn: 1, weightUnit: "kg", distanceUnit: "km" },
    me.preferences.version,
  );
  const exercise = await write("post", "/api/v1/exercises", {
    name: "Program squat",
  });
  const plans = [];
  for (const title of ["Workout A", "Workout B"]) {
    plans.push(
      await write("post", "/api/v1/strength-plans", {
        title,
        exercises: [
          {
            exerciseId: exercise.id,
            sets: [{ targetReps: 8, targetWeightKg: 40 }],
          },
        ],
      }),
    );
  }
  return { write, plans };
}
async function add(page: Page, name: string) {
  await page
    .getByRole("button", { name: "Saved workout", exact: true })
    .click();
  await page.getByRole("option", { name, exact: true }).click();
  await page
    .getByRole("button", { name: "Add workout to sequence", exact: true })
    .click();
}
test("program creation, reorder, Calendar rescheduling, skipping, completion and pause work on desktop and phone", async ({
  page,
}, info) => {
  await setup(page);
  await page.goto("/fitness");
  await page.getByRole("link", { name: "Create program", exact: true }).click();
  await page
    .getByLabel("Program name", { exact: true })
    .fill("Two-day strength");
  await page.getByLabel("Start date", { exact: true }).fill("2026-10-26");
  await page.getByLabel("Monday", { exact: true }).check();
  await page.getByLabel("Wednesday", { exact: true }).check();
  await add(page, "Workout A");
  await add(page, "Workout B");
  await page
    .getByRole("button", { name: "Move step 2 up", exact: true })
    .click();
  await expect(page.locator(".fitness-program-steps li").first()).toContainText(
    "Workout B",
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "Save program", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Next: Workout B", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Mon · Wed · Starts Oct 26", { exact: true }),
  ).toBeVisible();
  const programPath = new URL(page.url()).pathname;
  await page
    .getByRole("navigation", { name: "Fitness views" })
    .getByRole("link", { name: "Training", exact: true })
    .click();
  const programCard = page
    .locator(".fitness-program-overview .fitness-program-card")
    .filter({ hasText: "Two-day strength" });
  await expect(programCard).toBeVisible();
  await expect(
    page.getByRole("link", { name: "View programs →", exact: true }),
  ).toHaveCount(0);
  await programCard.click();
  await page.getByRole("link", { name: "Edit program", exact: true }).click();
  await page
    .getByLabel("Program notes", { exact: true })
    .fill("Alternate workouts and leave room to recover.");
  await page.getByRole("button", { name: "Save program", exact: true }).click();
  await expect(
    page.getByText("Alternate workouts and leave room to recover.", {
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Schedule next workout", exact: true })
    .click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Start", { exact: true }).fill("2026-10-26T09:00");
  await dialog.getByLabel("End", { exact: true }).fill("2026-10-26T10:00");
  await dialog
    .getByRole("button", { name: "Save schedule", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  const programId = programPath.split("/").at(-1)!;
  const before = await (
    await page.request.get(`/api/v1/training-programs/${programId}`)
  ).json();
  await page.getByRole("button", { name: "Reschedule", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Start", { exact: true }).fill("2026-10-27T09:00");
  await dialog.getByLabel("End", { exact: true }).fill("2026-10-27T10:00");
  await dialog
    .getByRole("button", { name: "Save schedule", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  const moved = await (
    await page.request.get(`/api/v1/training-programs/${programId}`)
  ).json();
  expect(moved.next.block.id).toBe(before.next.block.id);
  expect(moved.next.sequence).toBe(0);
  await page
    .getByRole("button", { name: "Skip this workout", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm skip", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Next: Workout A", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Start next workout", exact: true })
    .click();
  await expect(page).toHaveURL(/\/fitness\/session\//);
  const sessionPath = new URL(page.url()).pathname;
  await page.getByLabel("Actual reps", { exact: true }).first().fill("8");
  await expect(page.locator(".fitness-save-state")).toHaveText("Saved");
  await page.getByLabel("Completed", { exact: true }).first().check();
  await expect(page.locator(".fitness-save-state")).toHaveText("Saved");
  await page
    .getByRole("button", { name: "Finish workout", exact: true })
    .click();
  await expect(page.locator(".fitness-save-state")).toHaveText("Saved");
  await page
    .getByRole("link", {
      name: "Back to program: Two-day strength",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "Next: Workout B", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("1 finished · 1 skipped", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".fitness-program-next")).toContainText("Cycle 2");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("training-program.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Pause program", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Start next workout", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Resume program", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Start next workout", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Delete program", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm delete", exact: true })
    .click();
  await expect(page).toHaveURL(/\/fitness\/programs$/);
  await page.goto(sessionPath);
  await expect(
    page.getByRole("heading", { name: "Workout review", exact: true }),
  ).toBeVisible();
});
test("program forms retain edits, surface read failures, recover a lost response with the same key and reject stale writes", async ({
  page,
}) => {
  const { write, plans } = await setup(page);
  await page.goto("/fitness/programs/new");
  await page
    .getByLabel("Program name", { exact: true })
    .fill("Flexible program");
  await page.getByRole("button", { name: "Save program", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Add at least one workout" }),
  ).toBeVisible();
  await add(page, "Workout A");
  page.once("dialog", (d) => d.dismiss());
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await expect(page.getByLabel("Program name", { exact: true })).toHaveValue(
    "Flexible program",
  );
  await page.getByRole("button", { name: "Save program", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Next: Workout A", exact: true }),
  ).toBeVisible();
  const path = new URL(page.url()).pathname,
    id = path.split("/").at(-1)!,
    endpoint = `/api/v1/training-programs/${id}`;
  await page.route(`**${endpoint}`, (route) =>
    route.request().method() === "GET"
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: {
              code: "UNAVAILABLE",
              message: "Program temporarily unavailable",
            },
          }),
        })
      : route.continue(),
  );
  await page.reload();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Program temporarily unavailable" }),
  ).toBeVisible();
  await page.unroute(`**${endpoint}`);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Next: Workout A", exact: true }),
  ).toBeVisible();
  let intercepted = false;
  const keys: string[] = [];
  await page.route(`**${endpoint}/skip`, async (route) => {
    keys.push(route.request().headers()["idempotency-key"]!);
    if (!intercepted) {
      intercepted = true;
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await page
    .getByRole("button", { name: "Skip this workout", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm skip", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Retry same change", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Retry same change", exact: true })
    .click();
  await expect(
    page.getByText("0 finished · 1 skipped", { exact: true }),
  ).toBeVisible();
  expect(keys.length).toBe(2);
  expect(keys[0]).toBe(keys[1]);
  const current = await (await page.request.get(endpoint)).json();
  await write("put", `${endpoint}/paused`, { paused: true }, current.version);
  await page
    .getByRole("button", { name: "Pause program", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Reload latest", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Reload latest", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Resume program", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Resume program", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Pause program", exact: true }),
  ).toBeVisible();
  await write(
    "delete",
    `/api/v1/strength-plans/${plans[0].id}`,
    {},
    plans[0].version,
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Start next workout", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText(
      "This saved workout is unavailable. Edit the program to replace it, or skip this step.",
      { exact: true },
    ),
  ).toBeVisible();
  await page.getByRole("link", { name: "Edit program", exact: true }).click();
  await page
    .getByRole("button", { name: "Remove step 1", exact: true })
    .click();
  await add(page, "Workout B");
  await page.getByRole("button", { name: "Save program", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Next: Workout B", exact: true }),
  ).toBeVisible();
});
