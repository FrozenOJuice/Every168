import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.use({ actionTimeout: 10000 });

test("the right library supports workouts and exercise editing in the main area", async ({
  page,
}, testInfo) => {
  test.setTimeout(90000);
  expect(
    (
      await page.request.post("/api/auth/sign-up/email", {
        headers: { Origin: "http://localhost:3100" },
        data: {
          name: "Fitness workspace member",
          email: `workspace-${randomUUID()}@example.com`,
          password: "Synthetic-workout-password-123",
        },
      })
    ).status(),
  ).toBe(200);
  await page.goto("/fitness");
  const right = page.getByRole("region", {
    name: "Workout workspace",
    exact: true,
    includeHidden: true,
  });
  const left = page.locator(".fitness-exercise-panel");
  const search = page.getByRole("searchbox", {
    name: "Find an exercise",
    exact: true,
  });
  await expect(page.locator(".fitness-library-card")).toHaveCount(16);
  await expect(
    right.getByRole("heading", { name: "Next workout", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Browse exercises", exact: true }),
  ).toHaveCount(0);
  await expect(
    right.getByText("No scheduled workouts.", { exact: true }),
  ).toBeVisible();
  const initialLibraryWidth =
    testInfo.project.name === "desktop"
      ? (await left.boundingBox())!.width
      : null;
  await search.fill("press");
  await right
    .getByRole("link", { name: "Create workout", exact: true })
    .click();
  const title = right.getByLabel("Workout title", { exact: true });
  await title.fill("Push day");
  if (testInfo.project.name === "phone")
    await right
      .getByRole("button", { name: "Add exercise", exact: true })
      .click();
  await expect(search).toHaveValue("press");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  if (testInfo.project.name === "desktop") {
    const l = (await left.boundingBox())!,
      r = (await right.boundingBox())!;
    expect(l.x).toBeGreaterThan(r.x + r.width);
    expect(r.width).toBeGreaterThan(l.width);
    expect(Math.abs(l.width - initialLibraryWidth!)).toBeLessThan(1);
    await expect(title).toBeVisible();
  }
  await left
    .getByRole("button", { name: "Create exercise", exact: true })
    .click();
  const exerciseEditor = page.getByRole("region", {
    name: "Create exercise",
    exact: true,
  });
  await expect(
    exerciseEditor.getByLabel("Exercise name", { exact: true }),
  ).toBeFocused();
  await expect(right.getByLabel("Workout title", { exact: true })).toHaveValue(
    "Push day",
  );
  if (testInfo.project.name === "desktop") {
    expect((await exerciseEditor.boundingBox())!.x).toBeLessThan(
      (await left.boundingBox())!.x,
    );
    await expect(
      left.getByRole("searchbox", { name: "Find an exercise", exact: true }),
    ).toBeVisible();
  }
  await exerciseEditor
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(search).toHaveValue("press");
  const benchCard = left.getByRole("button", {
    name: "Bench press",
    exact: true,
  });
  const addBench = left.getByRole("button", {
    name: "Add Bench press",
    exact: true,
  });
  const benchTile = benchCard.locator("..");
  if (testInfo.project.name === "desktop") {
    await search.focus();
    await page.mouse.move(0, 0);
    await expect(addBench).toHaveCSS("opacity", "0");
    await expect(benchTile.locator(".fitness-card-information")).toHaveCSS(
      "opacity",
      "1",
    );
    await benchCard.hover();
  }
  await expect(addBench).toHaveCSS("opacity", "1");
  await expect(benchTile.locator(".fitness-card-information")).toHaveCSS(
    "opacity",
    "0",
  );
  await expect(addBench).toHaveText("Add to workout");
  const visual = await benchCard
    .locator(".fitness-card-visual-wrap")
    .boundingBox();
  const information = await benchTile
    .locator(".fitness-card-information")
    .boundingBox();
  const addBox = await addBench.boundingBox();
  expect(addBox!.y).toBeGreaterThanOrEqual(visual!.y + visual!.height);
  expect(
    Math.abs(
      addBox!.x + addBox!.width / 2 - (information!.x + information!.width / 2),
    ),
  ).toBeLessThan(2);
  await expect(benchCard.locator(".fitness-library-card-title")).toBeVisible();
  await benchCard.locator("..").screenshot({
    path: testInfo.outputPath("exercise-card-add-button.png"),
  });
  if (testInfo.project.name === "desktop") {
    await addBench.focus();
    await page.keyboard.press("Enter");
  } else await addBench.tap();
  await expect(page.locator(".fitness-picker-add")).toHaveCount(0);
  await expect(page.locator(".fitness-card-details")).toHaveCount(0);
  await expect(page.locator(".fitness-panel-notice")).toHaveText(
    "Added Bench press",
  );
  if (testInfo.project.name === "desktop") {
    await benchCard.focus();
    await page.keyboard.press("Enter");
  } else await benchCard.tap();
  await expect(right.locator(".fitness-exercise")).toHaveCount(1);
  await expect(
    left.getByRole("region", { name: "Bench press details", exact: true }),
  ).toBeVisible();
  if (testInfo.project.name === "desktop")
    await expect(title).toHaveValue("Push day");
  await left
    .getByRole("button", { name: "Back to exercises", exact: true })
    .click();
  await expect(search).toHaveValue("press");
  if (testInfo.project.name === "desktop") await benchCard.hover();
  await left
    .getByRole("button", { name: "Favourite Bench press", exact: true })
    .click();
  await expect(right.locator(".fitness-exercise")).toHaveCount(1);
  await search.fill("");
  if (testInfo.project.name === "desktop")
    await left.getByRole("button", { name: "Squat", exact: true }).hover();
  await left.getByRole("button", { name: "Add Squat", exact: true }).click();
  await expect(page.locator(".fitness-panel-notice")).toHaveText("Added Squat");
  await expect(right.locator(".fitness-exercise")).toHaveCount(2);
  if (testInfo.project.name === "desktop") {
    const squat = left.getByRole("button", {
      name: "Squat",
      exact: true,
    });
    await left.getByRole("button", { name: "Add Squat", exact: true }).hover();
    await squat.scrollIntoViewIfNeeded();
    const scroll = await page
      .locator(".fitness-exercise-grid")
      .evaluate((node) => node.scrollTop);
    await squat.click();
    await left
      .getByRole("button", { name: "Back to exercises", exact: true })
      .click();
    await expect
      .poll(() =>
        page
          .locator(".fitness-exercise-grid")
          .evaluate((node) => node.scrollTop),
      )
      .toBe(scroll);
  } else
    await page
      .getByRole("button", { name: "Back to workout", exact: true })
      .click();
  await right.getByLabel("Target reps", { exact: true }).first().fill("8");
  await right
    .getByRole("button", { name: "Help with Bench press", exact: true })
    .click();
  await expect(
    left.getByRole("region", { name: "Bench press details", exact: true }),
  ).toBeVisible();
  await expect(
    left.getByRole("heading", { name: "Equipment", exact: true }),
  ).toBeVisible();
  await expect(
    right.getByLabel("Target reps", { exact: true }).first(),
  ).toHaveValue("8");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("fitness-library-and-workout.png"),
    fullPage: true,
  });
  await left
    .getByRole("button", { name: "Back to exercises", exact: true })
    .click();
  if (testInfo.project.name === "phone")
    await page
      .getByRole("button", { name: "Back to workout", exact: true })
      .click();
  await right
    .getByRole("button", { name: "Save workout", exact: true })
    .click();
  await expect(page).toHaveURL(/\/fitness$/);
  const card = right.locator(".fitness-workout-card").filter({
    has: page.getByRole("heading", { name: "Push day", exact: true }),
  });
  await expect(card).toBeVisible();
  await expect(page.locator(".fitness-library-card")).toHaveCount(16);
  await page.locator(".fitness-exercise-grid").evaluate((node) => {
    node.scrollTop = 0;
  });
  await page.screenshot({
    path: testInfo.outputPath("fitness-library-overview.png"),
    fullPage: true,
  });
  await card.getByRole("link", { name: "Edit", exact: true }).click();
  await expect(title).toHaveValue("Push day");
  await expect(
    right.getByLabel("Target reps", { exact: true }).first(),
  ).toHaveValue("8");
  await right.getByRole("button", { name: "Cancel", exact: true }).click();
  const plans = await (await page.request.get("/api/v1/strength-plans")).json();
  expect(
    (
      await page.request.post(
        `/api/v1/strength-plans/${plans.items[0].id}/schedule`,
        {
          headers: {
            Origin: "http://localhost:3100",
            "Idempotency-Key": randomUUID(),
            "If-Match": `"${plans.items[0].version}"`,
          },
          data: {
            startsAt: "2030-01-15T15:00:00Z",
            endsAt: "2030-01-15T16:00:00Z",
          },
        },
      )
    ).status(),
  ).toBe(201);
  await page.reload();
  await expect(
    right
      .locator("section")
      .filter({
        has: page.getByRole("heading", { name: "Next workout", exact: true }),
      })
      .getByRole("heading", { name: "Push day", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("fitness-next-workout.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
