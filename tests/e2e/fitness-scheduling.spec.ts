import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("schedule uses the selected day, preserves duration, validates inline and confirms the reservation", async ({
  page,
}, info) => {
  const post = async (path: string, data: object) => {
    const response = await page.request.post(path, {
      headers: {
        Origin: "http://localhost:3100",
        "Idempotency-Key": randomUUID(),
      },
      data,
    });
    expect(response.ok()).toBe(true);
    return response.json();
  };
  await post("/api/auth/sign-up/email", {
    name: "Schedule tester",
    email: `schedule-${randomUUID()}@example.com`,
    password: "Synthetic-schedule-password-123",
  });
  const me = await (await page.request.get("/api/v1/me")).json();
  const prefs = await page.request.put("/api/v1/preferences", {
    headers: {
      Origin: "http://localhost:3100",
      "Idempotency-Key": randomUUID(),
      "If-Match": `"${me.preferences.version}"`,
    },
    data: {
      timezone: "America/Edmonton",
      weekStartsOn: 1,
      weightUnit: "kg",
      distanceUnit: "km",
    },
  });
  expect(prefs.ok()).toBe(true);
  const exercise = await post("/api/v1/exercises", {
    name: "Test squat",
    loggingType: "reps_load",
  });
  const plan = await post("/api/v1/strength-plans", {
    title: "Leg day",
    exercises: [
      {
        exerciseId: exercise.id,
        sets: [{ targetReps: 10, targetWeightKg: 50 }],
      },
    ],
  });
  await page.goto("/fitness?date=2026-10-30");
  const scheduleButton = page.getByRole("button", {
    name: "Schedule",
    exact: true,
  });
  await expect(scheduleButton).toBeVisible();
  await page.clock.install({ time: new Date("2026-10-27T15:07:00Z") });
  await scheduleButton.click();
  const dialog = page.getByRole("dialog", {
    name: "Schedule workout",
    exact: true,
  });
  const start = dialog.getByRole("group", { name: "Start", exact: true });
  const end = dialog.getByRole("group", { name: "End", exact: true });
  await expect(dialog.getByText("Leg day", { exact: true })).toBeVisible();
  await expect(
    dialog.getByText("America/Edmonton", { exact: true }),
  ).toHaveCount(0);
  await expect(
    start.getByRole("button", { name: "Choose start date" }),
  ).toHaveText("Oct 30, 2026");
  await expect(
    start.getByRole("button", { name: "Choose start time" }),
  ).toContainText("9:15 AM");
  await expect(
    end.getByRole("button", { name: "Choose end time" }),
  ).toContainText("10:15 AM");
  await expect(
    dialog.getByText("Duration: 1 hour", { exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await scheduleButton.click();
  await start.getByRole("button", { name: "Choose start date" }).click();
  const calendar = page.getByRole("dialog", {
    name: "Choose day",
    exact: true,
  });
  await expect(calendar).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(
    start.getByRole("button", { name: "Choose start date" }),
  ).toBeFocused();
  await start.getByRole("button", { name: "Choose start date" }).click();
  await calendar
    .getByRole("button", { name: "Saturday, October 31, 2026", exact: true })
    .click();
  await expect(end.getByRole("button", { name: "Choose end date" })).toHaveText(
    "Oct 31, 2026",
  );
  await start.getByRole("button", { name: "Choose start time" }).click();
  const startTime = page.getByRole("dialog", {
    name: "Choose start time",
    exact: true,
  });
  await startTime
    .getByRole("listbox", { name: "Hour", exact: true })
    .press("End");
  await startTime
    .getByRole("listbox", { name: "Hour", exact: true })
    .press("ArrowUp");
  await startTime
    .getByRole("listbox", { name: "Minute", exact: true })
    .press("Home");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await startTime
    .getByRole("button", { name: "Set time", exact: true })
    .click();
  await expect(
    start.getByRole("button", { name: "Choose start time" }),
  ).toContainText("11:00 AM");
  await expect(
    end.getByRole("button", { name: "Choose end time" }),
  ).toContainText("12:00 PM");
  const setEnd = async (valid: boolean) => {
    await end.getByRole("button", { name: "Choose end time" }).click();
    const picker = page.getByRole("dialog", {
      name: "Choose end time",
      exact: true,
    });
    const hour = picker.getByRole("listbox", { name: "Hour", exact: true });
    await hour.press("End");
    if (!valid) {
      await hour.press("ArrowUp");
      await hour.press("ArrowUp");
    }
    await picker
      .getByRole("listbox", { name: "AM/PM", exact: true })
      .press(valid ? "End" : "Home");
    await picker.getByRole("button", { name: "Set time", exact: true }).click();
  };
  await setEnd(false);
  await dialog
    .getByRole("button", { name: "Schedule workout", exact: true })
    .click();
  await expect(end.getByRole("alert")).toHaveText("End must be after start.");
  await expect(
    end.getByRole("button", { name: "Choose end time" }),
  ).toBeFocused();
  await expect(
    end.getByRole("button", { name: "Choose end time" }),
  ).toHaveAttribute("data-invalid", "true");
  await setEnd(true);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  const confirm = page.getByRole("dialog", {
    name: "Discard schedule changes?",
    exact: true,
  });
  await confirm
    .getByRole("button", { name: "Keep editing", exact: true })
    .click();
  if (info.project.name === "phone")
    await page.setViewportSize({ width: 320, height: 844 });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: info.outputPath("schedule-workout.png") });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await dialog
    .getByRole("button", { name: "Schedule workout", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(/date=2026-10-31/);
  await expect(
    page.getByRole("status").filter({ hasText: "Leg day scheduled for" }),
  ).toBeVisible();
  const scheduled = await (
    await page.request.get("/api/v1/strength-plans?kind=scheduled")
  ).json();
  expect(scheduled.items).toHaveLength(1);
  const block = await (
    await page.request.get(
      `/api/v1/time-blocks/${scheduled.items[0].timeBlockId}`,
    )
  ).json();
  expect(Date.parse(block.startsAt)).toBe(Date.parse("2026-10-31T17:00:00Z"));
  expect(Date.parse(block.endsAt)).toBe(Date.parse("2026-10-31T18:00:00Z"));
  expect(
    (await (await page.request.get("/api/v1/strength-workouts")).json()).items,
  ).toHaveLength(0);
  expect(
    (await (await page.request.get(`/api/v1/strength-plans/${plan.id}`)).json())
      .version,
  ).toBe(plan.version);
  await page
    .getByRole("button", { name: "View in Calendar", exact: true })
    .click();
  await expect(page).toHaveURL(/date=2026-10-31&view=day/);
  await page
    .getByRole("region", { name: "Daily time grid", exact: true })
    .getByRole("button", { name: /Leg day.*planned/ })
    .dblclick();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Start workout", exact: true })
    .click();
  await expect(page).toHaveURL(/fitness\/session\//);
  expect(
    (await (await page.request.get("/api/v1/strength-workouts")).json()).items,
  ).toHaveLength(1);
});
