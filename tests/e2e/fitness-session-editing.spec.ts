import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("live setup uses creator cards and exercise help returns directly with session state intact", async ({
  page,
}, info) => {
  const write = async (path: string, data: object, version?: number) => {
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
  await write("/api/__test/register", {
    name: "Session editing",
    email: `session-edit-${randomUUID()}@example.com`,
    password: "Synthetic-session-edit-password-123",
  });
  const bench = await write("/api/v1/exercises", {
    name: "Session bench",
    notes: "Keep your feet planted.",
  });
  const extra = await write("/api/v1/exercises", { name: "Session row" });
  const plan = await write("/api/v1/strength-plans", {
    title: "Session adjustment",
    isDraft: false,
    exercises: [
      {
        exerciseId: bench.id,
        sets: Array.from({ length: 3 }, () => ({
          targetReps: 12,
          targetWeightKg: 40,
          restSeconds: 120,
        })),
      },
    ],
  });
  const session = await write(
    `/api/v1/strength-plans/${plan.id}/begin`,
    { startedAt: new Date().toISOString() },
    plan.version,
  );
  const read = async () =>
    (await page.request.get(`/api/v1/strength-workouts/${session.id}`)).json();
  const saved = async () =>
    expect(page.locator(".fitness-save-state")).toHaveText("Saved");
  await page.goto(`/fitness/session/${session.id}`);
  await expect(page.locator(".fitness-save-state")).toHaveClass(/sr-only/);
  await expect(
    page.getByRole("region", { name: "Workout settings", exact: true }),
  ).toBeHidden();
  await expect(
    page.locator("summary").filter({ hasText: "Workout details" }),
  ).toHaveCount(0);

  const current = page.getByRole("region", {
    name: "Current set",
    exact: true,
  });
  await current
    .getByRole("button", { name: "Complete set", exact: true })
    .click();
  await saved();
  const help = page.getByRole("button", {
    name: "Help with Session bench",
    exact: true,
  });
  await help.click();
  const details = page.getByRole("region", {
    name: "Session bench details",
    exact: true,
  });
  await expect(details).toBeVisible();
  await details
    .getByRole("button", { name: "Back to workout", exact: true })
    .click();
  await expect(help).toBeFocused();
  await expect(
    current.getByRole("heading", { name: "Set 2 of 3" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "← Back to workout", exact: true }),
  ).toHaveCount(0);
  await help.click();
  await details.press("Escape");
  await expect(help).toBeFocused();
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await page.getByRole("button", { name: "Edit workout", exact: true }).click();
  const editor = page.getByRole("region", {
    name: "Edit current workout",
    exact: true,
  });
  await expect(editor).toBeVisible();
  // Completing a set alone must not enable saving a duplicate setup.
  await expect(
    page.getByRole("button", { name: "Save as new workout", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("complementary", { name: "Fitness day panel", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("timer", { name: "Rest timer", exact: true }),
  ).toBeVisible();
  const restUntil = await page.evaluate(() => {
    const key = Object.keys(sessionStorage).find((key) =>
      key.startsWith("168hours:rest:"),
    )!;
    return JSON.parse(sessionStorage.getItem(key)!).until;
  });
  if (info.project.name === "desktop") {
    const libraryBounds = await page
      .getByRole("complementary", {
        name: "Exercise library panel",
        exact: true,
      })
      .boundingBox();
    const editorBounds = await editor.boundingBox();
    expect(libraryBounds!.x).toBeGreaterThan(
      editorBounds!.x + editorBounds!.width,
    );
  } else {
    await expect(
      page.getByRole("button", { name: "Your workout", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("button", { name: "Add exercises", exact: true }),
    ).toBeVisible();
  }
  const settings = page.getByRole("region", {
    name: "Workout settings",
    exact: true,
  });
  await expect(settings).toBeVisible();
  await settings
    .getByRole("button", { name: "Toggle workout notes", exact: true })
    .click();
  await settings
    .getByLabel("Workout notes", { exact: true })
    .fill("Steady tempo today");
  await expect(
    page.getByRole("button", { name: "Save changes", exact: true }),
  ).toHaveCount(0);
  await saved();
  const start = settings.getByLabel("Started at", { exact: true });
  await expect(start).toBeHidden();
  await settings
    .getByRole("button", { name: "Adjust start time", exact: true })
    .click();
  await expect(start).toBeVisible();
  const originalStart = (await start.textContent())!.trim();
  const dateTrigger = settings.getByRole("button", {
    name: "Choose start date",
    exact: true,
  });
  await dateTrigger.click();
  const calendar = page.getByRole("dialog", {
    name: "Choose day",
    exact: true,
  });
  const selectedDay = await calendar
    .locator('[aria-pressed="true"]')
    .getAttribute("aria-label");
  await calendar
    .getByRole("button", { name: "Next picker month", exact: true })
    .click();
  await calendar
    .getByRole("button", { name: "Previous picker month", exact: true })
    .click();
  await page.screenshot({ path: info.outputPath("custom-start-calendar.png") });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(calendar).toHaveCount(0);
  await expect(dateTrigger).toBeFocused();
  await dateTrigger.click();
  await dateTrigger.click();
  await expect(calendar).toHaveCount(0);
  await dateTrigger.click();
  const chosenDay = calendar
    .locator(
      '.calendar-picker-days button:not(.outside-month):not([aria-pressed="true"])',
    )
    .first();
  const chosenLabel = await chosenDay.getAttribute("aria-label");
  await chosenDay.click();
  await expect(calendar).toHaveCount(0);
  await expect(start).toHaveText(originalStart);
  await saved();
  await dateTrigger.click();
  await expect(calendar.locator('[aria-pressed="true"]')).toHaveAttribute(
    "aria-label",
    chosenLabel!,
  );
  await calendar
    .getByRole("button", { name: selectedDay!, exact: true })
    .click();
  await saved();
  await start.click({ position: { x: 4, y: 20 } });
  const timePicker = page.getByRole("dialog", {
    name: "Choose start time",
    exact: true,
  });
  await expect(timePicker).toBeVisible();
  await timePicker
    .getByRole("listbox", { name: "Hour", exact: true })
    .press("End");
  await timePicker
    .getByRole("listbox", { name: "Minute", exact: true })
    .evaluate((element) =>
      element.scrollTo({ top: 5 * 44, behavior: "instant" }),
    );
  await expect(
    timePicker
      .getByRole("listbox", { name: "Minute", exact: true })
      .getByRole("option", { name: "05", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await timePicker
    .getByRole("listbox", { name: "AM/PM", exact: true })
    .press("Home");
  await timePicker
    .getByRole("button", { name: "Set time", exact: true })
    .click();
  await expect(start).toHaveText("12:05 AM");
  await saved();
  expect((await read()).startedAt).toContain("T00:05:");
  await start.click();
  await timePicker
    .getByRole("listbox", { name: "AM/PM", exact: true })
    .press("End");
  await timePicker
    .getByRole("button", { name: "Set time", exact: true })
    .click();
  await expect(start).toHaveText("12:05 PM");
  await saved();
  expect((await read()).startedAt).toContain("T12:05:");
  await start.click();
  await page.screenshot({ path: info.outputPath("custom-start-time.png") });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await timePicker
    .getByRole("listbox", { name: "Hour", exact: true })
    .press("ArrowUp");
  await page.keyboard.press("Escape");
  await expect(timePicker).toHaveCount(0);
  await expect(start).toBeFocused();
  await expect(start).toHaveText("12:05 PM");
  await start.click();
  await start.click();
  await expect(timePicker).toHaveCount(0);
  await start.click();
  const originalParts = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(originalStart)!;
  await timePicker
    .getByRole("listbox", { name: "Hour", exact: true })
    .getByRole("option", { name: originalParts[1]!, exact: true })
    .click();
  await timePicker
    .getByRole("listbox", { name: "Minute", exact: true })
    .getByRole("option", { name: originalParts[2]!, exact: true })
    .click();
  await timePicker
    .getByRole("listbox", { name: "AM/PM", exact: true })
    .getByRole("option", { name: originalParts[3]!, exact: true })
    .click();
  await timePicker
    .getByRole("button", { name: "Set time", exact: true })
    .click();
  await saved();
  await page.reload();
  await page.getByRole("button", { name: "Edit workout", exact: true }).click();
  await settings
    .getByRole("button", { name: "Adjust start time", exact: true })
    .click();
  await expect(start).toHaveText(originalStart);
  await expect(
    settings.getByLabel("Workout notes", { exact: true }),
  ).toHaveValue("Steady tempo today");
  await page
    .getByRole("button", { name: "Workout actions", exact: true })
    .click();
  await expect(
    page.getByRole("menuitem", { name: "Discard workout", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("menu", { name: "Workout actions", exact: true })
    .press("Escape");
  await expect(
    page.getByRole("button", { name: "Done editing", exact: true }),
  ).toBeVisible();
  await settings.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("workout-settings.png") });
  await expect(current).toBeHidden();
  await expect(
    editor.getByRole("button", {
      name: "Expand Session bench exercise",
      exact: true,
    }),
  ).toBeVisible();
  await editor
    .getByRole("button", { name: "Expand Session bench exercise", exact: true })
    .click();
  await expect(editor.getByLabel("Sets", { exact: true })).toHaveValue("3");
  await expect(editor.getByLabel("Actual reps", { exact: true })).toHaveCount(
    0,
  );
  await editor
    .getByRole("spinbutton", { name: "Target weight (kg)", exact: true })
    .fill("45");
  await saved();
  let record = await read();
  expect(record.exercises[0].sets[0]).toMatchObject({
    completed: true,
    reps: 12,
    weightKg: 40,
    targetWeightKg: 45,
  });
  await page.screenshot({
    path: info.outputPath("session-setup-editor.png"),
    fullPage: true,
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  if (info.project.name === "phone")
    await editor
      .getByRole("button", { name: "Add exercise", exact: true })
      .click();
  const library = page.getByRole("complementary", {
    name: "Exercise library panel",
    exact: true,
  });
  await library
    .getByRole("searchbox", { name: "Find an exercise", exact: true })
    .fill("Session row");
  await library
    .getByRole("button", { name: "Session row", exact: true })
    .hover();
  await library
    .getByRole("button", { name: "Add Session row", exact: true })
    .click();
  await saved();
  // New cards stay expanded through ID assignment and autosave.
  const added = editor.getByRole("region", {
    name: "Session row exercise 2",
    exact: true,
  });
  await expect(
    added.getByRole("button", {
      name: "Collapse Session row exercise",
      exact: true,
    }),
  ).toBeVisible();
  await added
    .getByRole("spinbutton", { name: "Target reps", exact: true })
    .fill("8");
  await saved();
  await page
    .getByRole("button", { name: "Back to workout", exact: true })
    .click();
  await expect(
    current.getByRole("heading", { name: "Set 2 of 3" }),
  ).toBeVisible();
  await expect(current.getByLabel("Actual reps", { exact: true })).toHaveValue(
    "12",
  );
  await expect(
    current.getByLabel("Actual weight (kg)", { exact: true }),
  ).toHaveValue("45");
  await expect(
    page.getByRole("button", {
      name: "Expand Session row exercise",
      exact: true,
    }),
  ).toBeVisible();
  await expect(settings).toBeHidden();
  if (info.project.name === "desktop")
    await expect(
      page.getByRole("complementary", {
        name: "Fitness day panel",
        exact: true,
      }),
    ).toBeVisible();
  else
    await expect(
      page.getByRole("button", { name: "Day", exact: true }),
    ).toBeVisible();
  await expect(
    page.getByRole("timer", { name: "Rest timer", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => {
      const key = Object.keys(sessionStorage).find((key) =>
        key.startsWith("168hours:rest:"),
      )!;
      return JSON.parse(sessionStorage.getItem(key)!).until;
    }),
  ).toBe(restUntil);
  await expect(
    page.getByRole("button", { name: "Discard workout", exact: true }),
  ).toBeVisible();
  record = await read();
  expect(record.notes).toBe("Steady tempo today");
  expect(record.exercises[1]).toMatchObject({ exerciseId: extra.id });
  expect(record.exercises[1].sets[0]).toMatchObject({
    targetReps: 8,
    completed: false,
    reps: null,
  });
  expect(record.exercises[0].sets[0].weightKg).toBe(40);
  const source = await (
    await page.request.get(`/api/v1/strength-plans/${plan.id}`)
  ).json();
  expect(source.exercises).toHaveLength(1);
  expect(source.exercises[0].sets[0].targetWeightKg).toBe(40);
  await page.getByRole("button", { name: "Edit workout", exact: true }).click();
  const benchCard = editor.getByRole("region", {
    name: "Session bench exercise 1",
    exact: true,
  });
  await benchCard
    .getByRole("spinbutton", { name: "Target reps", exact: true })
    .fill("");
  await saved();
  await page
    .getByRole("button", { name: "Restore starting workout", exact: true })
    .click();
  const restoreToast = page.locator(".app-toast");
  await expect(restoreToast).toContainText("Starting workout restored");
  await restoreToast.hover();
  await saved();
  const restored = await read();
  expect(restored.exercises).toHaveLength(1);
  expect(restored.notes).toBe(null);
  expect(restored.exercises[0].sets[0]).toMatchObject({
    targetReps: 12,
    targetWeightKg: 40,
    reps: 12,
    weightKg: 40,
    completed: true,
  });
  expect(restored.startedAt).toBe(record.startedAt);
  await expect(
    page.getByRole("button", { name: "Restore starting workout", exact: true }),
  ).toHaveCount(0);
  await restoreToast.getByRole("button", { name: "Undo", exact: true }).click();
  await saved();
  expect((await read()).exercises).toHaveLength(2);
  const beforeCopy = await read();
  const createdResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/strength-plans") &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Save as new workout", exact: true })
    .click();
  const copy = await (await createdResponse).json();
  await expect(page).toHaveURL(`/fitness/session/${session.id}`);
  await expect(
    page.getByRole("status").filter({ hasText: "Workout saved" }),
  ).toBeVisible();
  expect(copy.id).not.toBe(plan.id);
  expect(copy.exercises[0].sets[0]).toMatchObject({
    targetReps: null,
    targetWeightKg: 45,
  });
  expect(copy.exercises[1].sets[0].targetReps).toBe(8);
  expect(await read()).toEqual(beforeCopy);
  const originalAfterCopy = await (
    await page.request.get(`/api/v1/strength-plans/${plan.id}`)
  ).json();
  expect(originalAfterCopy).toEqual(source);
  await page
    .locator(".app-toast")
    .getByRole("button", { name: "Edit workout", exact: true })
    .click();
  await expect(page).toHaveURL(`/fitness/workout/${copy.id}`);
  await page.goto(`/fitness/session/${session.id}`);
  await page.getByRole("button", { name: "Edit workout", exact: true }).click();
  const saveCopy = page.getByRole("button", {
    name: "Save as new workout",
    exact: true,
  });
  await expect(saveCopy).toBeDisabled();
  await page
    .getByRole("button", { name: "Restore starting workout", exact: true })
    .click();
  await page.locator(".app-toast").hover();
  await saved();
  await expect(saveCopy).toBeDisabled();
  await page
    .locator(".app-toast")
    .getByRole("button", { name: "Undo", exact: true })
    .click();
  await saved();
  await expect(saveCopy).toBeDisabled();
  await settings
    .getByLabel("Workout name", { exact: true })
    .fill("Another setup version");
  await saved();
  await expect(saveCopy).toBeEnabled();
});

test("restoring starting setup confirms logged removals and survives reload", async ({
  page,
}) => {
  const write = async (
    path: string,
    data: object,
    version?: number,
    method = "POST",
  ) => {
    const response = await page.request.fetch(path, {
      method,
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
  await write("/api/__test/register", {
    name: "Restore workout",
    email: `restore-${randomUUID()}@example.com`,
    password: "Synthetic-restore-password-123",
  });
  const exercise = await write("/api/v1/exercises", { name: "Restore squat" });
  const plan = await write("/api/v1/strength-plans", {
    title: "Starting setup",
    exercises: [{ exerciseId: exercise.id, sets: [{ targetReps: 8 }] }],
  });
  const session = await write(
    `/api/v1/strength-plans/${plan.id}/begin`,
    { startedAt: new Date().toISOString() },
    plan.version,
  );
  const occurrence = session.exercises[0];
  await write(
    `/api/v1/strength-workouts/${session.id}`,
    {
      title: "Edited session",
      notes: null,
      startedAt: session.startedAt,
      endedAt: null,
      linkedTimeBlockId: null,
      exercises: [
        {
          id: occurrence.id,
          exerciseId: exercise.id,
          sets: [
            {
              id: occurrence.sets[0].id,
              targetReps: 10,
              completed: true,
              reps: 9,
            },
            { targetReps: 5, completed: true, reps: 6 },
          ],
        },
      ],
    },
    session.version,
    "PUT",
  );
  const read = async () =>
    (await page.request.get(`/api/v1/strength-workouts/${session.id}`)).json();
  await page.goto(`/fitness/session/${session.id}`);
  await page.reload();
  await page.getByRole("button", { name: "Edit workout", exact: true }).click();
  const saveBounds = await page
    .getByRole("button", { name: "Save as new workout", exact: true })
    .boundingBox();
  const restoreBounds = await page
    .getByRole("button", { name: "Restore starting workout", exact: true })
    .boundingBox();
  expect(restoreBounds!.y).toBe(saveBounds!.y);
  expect(restoreBounds!.x - (saveBounds!.x + saveBounds!.width)).toBeCloseTo(
    10,
    0,
  );
  await page
    .getByRole("button", { name: "Restore starting workout", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Restore starting workout?",
    exact: true,
  });
  await expect(dialog).toContainText("This removes 1 logged set");
  await dialog
    .getByRole("button", { name: "Keep editing", exact: true })
    .click();
  expect((await read()).exercises[0].sets).toHaveLength(2);
  await page
    .getByRole("button", { name: "Restore starting workout", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Restore workout", exact: true })
    .click();
  const toast = page.locator(".app-toast");
  await expect(toast).toContainText("Starting workout restored");
  await toast.hover();
  await expect(page.locator(".fitness-save-state")).toHaveText("Saved");
  const restored = await read();
  expect(restored.title).toBe("Starting setup");
  expect(restored.startedAt).toBe(session.startedAt);
  expect(restored.exercises[0].sets).toHaveLength(1);
  expect(restored.exercises[0].sets[0]).toMatchObject({
    targetReps: 8,
    reps: 9,
    completed: true,
  });
  await toast.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".fitness-save-state")).toHaveText("Saved");
  expect((await read()).exercises[0].sets[1]).toMatchObject({
    reps: 6,
    completed: true,
  });
  await page.reload();
  await page.getByRole("button", { name: "Edit workout", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Restore starting workout", exact: true }),
  ).toBeVisible();
});

test("Done editing flushes pending changes and keeps save failures in a tidy retry footer", async ({
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
  await post("/api/__test/register", {
    name: "Done editing",
    email: `done-${randomUUID()}@example.com`,
    password: "Synthetic-done-password-123",
  });
  const session = await post("/api/v1/strength-workouts", {
    title: "Live workout",
    startedAt: new Date().toISOString(),
  });
  await page.goto(`/fitness/session/${session.id}`);
  const settings = page.getByRole("region", {
    name: "Workout settings",
    exact: true,
  });
  const edit = () =>
    page.getByRole("button", { name: "Edit workout", exact: true }).click();
  const done = () =>
    page.getByRole("button", { name: "Done editing", exact: true }).click();
  const title = settings.getByLabel("Workout name", { exact: true });
  let mode: "hold" | "known" | "uncertain" | "pass" = "hold";
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const writes: { key: string; body: string }[] = [];
  await page.route(
    `**/api/v1/strength-workouts/${session.id}`,
    async (route) => {
      if (route.request().method() !== "PUT") return route.continue();
      writes.push({
        key: route.request().headers()["idempotency-key"]!,
        body: route.request().postData()!,
      });
      const current = mode;
      mode = "pass";
      if (current === "hold") {
        await gate;
        return route.continue();
      }
      if (current === "known")
        return route.fulfill({
          status: 422,
          contentType: "application/json",
          body: JSON.stringify({
            error: {
              code: "BUSINESS_RULE",
              message: "This change could not be saved. Please retry.",
            },
          }),
        });
      if (current === "uncertain") {
        const response = await route.fetch();
        expect(response.ok()).toBe(true);
        return route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({
            error: {
              code: "UNAVAILABLE",
              message: "Save confirmation unavailable.",
            },
          }),
        });
      }
      return route.continue();
    },
  );
  await edit();
  await title.fill("Updated workout");
  await done();
  await expect(
    page.getByRole("button", { name: "Saving…", exact: true }),
  ).toBeDisabled();
  await expect(settings).toBeVisible();
  release();
  await expect(settings).toBeHidden();
  expect(
    (
      await (
        await page.request.get(`/api/v1/strength-workouts/${session.id}`)
      ).json()
    ).title,
  ).toBe("Updated workout");

  await edit();
  mode = "known";
  await title.fill("Retry known failure");
  await done();
  const feedback = page.locator(".fitness-session-save-feedback");
  const retry = page.getByRole("button", { name: "Retry save", exact: true });
  await expect(feedback).toContainText("Changes not saved");
  await expect(retry).toHaveClass(/primary/);
  await expect(retry).toHaveCount(1);
  await page.screenshot({ path: info.outputPath("editor-save-failed.png") });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const knownKey = writes.at(-1)!.key;
  await retry.click();
  await expect(settings).toBeHidden();
  expect(writes.at(-1)!.key).not.toBe(knownKey);

  await edit();
  mode = "uncertain";
  await title.fill("Retry uncertain save");
  await done();
  await expect(feedback).toContainText("couldn't confirm your last save");
  await expect(retry).toBeEnabled();
  const uncertain = writes.at(-1)!;
  await page.screenshot({ path: info.outputPath("editor-save-uncertain.png") });
  await retry.click();
  await expect(settings).toBeHidden();
  expect(writes.at(-1)).toEqual(uncertain);

  await edit();
  const count = writes.length;
  await done();
  await expect(settings).toBeHidden();
  expect(writes).toHaveLength(count);
  await edit();
  await title.fill("");
  await done();
  await expect(settings).toBeVisible();
  await expect(title).toBeFocused();
  expect(writes).toHaveLength(count);
});
