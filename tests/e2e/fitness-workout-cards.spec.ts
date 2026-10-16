import { randomUUID } from "node:crypto";
import { expect, test, type Page, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.use({ actionTimeout: 10000 });
async function drag(
  page: Page,
  source: Locator,
  target: Locator,
  touch: boolean,
  cancel = false,
) {
  await source.scrollIntoViewIfNeeded();
  const a = (await source.boundingBox())!,
    b = (await target.boundingBox())!;
  const x = a.x + a.width / 2,
    y = a.y + a.height / 2,
    endY = b.y + b.height / 2;
  if (touch) {
    const client = await page.context().newCDPSession(page);
    await client.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: endY }],
    });
    await expect(page.locator(".fitness-sort-source")).toHaveCount(1);
    await client.send("Input.dispatchTouchEvent", {
      type: cancel ? "touchCancel" : "touchEnd",
      touchPoints: [],
    });
    await client.detach();
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, endY, { steps: 5 });
    await expect(page.locator(".fitness-sort-source")).toHaveCount(1);
    if (cancel) await page.keyboard.press("Escape");
    await page.mouse.up();
  }
  await expect(page.locator(".fitness-sort-source")).toHaveCount(0);
}

test("compact workout cards expose removal and reorder exercises and sets by handle", async ({
  page,
}, testInfo) => {
  test.setTimeout(120000);
  expect(
    (
      await page.request.post("/api/auth/sign-up/email", {
        headers: { Origin: "http://localhost:3100" },
        data: {
          name: "Card member",
          email: `cards-${randomUUID()}@example.com`,
          password: "Synthetic-card-password-123",
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
  await right
    .getByRole("link", { name: "Create workout", exact: true })
    .click();
  await right
    .getByLabel("Workout title", { exact: true })
    .fill("Compact workout");
  const touch = testInfo.project.name === "phone";
  if (touch)
    await right
      .getByRole("button", { name: "Add exercise", exact: true })
      .click();
  const left = page.locator(".fitness-exercise-panel");
  for (const name of ["Bench press", "Squat"]) {
    if (!touch) await left.getByRole("button", { name, exact: true }).hover();
    await left
      .getByRole("button", { name: `Add ${name}`, exact: true })
      .click();
  }
  if (touch)
    await page
      .getByRole("button", { name: "Back to workout", exact: true })
      .click();
  const exercises = right.locator(".fitness-workout-exercise-list > section");
  const titles = () => exercises.locator(".fitness-exercise-name");
  await expect(titles()).toHaveText(["Bench press", "Squat"]);
  expect((await exercises.first().boundingBox())!.height).toBeLessThan(220);
  const handles = right.locator(
    ".fitness-workout-exercise-heading > .fitness-reorder-handle",
  );
  await drag(page, handles.first(), handles.nth(1), touch, true);
  await expect(titles()).toHaveText(["Bench press", "Squat"]);
  await drag(page, handles.first(), handles.nth(1), touch);
  await expect(titles()).toHaveText(["Squat", "Bench press"]);
  await handles.nth(1).focus();
  await page.keyboard.press("ArrowUp");
  await expect(titles()).toHaveText(["Bench press", "Squat"]);
  await expect(handles.first()).toBeFocused();
  const bench = exercises.first();
  await bench.getByLabel("Target reps", { exact: true }).fill("5");
  await bench.getByRole("button", { name: "Add set", exact: true }).click();
  await bench.getByRole("button", { name: "Add set", exact: true }).click();
  const rows = bench.locator(".fitness-workout-set-list > [data-reorder-item]");
  await rows.nth(1).getByLabel("Target reps", { exact: true }).fill("8");
  await rows.nth(2).getByLabel("Target reps", { exact: true }).fill("12");
  const reps = () => bench.getByLabel("Target reps", { exact: true });
  const setHandles = rows.locator(".fitness-reorder-handle");
  await drag(page, setHandles.first(), setHandles.nth(2), touch);
  await expect
    .poll(() =>
      reps().evaluateAll((nodes) =>
        nodes.map((node) => (node as HTMLInputElement).value),
      ),
    )
    .toEqual(["8", "12", "5"]);
  await setHandles.nth(2).focus();
  await page.keyboard.press("ArrowUp");
  await expect
    .poll(() =>
      reps().evaluateAll((nodes) =>
        nodes.map((node) => (node as HTMLInputElement).value),
      ),
    )
    .toEqual(["8", "5", "12"]);
  await expect(setHandles.nth(1)).toBeFocused();
  await bench
    .getByRole("button", { name: "Remove set 2", exact: true })
    .click();
  await expect
    .poll(() =>
      reps().evaluateAll((nodes) =>
        nodes.map((node) => (node as HTMLInputElement).value),
      ),
    )
    .toEqual(["8", "12"]);
  await bench
    .getByRole("button", { name: "More details for set 1", exact: true })
    .click();
  await rows.first().getByLabel("Rest (seconds)", { exact: true }).fill("90");
  await bench
    .getByRole("button", { name: "More details for set 1", exact: true })
    .click();
  await expect(rows.first()).toContainText("90s rest");
  await right
    .getByRole("button", { name: "Remove Squat exercise", exact: true })
    .click();
  await expect(titles()).toHaveText(["Bench press"]);
  await expect(page.locator(".fitness-set-actions")).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("compact-workout-cards.png"),
    fullPage: true,
  });
  await right
    .getByRole("button", { name: "Save workout", exact: true })
    .click();
  await expect(page).toHaveURL(/\/fitness$/);
  const plans = await (await page.request.get("/api/v1/strength-plans")).json();
  expect(
    plans.items[0].exercises.map((exercise: { name: string }) => exercise.name),
  ).toEqual(["Bench press"]);
  expect(
    plans.items[0].exercises[0].sets.map(
      (set: { targetReps: number }) => set.targetReps,
    ),
  ).toEqual([8, 12]);
  expect(plans.items[0].exercises[0].sets[0].restSeconds).toBe(90);
});
