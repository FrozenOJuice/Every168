import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("History opens the shared workout summary with actual results and corrections", async ({
  page,
}, info) => {
  const write = async (
    method: "post" | "put",
    path: string,
    data: object,
    version?: number,
  ) => {
    const response = await page.request[method](path, {
      headers: {
        Origin: "http://localhost:3100",
        "Idempotency-Key": randomUUID(),
        ...(version ? { "If-Match": `"${version}"` } : {}),
      },
      data,
    });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  };
  await write("post", "/api/auth/sign-up/email", {
    name: "Summary test",
    email: `summary-${randomUUID()}@example.com`,
    password: "Synthetic-summary-password-123",
  });
  const me = await (await page.request.get("/api/v1/me")).json();
  await write(
    "put",
    "/api/v1/preferences",
    { timezone: "UTC", weekStartsOn: 1, weightUnit: "kg", distanceUnit: "km" },
    me.preferences.version,
  );
  const bench = await write("post", "/api/v1/exercises", {
    name: "Bench press",
  });
  const run = await write("post", "/api/v1/exercises", {
    name: "Track intervals",
  });
  const row = await write("post", "/api/v1/exercises", { name: "Cable row" });
  const session = await write("post", "/api/v1/strength-workouts", {
    title: "Evening mixed workout",
    startedAt: "2026-10-25T23:45:00Z",
  });
  const saved = await write(
    "put",
    `/api/v1/strength-workouts/${session.id}`,
    {
      title: session.title,
      startedAt: session.startedAt,
      endedAt: "2026-10-26T00:30:00Z",
      notes: "Kept a steady pace.",
      exercises: [
        {
          exerciseId: bench.id,
          loggingType: "reps_load",
          sets: [
            {
              completed: true,
              reps: 8,
              weightKg: 0,
              targetReps: 12,
              targetWeightKg: 999,
            },
            { completed: true, reps: 6, weightKg: null, targetWeightKg: 999 },
            {
              completed: false,
              skipped: true,
              targetReps: 12,
              targetWeightKg: 999,
            },
            {
              completed: false,
              skipped: false,
              targetReps: 12,
              targetWeightKg: 999,
            },
          ],
        },
        {
          exerciseId: run.id,
          loggingType: "distance_laps_duration",
          sets: [
            {
              completed: true,
              durationSeconds: 90,
              distanceMeters: 400,
              laps: 1,
            },
          ],
        },
        {
          exerciseId: row.id,
          loggingType: "reps_load",
          sets: [
            {
              completed: false,
              skipped: true,
              targetReps: 12,
              targetWeightKg: 999,
            },
          ],
        },
      ],
    },
    session.version,
  );
  await page.goto("/fitness/history");
  await page.getByRole("link", { name: /Evening mixed workout/ }).click();
  await expect(
    page.getByRole("heading", { name: / - Summary$/, level: 1 }),
  ).toBeVisible();
  const results = page.getByRole("region", {
    name: "Workout results",
    exact: true,
  });
  await expect(results.getByRole("definition").nth(0)).toContainText("45m");
  await expect(results.getByRole("definition").nth(1)).toHaveText("2 / 3");
  await expect(results.getByRole("definition").nth(2)).toHaveText("3 / 6");
  await expect(results).toContainText("2 skipped sets · 1 unfinished set");
  await expect(results).toContainText("October 25, 2026");
  await expect(results).toContainText("October 26, 2026");
  await expect(results).toContainText("UTC");
  await expect(results).toContainText("Kept a steady pace.");
  await expect(results).not.toContainText("999");
  await results
    .getByRole("button", { name: "Show all sets", exact: true })
    .click();
  const benchSets = results.getByRole("list", {
    name: "Bench press recorded sets",
  });
  await expect(benchSets).toBeVisible();
  await expect(benchSets).toContainText("8 reps · 0 kg");
  await expect(benchSets).toContainText("6 reps · Load not recorded");
  await expect(benchSets).toContainText("Skipped");
  await expect(benchSets).toContainText("Unfinished");
  await expect(
    results.getByRole("list", { name: "Track intervals recorded sets" }),
  ).toContainText("1m 30s");
  await expect(
    results.getByRole("list", { name: "Track intervals recorded sets" }),
  ).toContainText("0.4 km");
  await expect(
    results.getByRole("list", { name: "Track intervals recorded sets" }),
  ).toContainText("1 lap");
  await page.screenshot({
    path: info.outputPath("workout-summary.png"),
    fullPage: true,
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await results
    .getByRole("button", { name: "Hide all sets", exact: true })
    .click();
  await expect(benchSets).not.toBeVisible();
  const before = await (
    await page.request.get(`/api/v1/strength-workouts/${session.id}`)
  ).json();
  expect(before.version).toBe(saved.version);
  await expect(
    page.getByRole("link", { name: "History", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await page
    .getByRole("button", { name: "Correct results", exact: true })
    .click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Evening mixed workout - Summary",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Discard corrections?", exact: true }),
  ).not.toBeVisible();
  await page
    .getByRole("button", { name: "Correct results", exact: true })
    .click();
  await page
    .getByLabel("Workout name", { exact: true })
    .fill("Unsaved correction");
  await page
    .getByRole("button", { name: "Back to summary", exact: true })
    .click();
  const discardDialog = page.getByRole("dialog", {
    name: "Discard corrections?",
    exact: true,
  });
  await expect(discardDialog).toBeVisible();
  await discardDialog
    .getByRole("button", { name: "Keep editing", exact: true })
    .click();
  await expect(page.getByLabel("Workout name", { exact: true })).toHaveValue(
    "Unsaved correction",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await discardDialog
    .getByRole("button", { name: "Discard corrections", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Evening mixed workout - Summary",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    (
      await (
        await page.request.get(`/api/v1/strength-workouts/${session.id}`)
      ).json()
    ).version,
  ).toBe(saved.version);
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Evening mixed workout - Summary",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Correct results", exact: true })
    .click();
  const expectNoEmptyEditorScroll = async () => {
    await expect
      .poll(() =>
        page.locator(".fitness-builder-scroll").evaluate((root) => {
          const lastCard = root.querySelector(
            ".fitness-workout-exercise-list > section:last-child",
          )!;
          const contentBottom =
            lastCard.getBoundingClientRect().bottom -
            root.getBoundingClientRect().top +
            root.scrollTop;
          return root.scrollHeight - Math.max(root.clientHeight, contentBottom);
        }),
      )
      .toBeLessThan(24);
  };
  await expectNoEmptyEditorScroll();
  await page
    .getByRole("button", { name: "Expand Bench press exercise", exact: true })
    .click();
  const firstSet = page
    .getByRole("region", { name: "Bench press exercise 1", exact: true })
    .getByRole("group", { name: "Set 1", exact: true });
  await firstSet
    .getByRole("spinbutton", { name: "Actual reps", exact: true })
    .fill("10");
  await firstSet
    .getByRole("spinbutton", { name: "Actual load (kg)", exact: true })
    .fill("20");
  await expect(firstSet).toContainText("Planned:");
  await firstSet
    .getByRole("button", { name: "Actual load unit", exact: true })
    .click();
  await page.getByRole("option", { name: "lb", exact: true }).click();
  await expect(
    firstSet.getByRole("spinbutton", { name: "Actual load (lb)", exact: true }),
  ).toHaveValue("44.09");
  await expect(
    page
      .getByRole("region", { name: "Bench press exercise 1", exact: true })
      .locator(".fitness-exercise-target-summary"),
  ).toContainText("44.09 lb");
  await firstSet
    .getByRole("button", { name: "Actual load unit", exact: true })
    .click();
  await page.getByRole("option", { name: "kg", exact: true }).click();

  await expect(
    firstSet.getByRole("button", { name: "Set 1 status", exact: true }),
  ).toContainText("Completed");
  await firstSet
    .getByRole("button", { name: "Set 1 status", exact: true })
    .click();
  await page.getByRole("option", { name: "Skipped", exact: true }).click();
  await expect(
    firstSet.getByRole("spinbutton", { name: "Actual reps", exact: true }),
  ).toHaveValue("10");
  await firstSet
    .getByRole("button", { name: "Set 1 status", exact: true })
    .click();
  await page.getByRole("option", { name: "Completed", exact: true }).click();
  const lastSet = page
    .getByRole("region", { name: "Bench press exercise 1", exact: true })
    .getByRole("group", { name: "Set 4", exact: true });
  await lastSet
    .getByRole("button", { name: "Set 4 status", exact: true })
    .click();
  await page.getByRole("option", { name: "Skipped", exact: true }).click();
  await expect(
    lastSet.getByRole("button", { name: "Set 4 status", exact: true }),
  ).toContainText("Skipped");
  await lastSet
    .getByRole("button", { name: "Set 4 status", exact: true })
    .click();
  await page.getByRole("option", { name: "Unfinished", exact: true }).click();
  await page
    .getByRole("button", { name: "Collapse Bench press exercise", exact: true })
    .click();
  await expectNoEmptyEditorScroll();
  await page
    .getByRole("button", { name: "Expand Bench press exercise", exact: true })
    .click();
  await page.getByText("Adjust workout time", { exact: true }).click();
  await page.getByLabel("Finished at", { exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Choose finish time" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  const correctionAxe = await new AxeBuilder({ page }).analyze();
  expect(correctionAxe.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("correct-results.png"),
    fullPage: true,
  });
  await firstSet.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: info.outputPath("correct-result-sets.png"),
    fullPage: true,
  });
  await expect(page.locator(".fitness-save-state")).toHaveText(
    "Unsaved changes",
  );
  const beforeCorrections = await (
    await page.request.get(`/api/v1/strength-workouts/${session.id}`)
  ).json();
  expect(beforeCorrections.version).toBe(saved.version);
  expect(beforeCorrections.exercises[0].sets[0].reps).toBe(8);
  if (info.project.name === "phone")
    await expect(
      page.getByRole("button", { name: "Recorded results", exact: true }),
    ).toBeVisible();
  let fail = true;
  await page.route(
    `**/api/v1/strength-workouts/${session.id}`,
    async (route) => {
      if (route.request().method() !== "PUT") return route.continue();
      if (fail) {
        fail = false;
        return route.fulfill({
          status: 422,
          contentType: "application/json",
          body: JSON.stringify({
            error: {
              code: "VALIDATION_ERROR",
              message: "Synthetic correction save failure",
            },
          }),
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    },
  );
  await page
    .getByLabel("Workout name", { exact: true })
    .fill("Corrected evening workout");
  await page
    .getByRole("button", { name: "Save corrections", exact: true })
    .click();
  await expect(
    page.getByText("Changes not saved", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Correct results", exact: true }),
  ).toBeAttached();
  await page.getByRole("button", { name: "Retry save", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Corrected evening workout - Summary",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: / - Summary$/, level: 1 }),
  ).toBeVisible();
  await expect(results).toContainText("3 / 6");
  await expect(results).toContainText("20 kg");
  const beforeInvalidCorrection = await (
    await page.request.get(`/api/v1/strength-workouts/${session.id}`)
  ).json();
  await page
    .getByRole("button", { name: "Correct results", exact: true })
    .click();
  await page.getByLabel("Workout name", { exact: true }).fill("");
  await page
    .getByRole("button", { name: "Back to summary", exact: true })
    .click();
  await discardDialog
    .getByRole("button", { name: "Discard corrections", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Corrected evening workout - Summary",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await (
      await page.request.get(`/api/v1/strength-workouts/${session.id}`)
    ).json(),
  ).toEqual(beforeInvalidCorrection);
  const repeatRequests: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().endsWith(`/strength-workouts/${session.id}/repeat`)
    )
      repeatRequests.push(request.url());
  });
  await page
    .getByRole("button", { name: "Repeat workout", exact: true })
    .click();
  const repeatDialog = page.getByRole("dialog", {
    name: "Repeat this workout?",
    exact: true,
  });
  await expect(repeatDialog).toContainText("Corrected evening workout");
  expect(repeatRequests).toHaveLength(0);
  await repeatDialog
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(repeatDialog).not.toBeVisible();
  expect(repeatRequests).toHaveLength(0);
  await expect(page).toHaveURL(new RegExp(`/fitness/session/${session.id}$`));
  await page
    .getByRole("link", { name: "Back to history", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: /Corrected evening workout/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Corrected evening workout/ }).click();
  const recordedBeforeRepeat = await (
    await page.request.get(`/api/v1/strength-workouts/${session.id}`)
  ).json();
  await page
    .getByRole("button", { name: "Repeat workout", exact: true })
    .click();
  await repeatDialog
    .getByRole("button", { name: "Start workout", exact: true })
    .click();
  await expect.poll(() => page.url().split("/").at(-1)).not.toBe(session.id);
  const repeatedId = page.url().split("/").at(-1);
  const repeated = await (
    await page.request.get(`/api/v1/strength-workouts/${repeatedId}`)
  ).json();
  expect(repeated.endedAt).toBeNull();
  expect(repeated.title).toBe("Corrected evening workout");
  expect(repeated.exercises).toHaveLength(3);
  expect(repeated.exercises[0].sets[0].completed).toBe(false);
  expect(repeated.exercises[0].sets[0].reps).toBeNull();
  expect(repeatRequests).toHaveLength(1);
  const recordedAfterRepeat = await (
    await page.request.get(`/api/v1/strength-workouts/${session.id}`)
  ).json();
  expect(recordedAfterRepeat).toEqual(recordedBeforeRepeat);
});
