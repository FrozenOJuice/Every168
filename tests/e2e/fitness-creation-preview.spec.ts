import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("creation preview keeps library beside draft and saves shared and individual set targets", async ({
  page,
}, testInfo) => {
  await page.request.post("/api/auth/sign-up/email", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      name: "Creation preview",
      email: `preview-${randomUUID()}@example.com`,
      password: "Synthetic-preview-password-123",
    },
  });
  await page.goto("/fitness/workout/new");
  const draft = page.getByRole("region", {
    name: "Workout workspace",
    includeHidden: true,
  });
  const library = page.getByRole("complementary", {
    name: "Exercise library panel",
  });
  await expect(
    page.getByRole("complementary", { name: "Fitness day panel" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Day", exact: true }),
  ).toHaveCount(0);
  await draft
    .getByLabel("Workout title", { exact: true })
    .fill("Preview workout");
  if (testInfo.project.name === "phone")
    await page
      .getByRole("button", { name: "Add exercises", exact: true })
      .click();
  else {
    await expect(library).toBeVisible();
    const left = await draft.boundingBox();
    const right = await library.boundingBox();
    expect(left!.x + left!.width).toBeLessThanOrEqual(right!.x);
    expect(left!.width).toBeGreaterThan(right!.width);
  }
  await library
    .getByRole("searchbox", { name: "Find an exercise", exact: true })
    .fill("Squat");
  await library.getByRole("button", { name: "Squat", exact: true }).hover();
  await library.getByRole("button", { name: "Add Squat", exact: true }).click();
  await expect(
    draft.getByRole("button", { name: "Collapse Squat exercise", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  const quick = draft.locator(".fitness-quick-targets");
  await expect(draft.getByText("Workout targets", { exact: true })).toHaveCount(
    0,
  );
  await expect(draft.getByText("Individual sets", { exact: true })).toHaveCount(
    0,
  );
  const count = quick.getByLabel("Sets", { exact: true });
  const singleSetRest = quick.getByRole("button", {
    name: "Rest between sets",
    exact: true,
  });
  await expect(singleSetRest).toBeVisible();
  await expect(singleSetRest).toBeDisabled();
  await expect(singleSetRest).toHaveAccessibleDescription(
    "Requires at least 2 sets",
  );
  const singleSetRestHeight = (await singleSetRest.boundingBox())!.height;
  await expect(
    quick.getByRole("textbox", { name: "Rest minutes", exact: true }),
  ).toBeHidden();
  await count.fill("");
  await expect(count).toHaveValue("");
  await count.blur();
  await expect(count).toHaveValue("1");
  await count.fill("");
  await count.fill("3");
  await count.blur();
  await expect(count).toHaveValue("3");
  await expect(singleSetRest).toBeEnabled();
  await expect(
    quick.getByText("Requires at least 2 sets", { exact: true }),
  ).toHaveCount(0);
  expect((await singleSetRest.boundingBox())!.height).toBeCloseTo(
    singleSetRestHeight,
    0,
  );
  await quick.getByLabel("Target reps", { exact: true }).fill("8");
  await quick.getByLabel("Target load (kg)", { exact: true }).fill("40");
  await expect(draft.locator(".fitness-exercise-target-summary")).toHaveText(
    "3 × 8 · 40 kg",
  );
  const restHeading = quick.getByRole("button", {
    name: "Rest between sets",
    exact: true,
  });
  const restPanelWidth = (await quick
    .locator(".fitness-rest-disclosure")
    .boundingBox())!.width;
  expect((await restHeading.boundingBox())!.width).toBeCloseTo(
    restPanelWidth - 2,
    0,
  );
  await restHeading.click();
  const restMinutes = quick.getByRole("textbox", {
    name: "Rest minutes",
    exact: true,
  });
  const restSeconds = quick.getByRole("textbox", {
    name: "Rest seconds",
    exact: true,
  });
  await restSeconds.fill("90");
  await restSeconds.blur();
  await expect(restMinutes).toHaveValue("01");
  await expect(restSeconds).toHaveValue("30");
  await expect(quick.locator(".fitness-rest-summary")).toHaveText("1m 30s");
  await expect(quick.locator(".fitness-note-indicator")).toHaveCount(0);
  await restMinutes.fill("");
  await expect(restMinutes).toHaveValue("");
  await restSeconds.fill("");
  await restSeconds.blur();
  await expect(restMinutes).toHaveValue("");
  await expect(restSeconds).toHaveValue("");
  await expect(quick.locator(".fitness-rest-summary")).toHaveText(
    "Rest as needed",
  );
  await restMinutes.fill("2");
  await restHeading.click();
  await restHeading.click();
  await expect(restSeconds).toHaveValue("");
  await restMinutes.fill("");
  await restMinutes.blur();
  await expect(quick.locator(".fitness-rest-summary")).toHaveText(
    "Rest as needed",
  );
  await expect(restSeconds).toHaveValue("");
  await restSeconds.fill("30");
  await restSeconds.blur();
  await expect(restMinutes).toHaveValue("");
  await restSeconds.fill("");
  await restSeconds.blur();
  await expect(quick.locator(".fitness-rest-summary")).toHaveText(
    "Rest as needed",
  );
  await restMinutes.fill("0");
  await restSeconds.fill("0");
  await restSeconds.blur();
  await expect(quick.locator(".fitness-rest-summary")).toHaveText("No rest");
  await restMinutes.fill("60");
  await restSeconds.fill("59");
  await restSeconds.blur();
  await expect(restMinutes).toHaveValue("60");
  await expect(restSeconds).toHaveValue("");
  await restMinutes.click();
  await restMinutes.pressSequentially("1");
  await restMinutes.press("Tab");
  await restSeconds.pressSequentially("30");
  await expect(restSeconds).toHaveValue("30");
  await restSeconds.blur();
  const restToggle = quick.getByRole("button", {
    name: "Rest between sets",
    exact: true,
  });
  await expect(restToggle).toHaveAttribute("aria-expanded", "true");
  await restToggle.press("Space");
  await expect(restSeconds).toBeHidden();
  expect((await restToggle.boundingBox())!.width).toBeCloseTo(
    restPanelWidth - 2,
    0,
  );
  await restToggle.click();
  await expect(restSeconds).toHaveValue("30");
  await count.fill("1");
  await count.blur();
  await expect(singleSetRest).toBeDisabled();
  await expect(singleSetRest).toHaveAttribute("aria-expanded", "false");
  await expect(restSeconds).toBeHidden();
  await count.fill("3");
  await count.blur();
  await expect(singleSetRest).toBeEnabled();
  await singleSetRest.click();
  await expect(restMinutes).toHaveValue("01");
  await expect(restSeconds).toHaveValue("30");
  const basicTimerSize = (await restSeconds.boundingBox())!;
  expect(basicTimerSize.width).toBeLessThanOrEqual(56);
  expect(basicTimerSize.height).toBeLessThanOrEqual(44);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await quick.locator(".fitness-rest-disclosure").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath("integrated-rest.png"),
    fullPage: true,
  });
  const advanced = draft.getByRole("button", {
    name: /^(Advanced editor|Reset to basic)$/,
  });
  const offsetInCard = () =>
    advanced.evaluate(
      (button) =>
        button.getBoundingClientRect().top -
        button.closest(".fitness-compact-exercise")!.getBoundingClientRect()
          .top,
    );
  const toggleOffset = await offsetInCard();
  await expect(
    draft
      .locator(".fitness-workout-exercise-heading")
      .getByRole("button", { name: "Advanced editor", exact: true }),
  ).toBeVisible();
  const collapseExercise = draft.getByRole("button", {
    name: "Collapse Squat exercise",
    exact: true,
  });
  const headerControls = await Promise.all(
    [
      advanced,
      collapseExercise,
      draft.getByRole("button", { name: "Remove Squat exercise", exact: true }),
    ].map((control) => control.boundingBox()),
  );
  expect(headerControls[0]!.x + headerControls[0]!.width).toBeLessThanOrEqual(
    headerControls[1]!.x,
  );
  expect(headerControls[1]!.x + headerControls[1]!.width).toBeLessThanOrEqual(
    headerControls[2]!.x,
  );
  expect(headerControls[0]!.y).toBeCloseTo(headerControls[1]!.y, 0);
  if (testInfo.project.name === "phone")
    await expect(
      advanced.locator(".fitness-advanced-editor-label"),
    ).toBeHidden();
  else
    await expect(
      advanced.locator(".fitness-advanced-editor-label"),
    ).toBeVisible();
  const exerciseCard = draft.locator(".fitness-compact-exercise").first();
  await advanced.click();
  await expect(advanced).toHaveAttribute("aria-expanded", "true");
  expect(
    await exerciseCard
      .locator(".fitness-exercise-body")
      .evaluate((element) => element.getAnimations({ subtree: true }).length),
  ).toBe(0);
  await advanced.click();
  await expect(advanced).toHaveAttribute("aria-expanded", "false");
  expect(
    await exerciseCard
      .locator(".fitness-exercise-body")
      .evaluate((element) => element.getAnimations({ subtree: true }).length),
  ).toBe(0);
  await collapseExercise.click();
  await expect(exerciseCard.locator(".fitness-exercise-body")).toBeHidden();
  await expect(
    exerciseCard.locator(".fitness-exercise-target-summary"),
  ).toBeVisible();
  await expect(
    exerciseCard.locator(".fitness-exercise-target-summary"),
  ).toHaveText("3 × 8 · 40 kg");
  await expect(
    exerciseCard.locator(".fitness-collapsed-exercise-summary"),
  ).toHaveCount(0);
  const collapsedBox = (await exerciseCard.boundingBox())!;
  const headerBox = (await exerciseCard
    .locator(".fitness-workout-exercise-heading")
    .boundingBox())!;
  expect(collapsedBox.height).toBeCloseTo(headerBox.height + 2, 0);
  await expect(advanced).toBeVisible();
  await draft
    .getByRole("button", { name: "Advanced editor", exact: true })
    .click();
  await expect(
    draft.getByRole("button", { name: "Reset to basic", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(
    draft.getByRole("button", { name: "Collapse Squat exercise", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  await draft.locator(".fitness-exercise-body").evaluate(async (element) => {
    await Promise.all(
      element
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished),
    );
  });
  expect(await offsetInCard()).toBeCloseTo(toggleOffset, 0);
  const intentArea = draft.locator(".fitness-exercise-intent");
  expect(
    await intentArea.evaluate(
      (element) => element === element.parentElement!.lastElementChild,
    ),
  ).toBe(true);
  const firstRest = draft.locator(".fitness-rest-between-sets").first();
  await firstRest
    .getByRole("button", { name: /Edit rest after set 1:/ })
    .click();
  const advancedMinutes = firstRest.getByRole("textbox", {
    name: "Rest minutes",
    exact: true,
  });
  const advancedSeconds = firstRest.getByRole("textbox", {
    name: "Rest seconds",
    exact: true,
  });
  await expect(advancedMinutes).toBeFocused();
  await expect(advancedMinutes).toHaveValue("01");
  await expect(advancedSeconds).toHaveValue("30");
  await expect(firstRest.getByText("min", { exact: true })).toBeVisible();
  await expect(firstRest.getByText("sec", { exact: true })).toBeVisible();
  const inlineTimerSize = (await advancedSeconds.boundingBox())!;
  expect(inlineTimerSize.width).toBeLessThanOrEqual(
    testInfo.project.name === "phone" ? 44 : 32,
  );
  expect(inlineTimerSize.height).toBeLessThanOrEqual(
    testInfo.project.name === "phone" ? 44 : 28,
  );
  expect(
    await advancedSeconds.evaluate((input) =>
      parseFloat(getComputedStyle(input).fontSize),
    ),
  ).toBeLessThan(20);
  await advancedMinutes.fill("2");
  await advancedSeconds.fill("");
  await advancedMinutes.press("Enter");
  await firstRest
    .getByRole("button", {
      name: "Edit rest after set 1: Rest 2m",
      exact: true,
    })
    .click();
  await expect(advancedSeconds).toHaveValue("");
  await advancedMinutes.fill("");
  await advancedMinutes.press("Enter");
  await expect(
    firstRest.getByRole("button", {
      name: "Edit rest after set 1: Rest as needed",
      exact: true,
    }),
  ).toBeVisible();
  await firstRest.getByRole("button").click();
  await advancedMinutes.fill("2");
  await advancedSeconds.click();
  await advancedSeconds.pressSequentially("15");
  await expect(advancedSeconds).toHaveValue("15");
  await expect(advancedMinutes).toBeVisible();
  await expect(advancedMinutes).toHaveValue("02");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await firstRest.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: testInfo.outputPath("advanced-rest-timer.png"),
    fullPage: true,
  });
  await advancedSeconds.press("Enter");
  await expect(
    firstRest.getByRole("button", {
      name: "Edit rest after set 1: Rest 2m 15s",
      exact: true,
    }),
  ).toBeFocused();
  await expect(
    draft.getByRole("button", {
      name: "Edit rest after set 2: Rest 1m 30s",
      exact: true,
    }),
  ).toBeVisible();
  await firstRest
    .getByRole("button", { name: /Edit rest after set 1:/ })
    .click();
  await advancedMinutes.fill("");
  await advancedSeconds.fill("");
  await advancedMinutes.fill("0");
  await advancedMinutes.press("Enter");
  await expect(firstRest.getByRole("button")).toHaveAccessibleName(
    "Edit rest after set 1: No rest",
  );
  await firstRest.getByRole("button").click();
  await expect(advancedMinutes).toHaveValue("0");
  await expect(advancedSeconds).toHaveValue("");
  await advancedMinutes.fill("");
  await advancedMinutes.blur();
  await expect(firstRest.getByRole("button")).toHaveAccessibleName(
    "Edit rest after set 1: Rest as needed",
  );
  await firstRest.getByRole("button").click();
  await advancedSeconds.fill("0");
  await advancedSeconds.blur();
  await firstRest.getByRole("button").click();
  await expect(advancedMinutes).toHaveValue("");
  await expect(advancedSeconds).toHaveValue("0");
  await advancedSeconds.fill("90");
  await advancedSeconds.press("Enter");
  await expect(firstRest.getByRole("button")).toHaveAccessibleName(
    "Edit rest after set 1: Rest 1m 30s",
  );
  await firstRest.getByRole("button").click();
  await expect(advancedMinutes).toHaveValue("01");
  await expect(advancedSeconds).toHaveValue("30");
  await advancedMinutes.fill("0");
  await advancedSeconds.fill("0");
  await advancedSeconds.press("Enter");
  await expect(
    firstRest.getByRole("button", {
      name: "Edit rest after set 1: No rest",
      exact: true,
    }),
  ).toBeFocused();
  await firstRest.getByRole("button").click();
  await advancedMinutes.fill("");
  await advancedSeconds.fill("");
  await advancedSeconds.press("Enter");
  await expect(
    firstRest.getByRole("button", {
      name: "Edit rest after set 1: Rest as needed",
      exact: true,
    }),
  ).toBeFocused();
  await firstRest.getByRole("button").click();
  await advancedMinutes.fill("1");
  await advancedSeconds.fill("30");
  await advancedSeconds.press("Enter");
  await expect(
    firstRest.getByRole("button", {
      name: "Edit rest after set 1: Rest 1m 30s",
      exact: true,
    }),
  ).toBeVisible();
  const measurements = draft.getByRole("group", {
    name: "Configure measurements for Squat",
    exact: true,
  });
  await expect(measurements).toBeHidden();
  await expect(draft.locator(".fitness-measurements-summary")).toHaveText(
    "Reps · Load",
  );
  const measurementToggle = draft.getByRole("button", {
    name: "Configure measurements for Squat",
    exact: true,
  });
  await expect(measurementToggle).toHaveAccessibleDescription("Reps · Load");
  const measurementOutline = draft.locator(
    ".fitness-workout-measurements-editor",
  );
  expect((await measurementToggle.boundingBox())!.width).toBeCloseTo(
    (await measurementOutline.boundingBox())!.width - 2,
    0,
  );
  await measurementToggle.click();
  await expect(measurements).toBeVisible();
  await expect(measurements.locator("legend")).toHaveText(
    "Configure measurements",
  );
  const addSetButton = draft.getByRole("button", {
    name: "Add set",
    exact: true,
  });
  await expect(
    draft.locator(".fitness-workout-set-list + [data-add-set]"),
  ).toBeVisible();
  await expect(
    draft.locator(".fitness-workout-exercise-footer [data-add-set]"),
  ).toHaveCount(0);
  const addSetArea = (await addSetButton.boundingBox())!;
  const notesArea = (await draft
    .getByRole("button", { name: "Toggle exercise notes", exact: true })
    .boundingBox())!;
  expect(addSetArea.y + addSetArea.height).toBeLessThanOrEqual(notesArea.y);
  const repsStyle = () =>
    draft
      .getByLabel("Target reps", { exact: true })
      .first()
      .evaluate((input) => {
        const label = input.parentElement!.querySelector("label")!;
        return {
          labelWeight: getComputedStyle(label).fontWeight,
          labelSize: getComputedStyle(label).fontSize,
          valueWeight: getComputedStyle(input).fontWeight,
          valueSize: getComputedStyle(input).fontSize,
        };
      });
  const initialRepsStyle = await repsStyle();
  await measurements
    .getByRole("checkbox", { name: "Duration", exact: true })
    .check();
  await draft
    .getByLabel("Target duration (seconds)", { exact: true })
    .first()
    .fill("60");
  await measurementToggle.click();
  await expect(measurements).toBeHidden();
  await expect(measurementToggle).toHaveAccessibleDescription(
    "Reps · Load · Duration",
  );
  await measurementToggle.click();
  await expect(
    draft.getByLabel("Target duration (seconds)", { exact: true }).first(),
  ).toHaveValue("60");
  await expect(
    draft.getByRole("button", { name: /More details for set/ }),
  ).toHaveCount(0);
  await expect(
    draft.getByLabel("Target distance (km)", { exact: true }),
  ).toHaveCount(0);
  await expect(draft.getByLabel("Target laps", { exact: true })).toHaveCount(0);
  await measurements
    .getByRole("checkbox", { name: "Duration", exact: true })
    .uncheck();
  await measurements
    .getByRole("checkbox", { name: "Duration", exact: true })
    .check();
  await expect(
    draft.getByLabel("Target duration (seconds)", { exact: true }).first(),
  ).toHaveValue("60");
  await measurements
    .getByRole("checkbox", { name: "Distance", exact: true })
    .check();
  await measurements
    .getByRole("checkbox", { name: "Laps", exact: true })
    .check();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(await repsStyle()).toEqual(initialRepsStyle);
  const toolbar = draft.locator(".fitness-set-editor-row").first();
  const number = await toolbar
    .getByRole("button", { name: /Reorder set 1/ })
    .boundingBox();
  const remove = await toolbar
    .getByRole("button", { name: "Remove set 1", exact: true })
    .boundingBox();
  expect(number!.y).toBeCloseTo(remove!.y, 0);
  await draft
    .locator(".fitness-set-editor-row")
    .first()
    .scrollIntoViewIfNeeded();
  const bounds = await draft
    .locator(".fitness-set-editor-row")
    .first()
    .locator(".field")
    .evaluateAll((fields) =>
      fields.map((field) => {
        const rect = field.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
        };
      }),
    );
  for (let i = 0; i < bounds.length; i++)
    for (let j = i + 1; j < bounds.length; j++) {
      const a = bounds[i]!,
        b = bounds[j]!;
      expect(
        a.right <= b.left ||
          b.right <= a.left ||
          a.bottom <= b.top ||
          b.bottom <= a.top,
      ).toBe(true);
    }
  for (const field of bounds) expect(field.top).toBeCloseTo(bounds[0]!.top, 0);
  const setScroller = draft.locator(".fitness-workout-set-list");
  const numberPosition = (await toolbar
    .getByRole("button", { name: /Reorder set 1/ })
    .boundingBox())!;
  const actionPosition = (await toolbar
    .getByRole("button", { name: "Remove set 1", exact: true })
    .boundingBox())!;
  if (testInfo.project.name === "phone") {
    expect(
      await setScroller.evaluate(
        (element) => element.scrollWidth > element.clientWidth,
      ),
    ).toBe(true);
    await setScroller.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    expect(
      (await toolbar
        .getByRole("button", { name: /Reorder set 1/ })
        .boundingBox())!.x,
    ).toBeCloseTo(numberPosition.x, 0);
    expect(
      (await toolbar
        .getByRole("button", { name: "Remove set 1", exact: true })
        .boundingBox())!.x,
    ).toBeCloseTo(actionPosition.x, 0);
  }
  await draft.getByLabel("Target reps", { exact: true }).first().focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press("Tab");
  const lapsInput = draft.getByLabel("Target laps", { exact: true }).first();
  await expect(lapsInput).toBeFocused();
  await lapsInput.fill("7");
  const lapsBox = (await lapsInput.boundingBox())!;
  const plusBox = (await toolbar
    .getByRole("button", { name: "Measurements for set 1", exact: true })
    .boundingBox())!;
  expect(lapsBox.x + lapsBox.width).toBeLessThanOrEqual(plusBox.x);
  await setScroller.evaluate((element) => {
    element.scrollLeft = 0;
  });
  await page.screenshot({
    path: testInfo.outputPath("all-measurements.png"),
    fullPage: true,
  });
  await measurements
    .getByRole("checkbox", { name: "Distance", exact: true })
    .uncheck();
  await measurements
    .getByRole("checkbox", { name: "Laps", exact: true })
    .uncheck();
  await expect(draft.getByLabel("Target reps", { exact: true })).toHaveCount(3);
  await expect(
    draft.getByLabel("Target load (kg)", { exact: true }).nth(2),
  ).toHaveValue("40");
  await draft
    .getByLabel("Target load (kg)", { exact: true })
    .first()
    .fill("20");
  await expect(draft.locator(".fitness-exercise-target-summary")).toHaveText(
    "3 sets · 8 reps · 1m · 20–40 kg · Some targets unset",
  );
  for (let i = 0; i < 3; i++)
    await draft.getByRole("button", { name: "Add set", exact: true }).click();
  const scrollArea = draft.locator(".fitness-builder-scroll");
  const saveFooter = draft.locator(".fitness-builder-footer");
  const tabs = page.getByRole("navigation", { name: "Fitness views" });
  const tabsBefore = await tabs.boundingBox();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= innerHeight,
    ),
  ).toBe(true);
  const beforeScroll = await saveFooter.boundingBox();
  if (testInfo.project.name === "desktop") {
    await draft
      .getByRole("button", { name: "Reorder set 1", exact: true })
      .scrollIntoViewIfNeeded();
    const handle = (await draft
      .getByRole("button", { name: "Reorder set 1", exact: true })
      .boundingBox())!;
    const scrollBeforeDrag = await scrollArea.evaluate(
      (element) => element.scrollTop,
    );
    await page.mouse.move(
      handle.x + handle.width / 2,
      handle.y + handle.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2, beforeScroll!.y - 8, {
      steps: 8,
    });
    await expect
      .poll(() => scrollArea.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(scrollBeforeDrag);
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await scrollArea.evaluate((element) => {
      element.scrollTop = 0;
    });
  }
  await scrollArea.hover();
  await page.mouse.wheel(0, 1200);
  await expect
    .poll(() => scrollArea.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);
  expect((await tabs.boundingBox())!.y).toBe(tabsBefore!.y);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  if (testInfo.project.name === "desktop") {
    await library
      .getByRole("searchbox", { name: "Find an exercise", exact: true })
      .fill("");
    await expect(
      library.getByRole("button", { name: "Add Push-up", exact: true }),
    ).toBeAttached();
    const workoutScroll = await scrollArea.evaluate(
      (element) => element.scrollTop,
    );
    await library.hover();
    await page.mouse.wheel(0, 1200);
    await expect
      .poll(() => library.evaluate((element) => element.scrollTop))
      .toBeGreaterThan(0);
    expect(await scrollArea.evaluate((element) => element.scrollTop)).toBe(
      workoutScroll,
    );
    expect((await tabs.boundingBox())!.y).toBe(tabsBefore!.y);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  }
  await scrollArea.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  expect(
    await scrollArea.evaluate((element) => element.scrollTop),
  ).toBeGreaterThan(0);
  const afterScroll = await saveFooter.boundingBox();
  expect(afterScroll!.y).toBeCloseTo(beforeScroll!.y, 0);
  expect(
    await draft
      .locator(".fitness-builder-exercises")
      .evaluate((element) => getComputedStyle(element).overflowY),
  ).toBe("visible");
  for (const index of [6, 5, 4])
    await draft
      .getByRole("button", { name: `Remove set ${index}`, exact: true })
      .click();
  if (testInfo.project.name === "phone") {
    const footer = await draft.locator(".fitness-builder-footer").boundingBox();
    const navigation = await page
      .getByRole("navigation", { name: "Main navigation", exact: true })
      .boundingBox();
    expect(footer!.y + footer!.height).toBeLessThanOrEqual(navigation!.y);
  }
  await page.screenshot({
    path: testInfo.outputPath("workout-creation-preview.png"),
    fullPage: true,
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const secondRest = draft.locator(".fitness-rest-between-sets").nth(1);
  await secondRest.getByRole("button").click();
  await secondRest
    .getByRole("textbox", { name: "Rest minutes", exact: true })
    .fill("");
  await secondRest
    .getByRole("textbox", { name: "Rest seconds", exact: true })
    .fill("");
  await secondRest
    .getByRole("textbox", { name: "Rest seconds", exact: true })
    .press("Enter");
  await expect(
    secondRest.getByRole("button", {
      name: "Edit rest after set 2: Rest as needed",
      exact: true,
    }),
  ).toBeVisible();
  await draft
    .getByRole("button", { name: "Save workout", exact: true })
    .click();
  await expect(page).toHaveURL(/\/fitness$/);
  if (testInfo.project.name === "desktop")
    await expect(
      page.getByRole("complementary", { name: "Fitness day panel" }),
    ).toBeVisible();
  else
    await expect(
      page.getByRole("button", { name: "Day", exact: true }),
    ).toBeVisible();
  const plans = await (await page.request.get("/api/v1/strength-plans")).json();
  expect(plans.items[0].exercises[0].loggingType).toBe("reps_duration_load");
  expect(plans.items[0].exercises[0].sets[0].targetDurationSeconds).toBe(60);
  expect(plans.items[0].exercises[0].sets[0].targetLaps).toBe(7);
  expect(plans.items[0].exercises[0].sets).toMatchObject([
    { targetReps: 8, targetWeightKg: 20, restSeconds: 90 },
    { targetReps: 8, targetWeightKg: 40, restSeconds: null },
    { targetReps: 8, targetWeightKg: 40 },
  ]);
  await page
    .locator(".fitness-workout-card")
    .filter({ hasText: "Preview workout" })
    .getByRole("link", { name: "Edit", exact: true })
    .click();
  await expect(
    draft.getByRole("button", { name: "Reset to basic", exact: true }),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(
    draft.getByLabel("Target load (kg)", { exact: true }).first(),
  ).toHaveValue("20");
  await draft.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(/\/fitness$/);
});
