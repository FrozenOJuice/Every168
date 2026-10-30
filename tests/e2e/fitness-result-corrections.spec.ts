import { randomUUID } from "node:crypto";
import { expect, test, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("result corrections explain outcomes and explicitly save pause corrections with a compact footer", async ({
  page,
}, info) => {
  const write = async (path: string, data: object, version?: number) => {
    const response = await page.request[version ? "put" : "post"](path, {
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
  await write("/api/auth/sign-up/email", {
    name: "Results correction",
    email: `corrections-${randomUUID()}@example.com`,
    password: "Synthetic-corrections-password-123",
  });
  const me = await (await page.request.get("/api/v1/me")).json();
  await write(
    "/api/v1/preferences",
    { timezone: "UTC", weekStartsOn: 1, weightUnit: "kg", distanceUnit: "km" },
    me.preferences.version,
  );
  const bench = await write("/api/v1/exercises", { name: "Correction bench" });
  const row = await write("/api/v1/exercises", { name: "Skipped row" });
  const run = await write("/api/v1/exercises", { name: "Unfinished run" });
  const session = await write("/api/v1/strength-workouts", {
    title: "Paused results",
    startedAt: "2026-10-25T12:00:00Z",
  });
  const saved = await write(
    `/api/v1/strength-workouts/${session.id}`,
    {
      title: session.title,
      startedAt: session.startedAt,
      endedAt: "2026-10-25T16:00:00Z",
      pauses: [
        { startsAt: "2026-10-25T12:30:00Z", endsAt: "2026-10-25T13:00:00Z" },
        {
          startsAt: "2026-10-25T14:00:00.125Z",
          endsAt: "2026-10-25T14:30:00.125Z",
        },
      ],
      exercises: [
        {
          exerciseId: bench.id,
          sets: [
            {
              completed: true,
              reps: 10,
              weightKg: 50,
              targetReps: 12,
              targetWeightKg: 55,
            },
          ],
        },
        {
          exerciseId: row.id,
          sets: [{ skipped: true, completed: false, targetReps: 12 }],
        },
        {
          exerciseId: run.id,
          loggingType: "duration",
          sets: [{ completed: false, targetDurationSeconds: 60 }],
        },
      ],
    },
    session.version,
  );
  const read = async () =>
    (await page.request.get(`/api/v1/strength-workouts/${session.id}`)).json();
  const open = async () => {
    await page
      .getByRole("button", { name: "Correct results", exact: true })
      .click();
    const trigger = page.getByText("Adjust workout time", { exact: true });
    if ((await trigger.getAttribute("aria-expanded")) !== "true")
      await trigger.click();
  };
  const setTime = async (trigger: Locator, hour: number, minute: number) => {
    await trigger.click();
    const picker = page.getByRole("dialog", { name: /^Choose .* time$/ });
    const hours = picker.getByRole("listbox", { name: "Hour", exact: true });
    await hours.press("Home");
    for (let n = 1; n < hour; n++) await hours.press("ArrowDown");
    const minutes = picker.getByRole("listbox", {
      name: "Minute",
      exact: true,
    });
    await minutes.press("Home");
    for (let n = 0; n < minute; n++) await minutes.press("ArrowDown");
    await picker
      .getByRole("listbox", { name: "AM/PM", exact: true })
      .press("End");
    await picker.getByRole("button", { name: "Set time", exact: true }).click();
  };
  await page.goto(`/fitness/session/${session.id}`);
  await open();
  const editor = page.locator(".fitness-correct-results");
  const preview = editor.locator('dl[aria-label="Corrected workout time"]');
  await expect(preview.getByRole("definition").nth(0)).toHaveText("3h");
  await expect(preview.getByRole("definition").nth(1)).toHaveText("1h");
  await expect(preview.getByRole("definition").nth(2)).toHaveText("4h");
  await expect(
    editor.getByRole("heading", { name: "Timing", exact: true }),
  ).toHaveCount(0);
  await expect(editor).not.toContainText(
    "Correct recorded results. Your reusable workout stays unchanged.",
  );
  await expect(
    editor
      .getByRole("region", { name: "Skipped row exercise 2", exact: true })
      .locator(".fitness-exercise-target-summary"),
  ).toHaveText("Skipped");
  await expect(
    editor
      .getByRole("region", { name: "Unfinished run exercise 3", exact: true })
      .locator(".fitness-exercise-target-summary"),
  ).toHaveText("Unfinished");
  await page
    .getByRole("button", {
      name: "Expand Correction bench exercise",
      exact: true,
    })
    .click();
  const set = editor.getByRole("group", { name: "Set 1", exact: true }).first();
  const originalViewport = page.viewportSize()!;
  if (info.project.name === "phone")
    await page.setViewportSize({ width: 320, height: 740 });
  await set
    .getByRole("button", { name: "Measurements for set 1", exact: true })
    .click();
  const configuration = set.locator(".fitness-set-configuration");
  for (const name of ["Duration", "Distance", "Laps"])
    await configuration.getByRole("checkbox", { name, exact: true }).check();
  const configurationBox = await configuration.boundingBox();
  const listBox = await editor
    .locator(".fitness-workout-set-list")
    .first()
    .boundingBox();
  expect(configurationBox!.width).toBeGreaterThan(listBox!.width * 0.75);
  expect(configurationBox!.width).toBeLessThanOrEqual(listBox!.width + 1);
  expect(configurationBox!.x).toBeGreaterThanOrEqual(listBox!.x - 1);
  expect(configurationBox!.x + configurationBox!.width).toBeLessThanOrEqual(
    listBox!.x + listBox!.width + 1,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await configuration.screenshot({
    path: info.outputPath("set-measurement-options.png"),
  });
  await configuration
    .getByRole("button", { name: "Use exercise defaults", exact: true })
    .click();
  await expect(set.getByLabel("Actual reps", { exact: true })).toHaveValue(
    "10",
  );
  await set
    .getByRole("button", { name: "Measurements for set 1", exact: true })
    .click();
  if (info.project.name === "phone")
    await page.setViewportSize(originalViewport);
  await expect(
    set
      .locator(".fitness-recorded-set-header")
      .getByRole("button", { name: "Set 1 status", exact: true }),
  ).toBeVisible();
  await set.getByRole("button", { name: "Set 1 status", exact: true }).click();
  await page.getByRole("option", { name: "Skipped", exact: true }).click();
  await expect(set).toContainText("Values don’t count until completed.");
  await set.screenshot({ path: info.outputPath("skipped-correction-set.png") });
  await expect(set.getByLabel("Actual reps", { exact: true })).toHaveValue(
    "10",
  );
  await expect(
    editor
      .getByRole("region", { name: "Correction bench exercise 1", exact: true })
      .locator(".fitness-exercise-target-summary"),
  ).toHaveText("Skipped");
  await set.getByRole("button", { name: "Set 1 status", exact: true }).click();
  await page.getByRole("option", { name: "Completed", exact: true }).click();
  await expect(set).not.toContainText("Values don’t count until completed.");
  const pause1 = editor.getByRole("region", { name: "Pause 1", exact: true });
  await setTime(editor.getByLabel("Started at", { exact: true }), 1, 0);
  await expect(editor).toContainText(
    "Pauses must be ordered, non-overlapping and inside the workout",
  );
  await expect(pause1).toBeAttached();
  await expect(preview).toContainText("Check times");
  await page
    .getByRole("button", { name: "Save corrections", exact: true })
    .click();
  expect((await read()).version).toBe(saved.version);
  await setTime(editor.getByLabel("Started at", { exact: true }), 12, 0);
  await setTime(pause1.getByLabel("Resumed at", { exact: true }), 3, 0);
  await expect(editor).toContainText(
    "Pauses must be ordered, non-overlapping and inside the workout",
  );
  await setTime(pause1.getByLabel("Resumed at", { exact: true }), 1, 15);
  await expect(preview.getByRole("definition").nth(0)).toHaveText("2h 45m");
  await expect(preview.getByRole("definition").nth(1)).toHaveText("1h 15m");
  expect((await read()).pauses).toEqual(saved.pauses);
  await editor
    .locator(".fitness-pause-corrections")
    .screenshot({ path: info.outputPath("pause-corrections.png") });
  await page.reload();
  await page.getByText("Adjust workout time", { exact: true }).click();
  await expect(preview.getByRole("definition").nth(0)).toHaveText("2h 45m");
  await editor
    .getByRole("button", { name: "Remove pause 2", exact: true })
    .click();
  await expect(preview.getByRole("definition").nth(0)).toHaveText("3h 15m");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Discard corrections?", exact: true })
    .getByRole("button", { name: "Discard corrections", exact: true })
    .click();
  expect((await read()).pauses).toEqual(saved.pauses);
  await open();
  await setTime(pause1.getByLabel("Resumed at", { exact: true }), 1, 15);
  if (info.project.name === "phone")
    await page.setViewportSize({ width: 320, height: 740 });
  const cancel = await editor
    .getByRole("button", { name: "Cancel", exact: true })
    .boundingBox();
  const save = await editor
    .getByRole("button", { name: "Save corrections", exact: true })
    .boundingBox();
  expect(Math.abs(cancel!.y - save!.y)).toBeLessThan(2);
  expect(cancel!.height).toBeGreaterThanOrEqual(44);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await editor
    .locator(".fitness-builder-footer")
    .screenshot({ path: info.outputPath("correction-footer.png") });
  await page
    .getByRole("button", { name: "Save corrections", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Paused results - Summary",
      exact: true,
    }),
  ).toBeVisible();
  const result = await read();
  expect(result.pauses).toHaveLength(2);
  expect(Date.parse(result.pauses[0].endsAt)).toBe(
    Date.parse("2026-10-25T13:15:00Z"),
  );
  expect(result.pauses[1]).toEqual(saved.pauses[1]);
  await open();
  await editor
    .getByRole("button", { name: "Remove pause 2", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save corrections", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Paused results - Summary",
      exact: true,
    }),
  ).toBeVisible();
  expect((await read()).pauses).toHaveLength(1);
  await page.reload();
  await expect(
    page.locator(".fitness-summary-stats").getByRole("definition").first(),
  ).toContainText("3h 15m");
  const beforeTimezone = await read();
  await page.goto("/settings");
  await page.getByLabel("Timezone", { exact: true }).fill("America/Edmonton");
  await page
    .getByRole("button", { name: "Save preferences", exact: true })
    .click();
  await expect(
    page.getByText("Preferences saved.", { exact: true }),
  ).toBeVisible();
  await page.goto(`/fitness/session/${session.id}`);
  await open();
  await expect(editor.getByLabel("Started at", { exact: true })).toContainText(
    "6:00 AM",
  );
  await expect(pause1.getByLabel("Paused at", { exact: true })).toContainText(
    "6:30 AM",
  );
  await expect(pause1.getByLabel("Resumed at", { exact: true })).toContainText(
    "7:15 AM",
  );
  await expect(editor).not.toContainText("America/Edmonton");
  await expect(preview.getByRole("definition").first()).toHaveText("3h 15m");
  const afterTimezone = await read();
  expect(afterTimezone.startedAt).toBe(beforeTimezone.startedAt);
  expect(afterTimezone.endedAt).toBe(beforeTimezone.endedAt);
  expect(afterTimezone.pauses).toEqual(beforeTimezone.pauses);
});
