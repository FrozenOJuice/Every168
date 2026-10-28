import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.use({ actionTimeout: 10000, reducedMotion: "reduce" });

test("adding from details confirms saved changes, retries safely and offers contextual editing or a new draft", async ({
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
    name: "Add tester",
    email: `add-${randomUUID()}@example.com`,
    password: "Synthetic-add-password-123",
  });
  const exercise = await post("/api/v1/exercises", {
    name: "Step up",
    loggingType: "reps_load",
    equipment: ["Dumbbells"],
    muscles: ["Legs"],
  });
  const plan = await post("/api/v1/strength-plans", {
    title: "Leg day",
    exercises: [
      {
        exerciseId: exercise.id,
        loggingType: "reps_load",
        sets: [{ targetReps: 8, targetWeightKg: 20 }],
      },
    ],
  });
  const source = `/fitness/exercises/${exercise.id}`;
  await page.goto(source);
  await page
    .getByRole("button", { name: "Add to workout", exact: true })
    .click();
  const dialog = page.getByRole("region", {
    name: "Choose a workout",
    exact: true,
  });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "Select a workout", exact: true }),
  ).toBeDisabled();
  await expect(dialog.getByRole("radio")).not.toBeChecked();
  await dialog.getByRole("radio", { name: /Leg day/ }).check();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: info.outputPath("workout-destination.png") });
  await page.clock.install({ time: new Date() });
  const attempts: { key: string; body: string; version: string }[] = [];
  await page.route(`**/api/v1/strength-plans/${plan.id}`, async (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    attempts.push({
      key: route.request().headers()["idempotency-key"]!,
      body: route.request().postData()!,
      version: route.request().headers()["if-match"]!,
    });
    if (attempts.length === 1) {
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await dialog
    .getByRole("button", { name: "Add to Leg day", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Retry same change", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "Retry same change", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Add to workout", exact: true }),
  ).toBeFocused();
  expect(attempts).toHaveLength(2);
  expect(attempts[1]).toEqual(attempts[0]);
  await expect(page).toHaveURL(new RegExp(`${exercise.id}$`));
  await expect(page.getByRole("status")).toContainText(
    "Step up added to Leg day.",
  );
  const saved = await (
    await page.request.get(`/api/v1/strength-plans/${plan.id}`)
  ).json();
  expect(saved.exercises).toHaveLength(2);
  expect(saved.exercises[0].sets[0].targetReps).toBe(8);
  const toast = page.locator(".app-toast");
  const edit = toast.getByRole("button", { name: "Edit workout", exact: true });
  await edit.focus();
  await page.clock.runFor(9000);
  await expect(toast).toBeVisible();
  if (info.project.name === "desktop") {
    await toast.hover();
    await page
      .getByRole("button", { name: "Add to workout", exact: true })
      .focus();
    await page.clock.runFor(9000);
    await expect(toast).toBeVisible();
    await edit.focus();
    await page.mouse.move(0, 0);
    await page.clock.runFor(9000);
    await expect(toast).toBeVisible();
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: info.outputPath("exercise-added-toast.png"),
    animations: "disabled",
  });
  await edit.click();
  const added = page.getByRole("region", {
    name: "Step up exercise 2",
    exact: true,
  });
  await expect(added).toBeFocused();
  await expect(
    added.getByRole("button", {
      name: "Collapse Step up exercise",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText("Step up was added and saved. Set its targets below.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath("added-exercise-editor.png") });
  await page
    .getByRole("button", { name: "Back to exercise", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`${exercise.id}$`));
  await page
    .getByRole("button", { name: "Add to workout", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Create new workout", exact: true })
    .click();
  await expect(
    page.getByText("New workout — not saved yet.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Step up exercise 1", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Back to exercise", exact: true })
    .click();
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(
    page.getByText("New workout — not saved yet.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Back to exercise", exact: true })
    .click();
  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${exercise.id}$`));
  const plans = await (
    await page.request.get("/api/v1/strength-plans?kind=workout")
  ).json();
  expect(plans.items).toHaveLength(1);
  await page
    .getByRole("button", { name: "Add to workout", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Add to workout", exact: true }),
  ).toBeFocused();
  await page
    .getByRole("button", { name: "Add to workout", exact: true })
    .click();
  await dialog.getByRole("radio", { name: /Leg day/ }).check();
  await dialog
    .getByRole("button", { name: "Add to Leg day", exact: true })
    .click();
  await expect(toast).toBeVisible();
  await edit.focus();
  await page.clock.runFor(9000);
  await expect(toast).toBeVisible();
  await page
    .getByRole("button", { name: "Add to workout", exact: true })
    .focus();
  await page.mouse.move(0, 0);
  await page.clock.runFor(8100);
  await expect(toast).toHaveCount(0);
});

test("workout search covers unloaded results and the bounded chooser keeps selection independently", async ({
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
    name: "Search tester",
    email: `search-${randomUUID()}@example.com`,
    password: "Synthetic-search-password-123",
  });
  const exercise = await post("/api/v1/exercises", { name: "Step up" });
  const target = await post("/api/v1/strength-plans", {
    title: "Older leg day",
    isDraft: true,
    exercises: [],
  });
  for (let i = 0; i < 13; i++)
    await post("/api/v1/strength-plans", {
      title: `Workout ${i}`,
      isDraft: true,
      exercises: [],
    });
  await page.goto("/fitness");
  const overview = page.getByRole("region", {
    name: "My workouts",
    exact: true,
  });
  await expect(
    overview.getByRole("button", { name: "Load more workouts", exact: true }),
  ).toBeVisible();
  await expect(
    overview.getByText("Older leg day", { exact: true }),
  ).toHaveCount(0);
  await overview
    .getByRole("searchbox", { name: "Search workouts", exact: true })
    .fill("older LEG");
  await expect(
    overview.getByText("Older leg day", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: info.outputPath("draft-workout-card.png") });
  await expect(
    overview.getByRole("button", { name: "Load more workouts", exact: true }),
  ).toHaveCount(0);
  await overview.getByRole("searchbox").fill("no matching title");
  await expect(
    overview.getByText("No workouts match your search."),
  ).toBeVisible();
  await page.goto(`/fitness/exercises/${exercise.id}`);
  await page
    .getByRole("button", { name: "Add to workout", exact: true })
    .click();
  const chooser = page.getByRole("region", {
    name: "Choose a workout",
    exact: true,
  });
  const search = chooser.getByRole("searchbox", {
    name: "Search workouts",
    exact: true,
  });
  await expect(search).toHaveValue("");
  await expect(chooser.getByRole("radio")).toHaveCount(12);
  const destinations = chooser.locator(".fitness-workout-destination");
  const first = await destinations.nth(0).boundingBox();
  const second = await destinations.nth(1).boundingBox();
  if (info.project.name === "desktop") {
    expect(Math.abs(first!.y - second!.y)).toBeLessThan(2);
    expect(second!.x).toBeGreaterThan(first!.x + first!.width);
  } else {
    expect(second!.y).toBeGreaterThan(first!.y + first!.height);
    expect(second!.x).toBe(first!.x);
  }
  const list = chooser.locator(".fitness-workout-results");
  const bounds = await list.evaluate((el) => ({
    height: el.clientHeight,
    total: el.scrollHeight,
  }));
  expect(bounds.total).toBeGreaterThan(bounds.height);
  expect(bounds.height).toBeLessThanOrEqual(340);
  await chooser.getByRole("radio").first().check();
  const add = chooser.getByRole("button", {
    name: "Add to Workout 12",
    exact: true,
  });
  await add.scrollIntoViewIfNeeded();
  const before = await add.boundingBox();
  await chooser
    .getByRole("button", { name: "Load more workouts", exact: true })
    .click();
  await expect(chooser.getByRole("radio")).toHaveCount(14);
  const after = await add.boundingBox();
  expect(Math.abs(after!.y - before!.y)).toBeLessThan(2);
  await search.fill("older");
  await expect(chooser.getByRole("radio")).toHaveCount(1);
  await expect(add).toBeEnabled();
  await chooser.getByRole("radio", { name: /Older leg day/ }).check();
  await search.fill("no matching title");
  await expect(
    chooser.getByText("No workouts match your search."),
  ).toBeVisible();
  await expect(
    chooser.getByRole("button", { name: "Add to Older leg day", exact: true }),
  ).toBeEnabled();
  await search.fill("");
  await expect(
    chooser.getByRole("radio", { name: /Older leg day/ }),
  ).toBeChecked();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await chooser
    .getByRole("button", { name: "Add to Older leg day", exact: true })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("searchable-workouts.png") });
  await chooser
    .getByRole("button", { name: "Add to Older leg day", exact: true })
    .click();
  await expect(page.locator(".app-toast")).toContainText(
    "Step up added to Older leg day.",
  );
  const saved = await (
    await page.request.get(`/api/v1/strength-plans/${target.id}`)
  ).json();
  expect(saved.exercises).toHaveLength(1);
});
