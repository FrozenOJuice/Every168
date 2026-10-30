import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function setup(page: Page) {
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
    expect(response.ok()).toBe(true);
    return response.json();
  };
  await write("post", "/api/auth/sign-up/email", {
    name: "UX pass",
    email: `ux-${randomUUID()}@example.com`,
    password: "Synthetic-ux-password-123",
  });
  const exercise = await write("post", "/api/v1/exercises", {
    name: "Test intervals",
    loggingType: "duration",
  });
  const plan = await write("post", "/api/v1/strength-plans", {
    title: "Interval workout",
    exercises: [
      {
        exerciseId: exercise.id,
        loggingType: "duration",
        sets: [{ targetDurationSeconds: 90 }],
      },
    ],
  });
  return { write, exercise, plan };
}
async function addWorkout(page: Page) {
  const picker = page.getByRole("button", { name: "Add workout", exact: true });
  if ((await picker.getAttribute("aria-expanded")) !== "true")
    await picker.click();
  await page
    .getByRole("button", {
      name: "Add Interval workout to sequence",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
}
test("duration entry feeds a read-only review and explicit correction preserves actual results", async ({
  page,
}, info) => {
  const { write, plan } = await setup(page);
  const session = await write(
    "post",
    `/api/v1/strength-plans/${plan.id}/begin`,
    { startedAt: new Date(Date.now() - 1800000).toISOString() },
    plan.version,
  );
  await page.goto(`/fitness/session/${session.id}`);
  await page
    .getByRole("button", {
      name: "Expand Test intervals exercise",
      exact: true,
    })
    .click();
  const current = page.getByRole("region", {
    name: "Current set",
    exact: true,
  });
  await expect(current).toContainText("1m 30s");
  await current
    .getByRole("button", { name: "Edit results", exact: true })
    .click();
  await current
    .getByLabel("Actual duration (minutes)", { exact: true })
    .fill("2");
  await current
    .getByLabel("Actual duration (seconds)", { exact: true })
    .fill("");
  await current
    .getByRole("button", { name: "Complete set", exact: true })
    .click();
  await expect(page.locator(".fitness-save-state")).toHaveText("Saved");
  await page
    .getByRole("button", { name: "Finish workout", exact: true })
    .click();
  await expect(page.locator(".fitness-save-state")).toHaveText("Saved");
  const review = page.getByRole("region", {
    name: "Workout results",
    exact: true,
  });
  await expect(review).toContainText("1×2m");
  await expect(page.getByRole("spinbutton")).toHaveCount(0);
  const before = await (
    await page.request.get(`/api/v1/strength-workouts/${session.id}`)
  ).json();
  await page.reload();
  await expect(review).toBeVisible();
  await review.locator("summary").click();
  await expect(review.getByRole("list")).toContainText("2m");
  await expect(review.getByRole("list")).not.toContainText("1m 30s");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: info.outputPath("workout-review.png"),
    fullPage: true,
  });
  const unchanged = await (
    await page.request.get(`/api/v1/strength-workouts/${session.id}`)
  ).json();
  expect(unchanged.version).toBe(before.version);
  await review
    .getByRole("button", { name: "Help with Test intervals", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Back to workout", exact: true })
    .click();
  await expect(review).toBeVisible();
  await page
    .getByRole("button", { name: "Correct results", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Expand Test intervals exercise",
      exact: true,
    })
    .click();
  await page.getByLabel("Actual duration (minutes)", { exact: true }).fill("3");
  await expect(page.locator(".fitness-save-state")).toHaveText("Saved");
  await page
    .getByRole("button", { name: "Done correcting", exact: true })
    .click();
  await expect(review).toContainText("1×3m");
  const after = await (
    await page.request.get(`/api/v1/strength-workouts/${session.id}`)
  ).json();
  expect(after.exercises[0].sets[0]).toMatchObject({
    durationSeconds: 180,
    targetDurationSeconds: 90,
  });
});
test("program drafts recover incomplete fields and ordering, then clear after a retried save", async ({
  page,
}, info) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await setup(page);
  await page.goto("/fitness/programs/new");
  await page.getByLabel("Program name", { exact: true }).fill("My program");
  await addWorkout(page);
  await page
    .getByRole("button", { name: "Toggle program notes", exact: true })
    .click();
  await page
    .getByLabel("Program notes", { exact: true })
    .fill("Keep this draft");
  await page.evaluate(() => {
    const key = Object.keys(sessionStorage).find((value) =>
      value.startsWith("168hours:program-draft:"),
    )!;
    const stored = JSON.parse(sessionStorage.getItem(key)!);
    stored.input.startDate = "";
    sessionStorage.setItem(key, JSON.stringify(stored));
  });
  await page.reload();
  await expect(page.getByText("Draft restored", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Program name", { exact: true })).toHaveValue(
    "My program",
  );
  await expect(
    page.getByRole("button", { name: "Start date", exact: true }),
  ).toHaveText("Choose a date");
  await expect(page.locator(".fitness-program-steps")).toContainText(
    "Interval workout",
  );
  await page
    .getByRole("button", { name: "Toggle program notes", exact: true })
    .click();
  await expect(page.getByLabel("Program notes", { exact: true })).toHaveValue(
    "Keep this draft",
  );
  await page.getByRole("button", { name: "Save program", exact: true }).click();
  await expect(page.getByLabel("Start date", { exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Start date", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Choose day", exact: true })
    .getByRole("button", { name: /October 26, 2026/ })
    .click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("program-editor.png"),
    fullPage: true,
  });
  const keys: string[] = [];
  await page.route("**/api/v1/training-programs", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    keys.push(route.request().headers()["idempotency-key"]!);
    if (keys.length === 1) {
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Save program", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Retry same change", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Retry same change", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Next: Interval workout", exact: true }),
  ).toBeVisible();
  expect(browserErrors).toEqual([]);
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  await page.goto("/fitness/programs/new");
  await expect(page.getByLabel("Program name", { exact: true })).toHaveValue(
    "",
  );
  await expect(page.getByText("Draft restored", { exact: true })).toHaveCount(
    0,
  );
});

test("a conflicting program draft stays protected until explicitly discarded", async ({
  page,
}) => {
  const { write, plan } = await setup(page);
  const input = {
    title: "Original program",
    startDate: "2026-10-26",
    notes: null,
    paused: false,
    trainingDays: [],
    steps: [{ workoutId: plan.id }],
  };
  const program = await write("post", "/api/v1/training-programs", input);
  await page.goto(`/fitness/programs/${program.id}/edit`);
  await page.getByLabel("Program name", { exact: true }).fill("Local draft");
  await write(
    "put",
    `/api/v1/training-programs/${program.id}`,
    {
      ...input,
      title: "Remote update",
      steps: program.steps.map((step: { id: string; workoutId: string }) => ({
        id: step.id,
        workoutId: step.workoutId,
      })),
    },
    program.version,
  );
  await page.reload();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "This program changed elsewhere" }),
  ).toBeVisible();
  await expect(page.getByLabel("Program name", { exact: true })).toHaveValue(
    "Local draft",
  );
  await expect(
    page.getByRole("button", { name: "Save program", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Discard recovered changes", exact: true })
    .click();
  await expect(page.getByLabel("Program name", { exact: true })).toHaveValue(
    "Remote update",
  );
  await expect(
    page.getByRole("button", { name: "Save program", exact: true }),
  ).toBeEnabled();
  await page.reload();
  await expect(page.getByLabel("Program name", { exact: true })).toHaveValue(
    "Remote update",
  );
});
