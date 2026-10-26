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
  await write("/api/auth/sign-up/email", {
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
  await page
    .getByRole("button", { name: "Expand Session bench exercise", exact: true })
    .click();
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
    .getByRole("spinbutton", { name: "Target load (kg)", exact: true })
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
    .getByRole("button", { name: "Back to training", exact: true })
    .click();
  await expect(
    current.getByRole("heading", { name: "Set 2 of 3" }),
  ).toBeVisible();
  await expect(current.locator(".fitness-live-results dd")).toHaveText([
    "12",
    "45",
  ]);
  await expect(
    page.getByRole("button", {
      name: "Expand Session row exercise",
      exact: true,
    }),
  ).toBeVisible();
  record = await read();
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
});
