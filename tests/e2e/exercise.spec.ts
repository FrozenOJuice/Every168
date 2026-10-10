import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Cardio, Workout, WorkoutUpdateInput } from "@168hours/contracts";

test("workouts and cardio can be recorded, safely retried, corrected and reviewed", async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  if (testInfo.project.name === "desktop")
    await page.setViewportSize({ width: 1440, height: 1000 });
  const headers = (version?: number) => ({
    Origin: "http://localhost:3100",
    "Idempotency-Key": randomUUID(),
    ...(version ? { "If-Match": `"${version}"` } : {}),
  });
  expect(
    (
      await page.request.post("/api/auth/sign-up/email", {
        headers: headers(),
        data: {
          name: "Exercise slice",
          email: `exercise-${randomUUID()}@example.com`,
          password: "Synthetic-exercise-password-123",
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
          timezone: "America/Edmonton",
          weekStartsOn: 1,
          weightUnit: "lb",
          distanceUnit: "mi",
        },
      })
    ).status(),
  ).toBe(200);
  const plan = await (
    await page.request.post("/api/v1/time-blocks", {
      headers: headers(),
      data: {
        title: "Training plan",
        startsAt: "2026-09-07T15:00:00Z",
        endsAt: "2026-09-07T16:00:00Z",
      },
    })
  ).json();
  await page.route("**/api/v1/strength-workouts?**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "NOT_READY",
          message: "Exercise history is temporarily unavailable.",
        },
      }),
    }),
  );
  await page.goto("/exercise");
  await expect(
    page.getByText("Exercise history is temporarily unavailable.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.unroute("**/api/v1/strength-workouts?**");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(
    page.getByText(
      "Start a workout and add your exercises and sets. You can save it and return at any time.",
      { exact: true },
    ),
  ).toBeVisible();
  const dialog = page.getByRole("dialog");
  async function close() {
    await dialog
      .getByRole("button", { name: "Close dialog", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
  }
  async function audit(name: string) {
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      if (
        !document.querySelector("dialog[open]") &&
        document.activeElement instanceof HTMLElement
      )
        document.activeElement.blur();
    });
    await page.screenshot({
      path: testInfo.outputPath(name + ".png"),
      fullPage: true,
    });
  }
  await audit("exercise-empty");
  await page
    .getByRole("button", { name: "Start workout", exact: true })
    .click();
  await page.getByLabel("Workout title").fill("Monday strength");
  await page.getByLabel("Started at").fill("2026-09-07T09:00");
  await page.getByLabel("Planned block (optional)").selectOption(plan.id);
  await dialog
    .getByRole("button", { name: "Start workout", exact: true })
    .click();
  await expect(page).toHaveURL(/exercise\/workout\//);
  const workoutId = page.url().split("/").at(-1)!;
  await page.getByRole("button", { name: "New exercise", exact: true }).click();
  await page.getByLabel("Exercise name").fill("Squat");
  await dialog
    .getByRole("button", { name: "Create exercise", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByLabel("Saved exercise")).toHaveValue(/.+/);
  await page
    .getByRole("button", { name: "Add to workout", exact: true })
    .click();
  await page.getByLabel("Reps", { exact: true }).fill("5");
  await page.getByLabel("Load (lb)").fill("100");
  await page
    .getByRole("button", { name: "Repeat last set", exact: true })
    .click();
  await expect(page.getByLabel("Reps", { exact: true }).nth(1)).toHaveValue(
    "5",
  );
  await expect(
    page.getByLabel("Done", { exact: true }).nth(1),
  ).not.toBeChecked();
  await page.getByLabel("Reps", { exact: true }).nth(1).fill("8");
  await page.getByLabel("Done", { exact: true }).nth(1).check();
  await page
    .getByRole("button", { name: "Move set 2 up", exact: true })
    .click();
  await page.getByRole("button", { name: "New exercise", exact: true }).click();
  await page.getByLabel("Exercise name").fill("Plank");
  await dialog
    .getByRole("button", { name: "Create exercise", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await page
    .getByRole("button", { name: "Add to workout", exact: true })
    .click();
  await page.getByLabel("Time (seconds)").last().fill("45");
  await audit("workout-editor");
  if (testInfo.project.name === "desktop") {
    await page.setViewportSize({ width: 320, height: 760 });
    await audit("workout-narrow");
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await page.getByRole("button", { name: "Save workout", exact: true }).click();
  await expect(page.getByText("Changes saved.", { exact: true })).toBeVisible();
  const before: Workout = await (
    await page.request.get("/api/v1/strength-workouts/" + workoutId)
  ).json();
  expect(before.endedAt).toBeNull();
  expect(before.exercises[0]!.sets[0]!.weightKg).toBeCloseTo(45.359237);
  expect(before.exercises[1]!.sets[0]!.weightKg).toBeNull();
  const attempts: { key: string | undefined; body: string | null }[] = [];
  let dropped = false;
  await page.route(
    "**/api/v1/strength-workouts/" + workoutId,
    async (route) => {
      if (route.request().method() !== "PUT") return route.continue();
      attempts.push({
        key: route.request().headers()["idempotency-key"],
        body: route.request().postData(),
      });
      const response = await route.fetch();
      if (!dropped) {
        dropped = true;
        expect(response.status()).toBe(200);
        return route.abort("failed");
      }
      await route.fulfill({ response });
    },
  );
  await page.getByLabel("Finished at").fill("2026-09-07T09:30");
  await page
    .getByRole("button", { name: "Finish workout", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Retry save", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retry save", exact: true }).click();
  await expect(
    page.getByText("Completed workout", { exact: true }),
  ).toBeVisible();
  expect(attempts).toHaveLength(2);
  expect(attempts[1]).toEqual(attempts[0]);
  await page.unroute("**/api/v1/strength-workouts/" + workoutId);
  let finished: Workout = await (
    await page.request.get("/api/v1/strength-workouts/" + workoutId)
  ).json();
  expect(finished.exercises[0]!.sets.map((s) => s.id)).toEqual(
    before.exercises[0]!.sets.map((s) => s.id),
  );
  expect(Date.parse(finished.endedAt!)).toBeGreaterThan(
    Date.parse(finished.startedAt),
  );
  // The finish instant must be identical on retry, then a past session can be corrected explicitly.
  await page.getByLabel("Finished at").fill("2026-09-07T10:00");
  await page.getByRole("button", { name: "Save workout", exact: true }).click();
  await expect(page.getByText("Changes saved.", { exact: true })).toBeVisible();
  finished = await (
    await page.request.get("/api/v1/strength-workouts/" + workoutId)
  ).json();
  let week = await (await page.request.get("/api/v1/weeks/2026-09-07")).json();
  expect(week.entries).toHaveLength(1);
  expect(week.recordedSeconds).toBe(3600);

  // A stale tab retains its draft and cannot overwrite a correction from another client.
  const update: WorkoutUpdateInput = {
    title: finished.title,
    startedAt: finished.startedAt,
    endedAt: finished.endedAt,
    linkedTimeBlockId: finished.linkedTimeBlockId,
    notes: "Other client",
    exercises: finished.exercises.map((e) => ({
      id: e.id,
      exerciseId: e.exerciseId,
      notes: e.notes,
      sets: e.sets.map((s) => ({
        id: s.id,
        reps: s.reps,
        weightKg: s.weightKg,
        durationSeconds: s.durationSeconds,
        completed: s.completed,
      })),
    })),
  };
  expect(
    (
      await page.request.put("/api/v1/strength-workouts/" + workoutId, {
        headers: headers(finished.version),
        data: update,
      })
    ).status(),
  ).toBe(200);
  await page.getByLabel("Workout notes (optional)").fill("Retained draft");
  await page.getByRole("button", { name: "Save workout", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Reload latest (discard edits)",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Workout notes (optional)")).toHaveValue(
    "Retained draft",
  );
  page.once("dialog", (d) => d.accept());
  await page
    .getByRole("button", { name: "Reload latest (discard edits)", exact: true })
    .click();
  await expect(page.getByLabel("Workout notes (optional)")).toHaveValue(
    "Other client",
  );
  await page.getByLabel("Finished at").fill("2026-09-07T09:45");
  await page.getByRole("button", { name: "Save workout", exact: true }).click();
  await expect(page.getByText("Changes saved.", { exact: true })).toBeVisible();
  week = await (await page.request.get("/api/v1/weeks/2026-09-07")).json();
  expect(week.entries).toHaveLength(1);
  expect(week.recordedSeconds).toBe(2700);
  await page
    .getByRole("link", { name: "Workout history", exact: true })
    .click();
  await page.getByLabel("Workout status").selectOption("active");
  await expect(
    page.getByText("No workouts match these filters."),
  ).toBeVisible();
  await page.getByLabel("Workout status").selectOption("completed");
  await expect(
    page.getByRole("link", { name: "View workout", exact: true }),
  ).toBeVisible();
  await audit("workout-history");
  await page
    .getByRole("button", { name: "Exercise library", exact: true })
    .click();
  const squat = page
    .getByRole("listitem")
    .filter({ has: page.getByText("Squat", { exact: true }) });
  await squat.getByRole("button", { name: "Progress", exact: true }).click();
  await expect(dialog.getByText("100 lb", { exact: true })).toBeVisible();
  await audit("strength-progress");
  await close();
  page.once("dialog", (d) => d.accept());
  await squat.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(squat).toHaveCount(0);
  await page.getByLabel("Show archived").check();
  await squat.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(squat).toHaveCount(0);
  await page.getByLabel("Show archived").uncheck();
  await expect(squat).toBeVisible();

  await page.getByRole("button", { name: "Log cardio", exact: true }).click();
  await page.getByLabel("Activity type", { exact: true }).selectOption("run");
  await page.getByLabel("Activity title").fill("Short run");
  await page.getByLabel("Started at").fill("2026-09-07T11:00");
  await page.getByLabel("Duration (minutes)").fill("10");
  await page.getByLabel("Distance (mi, optional)").fill("1");
  await audit("cardio-form");
  await dialog.getByRole("button", { name: "Log cardio", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Short run", exact: true }),
  ).toBeVisible();
  let activities: { items: Cardio[] } = await (
    await page.request.get("/api/v1/cardio-activities")
  ).json();
  expect(activities.items[0]!.distanceMeters).toBeCloseTo(1609.344);
  const activityId = activities.items[0]!.id;
  const activity = activities.items[0]!;
  const preciseStart = "2026-09-07T17:00:37.000Z";
  expect(
    (
      await page.request.put("/api/v1/cardio-activities/" + activity.id, {
        headers: headers(activity.version),
        data: {
          title: activity.title,
          activityType: activity.activityType,
          startedAt: preciseStart,
          durationSeconds: activity.durationSeconds,
          distanceMeters: activity.distanceMeters,
          notes: activity.notes,
          linkedTimeBlockId: activity.linkedTimeBlockId,
        },
      })
    ).status(),
  ).toBe(200);
  await page.reload();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Activity type", { exact: true }).selectOption("skip");
  await page.getByLabel("Distance (mi, optional)").fill("");
  await page.getByLabel("Duration (minutes)").fill("0.5");
  await dialog
    .getByRole("button", { name: "Save activity", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText(/30s/)).toBeVisible();
  activities = await (
    await page.request.get("/api/v1/cardio-activities")
  ).json();
  expect(activities.items[0]!.paceSecondsPerKm).toBeNull();
  expect(activities.items[0]!.distanceMeters).toBeNull();
  expect(activities.items[0]!.startedAt).toBe(preciseStart);
  week = await (await page.request.get("/api/v1/weeks/2026-09-07")).json();
  expect(week.entries).toHaveLength(2);
  expect(week.recordedSeconds).toBe(2730);
  // Preserve the second occurrence of a repeated local hour during a notes-only correction.
  const latest = activities.items[0]!;
  const foldedStart = "2026-11-01T08:30:37.000Z";
  expect(
    (
      await page.request.put("/api/v1/cardio-activities/" + latest.id, {
        headers: headers(latest.version),
        data: {
          title: latest.title,
          activityType: latest.activityType,
          startedAt: foldedStart,
          durationSeconds: latest.durationSeconds,
          distanceMeters: latest.distanceMeters,
          notes: latest.notes,
          linkedTimeBlockId: latest.linkedTimeBlockId,
        },
      })
    ).status(),
  ).toBe(200);
  await page.reload();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page.getByLabel("Started at")).toHaveValue("2026-11-01T01:30");
  await page
    .getByLabel("Notes (optional)", { exact: true })
    .fill("Clock-change correction");
  await dialog
    .getByRole("button", { name: "Save activity", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  const folded: Cardio = await (
    await page.request.get("/api/v1/cardio-activities/" + latest.id)
  ).json();
  expect(folded.startedAt).toBe(foldedStart);
  expect(folded.notes).toBe("Clock-change correction");
  await page.getByLabel("Filter activity type").selectOption("run");
  await expect(
    page.getByText("No activities match these filters."),
  ).toBeVisible();
  await page.getByLabel("Filter activity type").selectOption("skip");
  await audit("cardio-history");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    page.getByText("No activities match these filters."),
  ).toBeVisible();
  expect(
    (
      await page.request.get("/api/v1/cardio-activities/" + activityId)
    ).status(),
  ).toBe(404);
  await page.getByRole("button", { name: "Strength", exact: true }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "View workout", exact: true }),
  ).toHaveCount(0);
  week = await (await page.request.get("/api/v1/weeks/2026-09-07")).json();
  expect(week.entries).toHaveLength(0);
  expect(week.blocks).toHaveLength(1);
});
