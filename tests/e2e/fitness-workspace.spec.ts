import { randomUUID } from "node:crypto";
import { expect, test, type Page, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("one Fitness workspace supports visual discovery, inline details and building workouts from the library", async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  expect(
    (
      await page.request.post("/api/auth/sign-up/email", {
        headers: { Origin: "http://localhost:3100" },
        data: {
          name: "Library member",
          email: `library-${randomUUID()}@example.com`,
          password: "Synthetic-library-password-123",
        },
      })
    ).status(),
  ).toBe(200);
  await page.goto("/fitness");
  await expect(
    page.getByRole("heading", { name: "Fitness", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "My workouts", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Fitness views" })
    .getByRole("link", { name: "Library", exact: true })
    .click();
  await expect(page.locator(".fitness-library-card")).toHaveCount(16);
  const cardNames = () =>
    page.locator(".fitness-library-card-name").allTextContents();
  const initialNames = await cardNames();
  expect(initialNames).toEqual(
    [...initialNames].sort((a, b) =>
      a.localeCompare(b, "en", { sensitivity: "base" }),
    ),
  );
  const sortButton = page.getByRole("button", {
    name: "Sort exercises",
    exact: true,
  });
  await openFilters(page);
  await sortButton.click();
  await expect(
    page.getByRole("combobox", { name: "Search sort exercises" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("listbox", { name: "Sort exercises" }),
  ).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect.poll(cardNames).toEqual([...initialNames].reverse());
  await sortButton.click();
  await page
    .getByRole("option", { name: "Recently added", exact: true })
    .click();
  await expect.poll(cardNames).toEqual(initialNames);
  await sortButton.click();
  await page.getByRole("option", { name: "Name A–Z", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Hidden", exact: true }),
  ).toHaveText("Hidden");
  await page.getByRole("button", { name: /^Filters/ }).click();
  await expect(sortButton).not.toBeVisible();
  const muscleRow = page
    .getByRole("button", { name: "Bench press", exact: true })
    .locator(".fitness-library-card-muscles");
  const tagWidths = await muscleRow
    .locator(".fitness-card-muscle-measure")
    .evaluate((node) =>
      Array.from(node.children, (tag) => tag.getBoundingClientRect().width),
    );
  const gap = await muscleRow.evaluate((node) =>
    parseFloat(getComputedStyle(node).columnGap),
  );
  const cases = [
    { width: tagWidths[0]! + tagWidths[4]! + gap + 1, tags: ["Chest", "+2"] },
    {
      width: tagWidths[0]! + tagWidths[1]! + tagWidths[3]! + 2 * gap + 1,
      tags: ["Chest", "Shoulders", "+1"],
    },
    {
      width: tagWidths.slice(0, 3).reduce((a, b) => a + b, 0) + 2 * gap + 1,
      tags: ["Chest", "Shoulders", "Arms"],
    },
  ];
  for (const { width, tags } of cases) {
    await muscleRow.evaluate((node, width) => {
      (node as HTMLElement).style.width = `${width}px`;
    }, width);
    await expect
      .poll(() =>
        muscleRow
          .locator(":scope > .fitness-card-muscle-tag")
          .allTextContents(),
      )
      .toEqual(tags);
    expect(
      await muscleRow.evaluate((node) =>
        Array.from(
          node.querySelectorAll(":scope > .fitness-card-muscle-tag"),
        ).every(
          (tag) =>
            tag.getBoundingClientRect().right <=
            node.getBoundingClientRect().right + 1,
        ),
      ),
    ).toBe(true);
  }
  await muscleRow.evaluate((node) =>
    (node as HTMLElement).style.removeProperty("width"),
  );
  await expect(
    page.getByRole("button", { name: "Hidden", exact: true }),
  ).not.toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");

  if (testInfo.project.name === "desktop") {
    for (const height of [820, 680]) {
      await page.setViewportSize({ width: 1280, height });
      const rail = await page
        .getByRole("complementary", { name: "Fitness day panel" })
        .boundingBox();
      expect(rail!.y).toBeCloseTo(0, 0);
      expect(rail!.height).toBeCloseTo(height, 0);
      await expect(page.locator(".fitness-primary-pane")).toBeHidden();
    }
    await page.setViewportSize({ width: 1280, height: 820 });
  }

  await expect(page.locator(".fitness-tabs")).toHaveCount(0);
  const gridTopBeforeFilters = (await page
    .locator(".fitness-exercise-grid")
    .boundingBox())!.y;
  await openFilters(page);
  const filterPanel = page.getByRole("region", { name: "Exercise filters" });
  await expect
    .poll(
      async () =>
        (await page.locator(".fitness-exercise-grid").boundingBox())!.y,
    )
    .toBeGreaterThan(gridTopBeforeFilters);
  await expect(filterPanel).toHaveCSS("position", "static");
  await expect(filterPanel).toHaveCSS("overflow-y", "visible");
  const equipmentField = (await filterPanel
    .getByRole("group", { name: "Equipment", exact: true })
    .boundingBox())!;
  const muscleField = (await filterPanel
    .getByRole("group", { name: "Muscle group", exact: true })
    .boundingBox())!;
  expect(Math.abs(equipmentField.width - muscleField.width)).toBeLessThan(1);
  if (testInfo.project.name === "desktop") {
    const sortField = (await filterPanel
      .locator(".fitness-filter-sort")
      .boundingBox())!;
    expect(sortField.width).toBeGreaterThan(equipmentField.width);
    expect(sortField.y).toBeGreaterThan(muscleField.y + muscleField.height);
  }

  await expect(
    filterPanel.getByRole("group", { name: "Equipment", exact: true }),
  ).toBeVisible();
  await expect(
    filterPanel.getByRole("group", { name: "Muscle group", exact: true }),
  ).toBeAttached();
  const filterSearch = filterPanel.getByRole("searchbox", {
    name: "Search equipment",
    exact: true,
  });
  await expect(
    filterPanel.getByRole("button", { name: "Dumbbells", exact: true }),
  ).toHaveCount(0);
  const compactPanelHeight = (await filterPanel.boundingBox())!.height;
  await filterSearch.fill("not an option");
  await expect(
    filterPanel.getByText("No matching options.", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => (await filterPanel.boundingBox())!.height)
    .toBeCloseTo(compactPanelHeight, 1);
  await filterSearch.fill("Dumb");
  await expect(
    filterPanel.getByRole("button", { name: "Dumbbells", exact: true }),
  ).toBeVisible();
  await clickAboveControl(page, filterSearch);
  await expect(filterSearch).not.toBeFocused();
  await expect(
    filterPanel.getByRole("button", { name: "Dumbbells", exact: true }),
  ).toHaveCount(0);
  await filterSearch.fill("Dumb");
  await filterSearch.press("ArrowDown");
  await expect(
    filterPanel.getByRole("button", { name: "Dumbbells", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(filterSearch).toBeFocused();
  await expect(
    filterPanel.getByRole("button", { name: "Dumbbells", exact: true }),
  ).toHaveCount(0);
  await expect(filterPanel).toBeVisible();
  await filterSearch.click();
  await expect(
    filterPanel.getByRole("button", { name: "Dumbbells", exact: true }),
  ).toBeVisible();
  await filterSearch.press("Tab");
  await expect(
    filterPanel.getByRole("button", { name: "Dumbbells", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Space");
  await expect(
    filterPanel.getByRole("button", { name: "Dumbbells", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Space");
  const dumbbellsOption = filterPanel.getByRole("button", {
    name: "Dumbbells",
    exact: true,
  });
  const optionWidth = (await dumbbellsOption.boundingBox())!.width;
  if (testInfo.project.name === "phone")
    await dumbbellsOption.tap({ position: { x: optionWidth - 8, y: 22 } });
  else await dumbbellsOption.click({ position: { x: optionWidth - 8, y: 22 } });
  await expect(dumbbellsOption).toHaveAttribute("aria-pressed", "true");
  await dumbbellsOption.click();
  await expect(dumbbellsOption).toHaveAttribute("aria-pressed", "false");
  await filterPanel
    .getByRole("searchbox", { name: "Search muscle group", exact: true })
    .focus();
  await expect(
    filterPanel.getByRole("button", { name: "Dumbbells", exact: true }),
  ).toHaveCount(0);
  await expect(
    filterPanel.getByRole("button", { name: "Chest", exact: true }),
  ).toBeVisible();
  const inactiveFilter = page.getByRole("button", {
    name: "Hidden",
    exact: true,
  });
  if (testInfo.project.name === "phone") await inactiveFilter.tap();
  else await inactiveFilter.click();
  await expect(inactiveFilter).toHaveAttribute("aria-pressed", "true");
  await inactiveFilter.click();
  await expect(inactiveFilter).toHaveAttribute("aria-pressed", "false");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("exercise-filters.png") });
  await filterPanel
    .getByRole("searchbox", { name: "Search muscle group", exact: true })
    .press("Escape");
  await expect(filterPanel).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(filterPanel).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Filters/ })).toBeFocused();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".fitness-filter-reveal")).toHaveCSS(
    "transition-duration",
    "0s",
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const bench = page.getByRole("button", { name: "Bench press", exact: true });
  const cardStar = page.getByRole("button", {
    name: "Favourite Bench press",
    exact: true,
  });
  await page.mouse.move(0, 0);
  await expect(cardStar).toHaveCSS(
    "opacity",
    testInfo.project.use.hasTouch ? "1" : "0",
  );
  await bench.focus();
  await expect(cardStar).toHaveCSS("opacity", "1");

  await page.keyboard.press("Enter");
  const detail = page.getByRole("region", {
    name: "Bench press details",
    exact: true,
  });
  await expect(detail).toBeVisible();
  await expect(detail.getByText("Exercise visual coming soon")).toBeVisible();
  await expect(
    detail.getByRole("button", { name: "Edit exercise", exact: true }),
  ).toHaveCount(0);
  await expect(
    detail.getByRole("button", { name: "Hide", exact: true }),
  ).toBeVisible();
  await expect(
    detail.getByRole("button", { name: "Customize exercise", exact: true }),
  ).toHaveCount(0);

  await expect(
    detail.getByText("Built-in exercise", { exact: true }),
  ).toHaveCount(0);
  await expect(detail.getByText("Tracking", { exact: true })).toHaveCount(0);
  await expect(detail.getByRole("list")).toContainText("Barbell");
  await detail.screenshot({
    path: testInfo.outputPath("exercise-details.png"),
  });

  expect(
    (await (await page.request.get("/api/v1/exercises")).json()).items,
  ).toHaveLength(0);
  await detail
    .getByRole("button", { name: "Favourite Bench press", exact: true })
    .click();
  await expect(
    detail.getByRole("button", {
      name: "Unfavourite Bench press",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  await expect(detail).toHaveCount(0);
  await expect(bench).toBeFocused();
  await page.getByRole("button", { name: "Favourites", exact: true }).click();
  await expect(page.locator(".fitness-library-card")).toHaveCount(1);
  await page.reload();
  await bench.click();
  await expect(
    detail.getByRole("button", {
      name: "Unfavourite Bench press",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await detail
    .getByRole("button", { name: "Unfavourite Bench press", exact: true })
    .click();
  await expect(
    detail.getByRole("button", { name: "Favourite Bench press", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("Escape");

  await bench.hover();
  const hoverBorder = await bench.evaluate(
    (node) => getComputedStyle(node).borderColor,
  );
  await cardStar.hover();
  await expect(bench).toHaveCSS("border-color", hoverBorder);
  await expect(cardStar).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await cardStar.click();
  const filledStar = page.getByRole("button", {
    name: "Unfavourite Bench press",
    exact: true,
  });
  await expect(filledStar).toHaveAttribute("aria-pressed", "true");
  await expect(detail).toHaveCount(0);
  await page.getByLabel("Find an exercise", { exact: true }).focus();
  await page.mouse.move(0, 0);
  await expect(filledStar).toHaveCSS("opacity", "1");
  await filledStar.click();
  await expect(cardStar).toHaveAttribute("aria-pressed", "false");
  await expect(detail).toHaveCount(0);
  if (testInfo.project.name === "desktop") {
    await page.mouse.move(0, 0);
    await expect(cardStar).toHaveCSS("opacity", "0");
    const idleBorder = await page
      .getByRole("button", { name: "Goblet squat", exact: true })
      .evaluate((node) => getComputedStyle(node).borderColor);
    await expect(bench).toHaveCSS("border-color", idleBorder);
    await page.keyboard.press("Shift+Tab");
    await expect(bench).toBeFocused();
    await expect(cardStar).toHaveCSS("opacity", "1");
    await page.keyboard.press("Tab");
    await expect(cardStar).toBeFocused();
    await expect(cardStar).toHaveCSS("opacity", "1");
  }

  await selectFilter(page, "Muscle group", "Chest");
  await selectFilter(page, "Muscle group", "Back");
  const selectedMuscles = page.getByRole("list", {
    name: "Selected muscle group",
    exact: true,
  });
  await expect(
    selectedMuscles.getByText("Chest", { exact: true }),
  ).toBeVisible();
  await expect(
    selectedMuscles.getByText("Back", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Bench press", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Lat pulldown", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Squat", exact: true }),
  ).toHaveCount(0);
  const clearBefore = (await page
    .getByRole("button", { name: "Clear all", exact: true })
    .boundingBox())!;
  const activeBefore = (await page
    .locator(".fitness-active-filters")
    .boundingBox())!;
  await selectFilter(page, "Equipment", "Barbell");
  await selectFilter(page, "Equipment", "Cable");
  await expect(
    page.getByRole("button", { name: "Bench press", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Lat pulldown", exact: true }),
  ).toBeVisible();
  for (const equipment of ["Kettlebell", "Resistance band", "Pull-up bar"]) {
    await selectFilter(page, "Equipment", equipment);
  }
  const selectedEquipment = page.getByRole("list", {
    name: "Selected equipment",
    exact: true,
  });
  await expect(selectedEquipment.getByRole("listitem")).toHaveCount(5);
  const clearAfter = (await page
    .getByRole("button", { name: "Clear all", exact: true })
    .boundingBox())!;
  const activeAfter = (await page
    .locator(".fitness-active-filters")
    .boundingBox())!;
  expect(clearAfter.x - activeAfter.x).toBeCloseTo(
    clearBefore.x - activeBefore.x,
    0,
  );
  expect(clearAfter.y - activeAfter.y).toBeCloseTo(
    clearBefore.y - activeBefore.y,
    0,
  );
  await expect(
    page.getByRole("button", { name: "Clear all", exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Clear filters", exact: true }),
  ).toHaveCount(0);

  const tagRow = page.getByRole("region", {
    name: "Selected filters",
    exact: true,
  });
  await tagRow.evaluate((node) => {
    (node as HTMLElement).style.maxWidth = "380px";
  });
  await expect(tagRow).toHaveCSS("overflow-x", "auto");
  await expect(tagRow).toHaveCSS("scrollbar-width", "none");
  expect(
    await tagRow.evaluate(
      (node) => (node as HTMLElement).offsetHeight - node.clientHeight,
    ),
  ).toBe(0);
  await tagRow.evaluate((node) => {
    node.scrollLeft = 0;
  });
  await expect(tagRow).toHaveAttribute("data-overflow-left", "false");
  await expect(tagRow).toHaveAttribute("data-overflow-right", "true");
  await tagRow.focus();
  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() => tagRow.evaluate((node) => node.scrollLeft))
    .toBeGreaterThan(0);
  await tagRow.evaluate((node) => {
    node.scrollLeft = node.scrollWidth;
  });
  await expect(tagRow).toHaveAttribute("data-overflow-left", "true");
  await expect(tagRow).toHaveAttribute("data-overflow-right", "false");

  const firstTag = (await tagRow.getByRole("listitem").first().boundingBox())!;
  expect(
    Math.abs(
      clearAfter.y + clearAfter.height / 2 - firstTag.y - firstTag.height / 2,
    ),
  ).toBeLessThan(1);
  const chipRows = await tagRow
    .getByRole("listitem")
    .evaluateAll(
      (items) =>
        new Set(items.map((item) => item.getBoundingClientRect().top)).size,
    );
  expect(chipRows).toBe(1);
  for (const equipment of [
    "Barbell",
    "Cable",
    "Kettlebell",
    "Resistance band",
    "Pull-up bar",
  ]) {
    const chip = selectedEquipment.getByText(equipment, { exact: true });
    await chip.scrollIntoViewIfNeeded();
    await expect(chip).toBeInViewport();
  }
  await page.getByRole("button", { name: /^Filters/ }).click();
  await expect(
    page.getByRole("region", { name: "Exercise filters" }),
  ).toHaveCount(0);
  await expect(selectedEquipment).toBeVisible();
  await expect(selectedMuscles).toBeVisible();
  await page
    .locator(".fitness-library-controls")
    .screenshot({ path: testInfo.outputPath("selected-filters.png") });
  await openFilters(page);
  const expandedPanel = page.getByRole("region", { name: "Exercise filters" });
  await expandedPanel
    .getByRole("searchbox", { name: "Search equipment", exact: true })
    .focus();
  await expect
    .poll(async () => {
      const selectedBounds = (await selectedEquipment.boundingBox())!;
      const expandedBounds = (await expandedPanel.boundingBox())!;
      return selectedBounds.y - (expandedBounds.y + expandedBounds.height);
    })
    .toBeGreaterThanOrEqual(0);
  await page
    .locator(".fitness-library-controls")
    .screenshot({ path: testInfo.outputPath("reveal-filters.png") });
  await page.getByRole("button", { name: /^Filters/ }).focus();
  await expect(
    expandedPanel.getByRole("button", { name: "Barbell", exact: true }),
  ).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const removeChest = selectedMuscles.getByRole("button", {
    name: "Remove Chest",
    exact: true,
  });
  if (testInfo.project.name === "phone") await removeChest.tap();
  else await removeChest.click();
  await expect(page.getByRole("button", { name: /^Filters/ })).toBeFocused();
  await expect(selectedMuscles.getByText("Chest", { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("button", { name: "Bench press", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /^Filters/ }).click();
  await expect(
    page.getByRole("region", { name: "Exercise filters" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  await expect(selectedEquipment).toHaveCount(0);
  await expect(selectedMuscles).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Filters/ })).toBeFocused();
  await openFilters(page);
  await selectFilter(page, "Muscle group", "Legs");
  await openFilters(page);
  await selectFilter(page, "Equipment", "Machine");
  await expect(page.locator(".fitness-library-card")).toHaveCount(3);
  await page.getByLabel("Find an exercise", { exact: true }).fill("extension");
  await expect(page.locator(".fitness-library-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Leg extension", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Leg extension details" }),
  ).toContainText("Machine");
  const extension = page.getByRole("region", {
    name: "Leg extension details",
    exact: true,
  });
  await extension.getByRole("button", { name: "Hide", exact: true }).click();
  await expect(
    extension.getByRole("button", { name: "Show in library", exact: true }),
  ).toBeVisible();
  await extension
    .getByRole("button", { name: "Show in library", exact: true })
    .click();
  await expect(
    extension.getByRole("button", { name: "Hide", exact: true }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Back to exercises", exact: true })
    .click();
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  await page.getByRole("button", { name: "Push-up", exact: true }).click();
  const pushUp = page.getByRole("region", {
    name: "Push-up details",
    exact: true,
  });
  await pushUp.getByRole("button", { name: "Duplicate", exact: true }).click();
  const pushCopy = page.getByRole("region", {
    name: "Push-up (copy) details",
    exact: true,
  });
  const pushEditor = page.getByRole("region", {
    name: "Edit exercise",
    exact: true,
  });
  await expect(
    pushEditor.getByRole("heading", { name: "Edit exercise", exact: true }),
  ).toBeVisible();
  await expect(
    pushEditor.getByLabel("Exercise name", { exact: true }),
  ).toHaveValue("Push-up (copy)");
  await pushEditor.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(pushCopy.getByText("Custom", { exact: true })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await pushCopy
    .getByRole("button", { name: "Delete exercise", exact: true })
    .click();
  await expect(pushCopy).toHaveCount(0);
  await bench.click();
  await detail
    .getByRole("button", { name: "Add to workout", exact: true })
    .click();
  await detail
    .getByRole("button", { name: "Build new workout", exact: true })
    .click();
  await expect(page).toHaveURL(/\/fitness\/workout\/new\?exercise=/);
  await expect(
    page.getByRole("heading", { name: "Bench press", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Workout name", { exact: true }).fill("Push day");
  await page.getByLabel("Target reps", { exact: true }).fill("8");
  await page.getByRole("button", { name: "Save workout", exact: true }).click();
  await expect(page).toHaveURL(/\/fitness$/);
  await expect(
    page.getByRole("heading", { name: "Push day", exact: true }),
  ).toBeVisible();
  const plans = await (await page.request.get("/api/v1/strength-plans")).json();
  const workout = plans.items[0];
  await page.screenshot({
    path: testInfo.outputPath("fitness-workspace.png"),
    fullPage: true,
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page
    .getByRole("navigation", { name: "Fitness views" })
    .getByRole("link", { name: "Library", exact: true })
    .click();
  await page.getByRole("button", { name: "Squat", exact: true }).click();
  const squat = page.getByRole("region", {
    name: "Squat details",
    exact: true,
  });
  await squat
    .getByRole("button", { name: "Add to workout", exact: true })
    .click();
  await squat
    .getByRole("button", { name: "Choose a workout", exact: true })
    .click();
  const workoutSelector = squat.getByRole("button", {
    name: "Choose a workout",
    exact: true,
  });
  await clickAboveControl(page, workoutSelector);
  await expect(workoutSelector).toHaveAttribute("aria-expanded", "false");
  await expect(
    squat.getByRole("combobox", {
      name: "Search choose a workout",
      exact: true,
    }),
  ).toHaveCount(0);
  await workoutSelector.click();
  await squat
    .getByRole("combobox", { name: "Search choose a workout", exact: true })
    .fill("Push day");
  const workoutChoice = squat.getByRole("option", {
    name: "Push day",
    exact: true,
  });
  if (testInfo.project.name === "phone") await workoutChoice.tap();
  else await workoutChoice.click();
  await squat
    .getByRole("button", { name: "Add exercise", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/fitness/workout/${workout.id}`));
  const updated = await (
    await page.request.get(`/api/v1/strength-plans/${workout.id}`)
  ).json();
  expect(updated.exercises.map((e: { name: string }) => e.name)).toEqual([
    "Bench press",
    "Squat",
  ]);
  expect(updated.exercises[0].sets[0].targetReps).toBe(8);
  await page
    .getByRole("button", { name: "Back to Fitness", exact: true })
    .click();
  await expect(page).toHaveURL("/fitness");
  await expect(
    page.getByRole("heading", { name: "My workouts", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Fitness views" })
    .getByRole("link", { name: "Library", exact: true })
    .click();
  await bench.click();
  await detail.getByRole("button", { name: "Duplicate", exact: true }).click();
  const copyEditor = page.getByRole("region", {
    name: "Edit exercise",
    exact: true,
  });
  await copyEditor
    .getByLabel("Exercise name", { exact: true })
    .fill("Bench press (my setup)");
  await copyEditor
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  const personal = page.getByRole("region", {
    name: "Bench press (my setup) details",
    exact: true,
  });
  await expect(
    personal.getByRole("heading", {
      name: "Bench press (my setup)",
      exact: true,
    }),
  ).toBeVisible();
  await personal.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(personal).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Bench press (my setup)", exact: true }),
  ).toHaveCount(0);
  await openFilters(page);
  await page.getByRole("button", { name: "Hidden", exact: true }).click();
  await page
    .getByRole("button", { name: "Bench press (my setup)", exact: true })
    .click();
  await personal.getByRole("button", { name: "Restore", exact: true }).click();
  await expect(personal).toHaveCount(0);
  await openFilters(page);
  await page.getByRole("button", { name: "Hidden", exact: true }).click();
  await page
    .getByRole("button", { name: "Bench press (my setup)", exact: true })
    .click();
  page.once("dialog", (dialog) => dialog.accept());
  await personal
    .getByRole("button", { name: "Delete exercise", exact: true })
    .click();
  await expect(personal).toHaveCount(0);
  await expect(page.locator(".fitness-library-card")).toHaveCount(16);
  await page
    .getByRole("button", { name: "Create exercise", exact: true })
    .click();
  const createExercise = page.getByRole("region", {
    name: "Create exercise",
    exact: true,
  });
  const exerciseName = createExercise.getByLabel("Exercise name", {
    exact: true,
  });
  await expect(exerciseName).toBeFocused();
  const focusClearance = await exerciseName.evaluate((input) => {
    const label = (input as HTMLInputElement).labels![0]!;
    const text = Array.from(label.childNodes).find(
      (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
    )!;
    const range = document.createRange();
    range.selectNode(text);
    const style = getComputedStyle(input);
    const outlineExtent =
      parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset);
    return {
      outlineExtent,
      gap:
        input.getBoundingClientRect().top -
        range.getBoundingClientRect().bottom,
    };
  });
  expect(focusClearance.outlineExtent).toBeGreaterThan(0);
  expect(focusClearance.gap).toBeGreaterThan(focusClearance.outlineExtent);
  await exerciseName.fill("Supported custom row");
  for (const [field, option] of [
    ["Equipment", "Dumbbells"],
    ["Equipment", "Bench"],
    ["Muscles worked", "Back"],
    ["Muscles worked", "Arms"],
  ]) {
    await createExercise
      .getByRole("combobox", { name: field, exact: true })
      .fill(option);
    await createExercise
      .getByRole("option", { name: option, exact: true })
      .click();
  }
  for (const [field, chipLabel] of [
    ["Equipment", "Selected equipment"],
    ["Muscles worked", "Selected muscles worked"],
  ]) {
    const inputBottom = await createExercise
      .getByRole("combobox", { name: field, exact: true })
      .evaluate((node) => node.getBoundingClientRect().bottom);
    const chipsTop = await createExercise
      .getByRole("list", { name: chipLabel, exact: true })
      .evaluate((node) => node.getBoundingClientRect().top);
    expect(chipsTop).toBeGreaterThanOrEqual(inputBottom);
  }
  for (const [field, option] of [
    ["Equipment", "Bench"],
    ["Muscles worked", "Arms"],
  ]) {
    const search = createExercise.getByRole("combobox", {
      name: field,
      exact: true,
    });
    const remove = createExercise.getByRole("button", {
      name: `Remove ${option}`,
      exact: true,
    });
    if (testInfo.project.name === "phone") await remove.tap();
    else await remove.click();
    await expect(search).toHaveAttribute("aria-expanded", "false");
    await expect(search).not.toBeFocused();
    await expect(remove).toHaveCount(0);
    await search.fill(option);
    const choice = createExercise.getByRole("option", {
      name: option,
      exact: true,
    });
    if (testInfo.project.name === "phone") await choice.tap();
    else await choice.click();
    await expect(search).toHaveAttribute("aria-expanded", "false");
    await search.click();
    await clickAboveControl(page, search);
    await expect(search).toHaveAttribute("aria-expanded", "false");
    await expect(search).not.toBeFocused();
    if (testInfo.project.name === "phone") {
      await search.tap();
      await createExercise
        .getByRole("heading", { name: "Create exercise", exact: true })
        .tap();
      await expect(search).toHaveAttribute("aria-expanded", "false");
      await expect(search).not.toBeFocused();
    }
  }
  const equipmentDraft = createExercise.getByRole("combobox", {
    name: "Equipment",
    exact: true,
  });
  await createExercise
    .getByRole("button", { name: "Remove Bench", exact: true })
    .focus();
  await page.keyboard.press("Enter");
  await expect(
    createExercise.getByRole("button", {
      name: "Remove Dumbbells",
      exact: true,
    }),
  ).toBeFocused();
  await expect(equipmentDraft).toHaveAttribute("aria-expanded", "false");
  await createExercise
    .getByRole("button", { name: "Remove Dumbbells", exact: true })
    .press("Enter");
  await expect(equipmentDraft).toBeFocused();
  await expect(equipmentDraft).toHaveAttribute("aria-expanded", "false");
  await clickAboveControl(page, equipmentDraft);
  await expect(equipmentDraft).not.toBeFocused();
  for (const option of ["Dumbbells", "Bench"]) {
    await equipmentDraft.fill(option);
    await equipmentDraft.press("Enter");
  }
  await createExercise
    .getByRole("button", { name: "Favourite", exact: true })
    .click();
  await expect(
    createExercise.getByRole("button", { name: "Favourite", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await createExercise.screenshot({
    path: testInfo.outputPath("create-exercise.png"),
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await createExercise
    .getByRole("button", { name: "Create exercise", exact: true })
    .click();
  const customDetail = page.getByRole("region", {
    name: "Supported custom row details",
    exact: true,
  });
  await expect(customDetail.getByRole("list")).toContainText("Dumbbells");
  await expect(customDetail.getByRole("list")).toContainText("Bench");
  await expect(
    customDetail.getByRole("button", {
      name: "Unfavourite Supported custom row",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await customDetail
    .getByRole("button", { name: "Back to exercises", exact: true })
    .click();
  await openFilters(page);
  await selectFilter(page, "Equipment", "Bench");
  await openFilters(page);
  await selectFilter(page, "Muscle group", "Back");
  await page.getByRole("button", { name: "Favourites", exact: true }).click();
  await expect(page.locator(".fitness-library-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Supported custom row", exact: true })
    .click();
  await customDetail
    .getByRole("button", { name: "Edit exercise", exact: true })
    .click();
  const customEditor = page.getByRole("region", {
    name: "Edit exercise",
    exact: true,
  });
  await expect(
    customEditor.getByRole("button", { name: "Remove Bench", exact: true }),
  ).toBeVisible();
  await customEditor
    .getByRole("button", { name: "Remove Bench", exact: true })
    .click();
  const equipmentSearch = customEditor.getByRole("combobox", {
    name: "Equipment",
    exact: true,
  });
  await expect(equipmentSearch).toHaveAttribute("aria-expanded", "false");
  await expect(equipmentSearch).not.toBeFocused();
  await equipmentSearch.fill("Cable");
  await equipmentSearch.press("Enter");
  await expect(
    customEditor.getByRole("button", { name: "Remove Cable", exact: true }),
  ).toBeVisible();
  await equipmentSearch.press("ArrowDown");
  await equipmentSearch.press("Escape");
  await expect(equipmentSearch).toHaveAttribute("aria-expanded", "false");
  await customEditor
    .getByRole("button", { name: "Favourite", exact: true })
    .click();
  await expect(
    customEditor.getByRole("button", { name: "Favourite", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await customEditor
    .getByRole("button", { name: "Save changes", exact: true })
    .click();
  await expect(customEditor).toHaveCount(0);
  await expect(customDetail).toHaveCount(0);
  // The edited exercise leaves the active Bench/Favourites filter; verify its saved values directly.
  const owned = await (
    await page.request.get("/api/v1/exercises?search=Supported%20custom%20row")
  ).json();
  expect(owned.items[0]).toMatchObject({
    equipment: ["Dumbbells", "Cable"],
    muscles: ["Back", "Arms"],
    favourite: false,
  });
  await page.locator("#history > summary").click();
  const history = page.locator("#history");
  await history.getByRole("button", { name: "View all", exact: true }).click();
  await history
    .getByRole("button", { name: "Workout status", exact: true })
    .click();
  await history
    .getByRole("combobox", { name: "Search workout status", exact: true })
    .fill("Finished");
  await history
    .getByRole("combobox", { name: "Search workout status", exact: true })
    .press("Enter");
  await expect(
    history.getByRole("button", { name: "Workout status", exact: true }),
  ).toContainText("Finished");
  await expect(page.locator(".fitness-home select")).toHaveCount(0);
  if (testInfo.project.name === "phone")
    await page.setViewportSize({ width: 320, height: 740 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

async function openFilters(page: Page) {
  const trigger = page.getByRole("button", { name: /^Filters/ });
  if ((await trigger.getAttribute("aria-expanded")) !== "true")
    await trigger.click();
  await expect(
    page.getByRole("region", { name: "Exercise filters" }),
  ).toBeVisible();
}

async function selectFilter(page: Page, label: string, value: string) {
  await openFilters(page);
  const group = page.getByRole("group", { name: label, exact: true });
  const search = group.getByRole("searchbox", {
    name: `Search ${label.toLowerCase()}`,
    exact: true,
  });
  await search.fill(value);
  const option = group.getByRole("button", { name: value, exact: true });
  if ((await option.getAttribute("aria-pressed")) !== "true")
    await option.click();
  await search.fill("");
}

async function clickAboveControl(page: Page, control: Locator) {
  const box = (await control.boundingBox())!;
  // Use a precise pointer for this three-pixel gap; touch hit adjustment may
  // legitimately redirect a near-edge tap into the associated input label.
  await page.mouse.click(box.x + box.width - 3, box.y - 3);
}

test("library cards handle long custom names and equipment without overflowing", async ({
  page,
}, testInfo) => {
  expect(
    (
      await page.request.post("/api/auth/sign-up/email", {
        headers: { Origin: "http://localhost:3100" },
        data: {
          name: "Library layout member",
          email: `layout-${randomUUID()}@example.com`,
          password: "Synthetic-library-password-123",
        },
      })
    ).status(),
  ).toBe(200);
  const name = "LongExerciseName".repeat(10);
  const equipment = [
    "Barbell",
    "Dumbbells",
    "Cable",
    "Machine",
    "Bodyweight",
    "Bench",
    "Kettlebell",
    "Resistance band",
    "Pull-up bar",
    "Other",
  ];
  expect(
    (
      await page.request.post("/api/v1/exercises", {
        headers: {
          Origin: "http://localhost:3100",
          "Idempotency-Key": randomUUID(),
        },
        data: {
          name,
          equipment,
          muscles: ["Chest", "Back", "Legs", "Shoulders", "Arms", "Core"],
        },
      })
    ).status(),
  ).toBe(201);
  await page.goto("/fitness/exercises");
  await page
    .getByRole("searchbox", { name: "Find an exercise" })
    .fill("LongExerciseName");
  const card = page.getByRole("button", { name, exact: true });
  await expect(card).toBeVisible();
  for (const width of testInfo.project.name === "desktop"
    ? [1280, 768]
    : [390, 320]) {
    await page.setViewportSize({ width, height: 820 });
    await expect(page.locator(".fitness-library-count")).toHaveText(
      "1 exercise",
    );
    if (width === 320)
      expect(
        (await page
          .getByRole("searchbox", { name: "Find an exercise" })
          .boundingBox())!.width,
      ).toBeGreaterThan(200);

    await expect(card.locator(".fitness-library-card-title")).toHaveAttribute(
      "title",
      name,
    );
    await expect(card.getByText("Custom", { exact: true })).toBeVisible();
    await expect(card.locator(".fitness-library-card-meta")).toHaveAttribute(
      "title",
      equipment.join(", "),
    );
    for (const selector of [
      ".fitness-library-card-title",
      ".fitness-library-card-meta",
    ]) {
      const metrics = await card.locator(selector).evaluate((node) => ({
        height: node.getBoundingClientRect().height,
        line: parseFloat(getComputedStyle(node).lineHeight),
      }));
      expect(metrics.height).toBeLessThanOrEqual(metrics.line * 2 + 1);
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const row = card.locator(".fitness-library-card-muscles");
    await expect
      .poll(async () =>
        row.locator(":scope > .fitness-card-muscle-tag").allTextContents(),
      )
      .toEqual(
        expect.arrayContaining([expect.stringMatching(/^(Chest|\+\d+)$/)]),
      );
    expect(
      await row.evaluate((node) =>
        Array.from(
          node.querySelectorAll(":scope > .fitness-card-muscle-tag"),
        ).every(
          (tag) =>
            tag.getBoundingClientRect().right <=
            node.getBoundingClientRect().right + 1,
        ),
      ),
    ).toBe(true);
  }
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("long-exercise-card.png"),
    fullPage: true,
  });
});
