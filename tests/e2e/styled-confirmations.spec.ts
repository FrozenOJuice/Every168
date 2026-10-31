import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function account(page: Page) {
  const native: string[] = [];
  page.on("dialog", async (dialog) => {
    native.push(dialog.type());
    await dialog.dismiss();
  });
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
  await write("/api/__test/register", {
    name: "Styled confirmations",
    email: `styled-${randomUUID()}@example.com`,
    password: "Synthetic-confirmations-password-123",
  });
  return { native, write };
}

for (const fallback of [false, true]) {
  test(`unsaved result navigation uses styled dialogs and discards the draft (${fallback ? "history fallback" : "Navigation API"})`, async ({
    page,
  }, info) => {
    if (fallback)
      await page.addInitScript(() => {
        Object.defineProperty(window, "navigation", {
          value: undefined,
          configurable: true,
        });
      });
    const { native, write } = await account(page);
    const exercise = await write("/api/v1/exercises", { name: "Guard bench" });
    const session = await write("/api/v1/strength-workouts", {
      title: "Saved results",
      startedAt: "2026-10-23T12:00:00Z",
    });
    const saved = await write(
      `/api/v1/strength-workouts/${session.id}`,
      {
        title: session.title,
        startedAt: session.startedAt,
        endedAt: "2026-10-23T13:00:00Z",
        exercises: [
          {
            exerciseId: exercise.id,
            sets: [{ completed: true, reps: 10, weightKg: 50 }],
          },
        ],
      },
      session.version,
    );
    await page.goto("/fitness");
    await page
      .getByRole("navigation", { name: "Fitness views" })
      .getByRole("link", { name: "History", exact: true })
      .click();
    await page.getByRole("link", { name: /Saved results/ }).click();
    await expect(
      page.getByRole("heading", {
        name: "Saved results - Summary",
        exact: true,
      }),
    ).toBeVisible();
    await expect
      .poll(() => new URL(page.url()).pathname)
      .toBe(`/fitness/session/${session.id}`);
    const summaryUrl = page.url();
    await page
      .getByRole("button", { name: "Correct results", exact: true })
      .click();
    await page
      .getByLabel("Workout name", { exact: true })
      .fill("Unsaved result changes");
    const training = page
      .getByRole("navigation", { name: "Fitness views" })
      .getByRole("link", { name: "Training", exact: true });
    const confirmation = page.getByRole("dialog", {
      name: "Discard changes?",
      exact: true,
    });
    await training.click();
    await expect(confirmation).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await confirmation
      .getByRole("button", { name: "Keep editing", exact: true })
      .click();
    await expect(page).toHaveURL(summaryUrl);
    await expect(page.getByLabel("Workout name", { exact: true })).toHaveValue(
      "Unsaved result changes",
    );
    await training.click();
    await page.keyboard.press("Escape");
    await expect(confirmation).not.toBeVisible();
    await training.click();
    await confirmation
      .getByRole("button", { name: "Discard changes", exact: true })
      .click();
    await expect(page).toHaveURL(/\/fitness$/);
    expect(
      (
        await (
          await page.request.get(`/api/v1/strength-workouts/${session.id}`)
        ).json()
      ).version,
    ).toBe(saved.version);
    await page
      .getByRole("navigation", { name: "Fitness views" })
      .getByRole("link", { name: "History", exact: true })
      .click();
    await page.getByRole("link", { name: /Saved results/ }).click();
    await expect(
      page.getByRole("heading", {
        name: "Saved results - Summary",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Correct results", exact: true })
      .click();
    await expect(page.getByLabel("Workout name", { exact: true })).toHaveValue(
      "Saved results",
    );
    await page
      .getByLabel("Workout name", { exact: true })
      .fill("Back button draft");
    await page.evaluate(() => window.history.back());
    await expect(confirmation).toBeVisible();
    await confirmation
      .getByRole("button", { name: "Keep editing", exact: true })
      .click();
    await expect(page.getByLabel("Workout name", { exact: true })).toHaveValue(
      "Back button draft",
    );
    await page.evaluate(() => window.history.back());
    await confirmation
      .getByRole("button", { name: "Discard changes", exact: true })
      .click();
    await expect(page).toHaveURL(/\/fitness\/history$/);
    await page.evaluate(() => window.history.forward());
    await expect(
      page.getByRole("heading", {
        name: "Saved results - Summary",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Correct results", exact: true })
      .click();
    await page
      .getByLabel("Workout name", { exact: true })
      .fill("Refresh keeps recovery");
    await page.reload();
    await expect(page.getByLabel("Workout name", { exact: true })).toHaveValue(
      "Refresh keeps recovery",
    );
    await training.click();
    await confirmation.screenshot({
      path: info.outputPath("discard-navigation.png"),
    });
    await confirmation
      .getByRole("button", { name: "Keep editing", exact: true })
      .click();
    expect(native).toEqual([]);
  });
}

test("legacy task discard, imperative navigation, template rename and delete use styled dialogs", async ({
  page,
}, info) => {
  const { native, write } = await account(page);
  await write("/api/v1/time-blocks", {
    title: "Keep this planned block",
    startsAt: "2026-10-23T12:00:00Z",
    endsAt: "2026-10-23T13:00:00Z",
  });
  await write("/api/v1/calendar/templates", {
    name: "Rename this template",
    span: "day",
    sourceDate: "2026-10-23",
  });
  await page.goto("/?date=2026-10-23&view=day");
  await page.getByRole("button", { name: "Actions", exact: true }).click();
  await page
    .getByRole("menuitem", { name: "Calendar tools…", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^Templates/ })
    .click();
  const template = page
    .getByRole("dialog")
    .locator("li")
    .filter({ hasText: "Rename this template" });
  await template.getByRole("button", { name: "Rename", exact: true }).click();
  const rename = page.getByRole("dialog", {
    name: "Template name",
    exact: true,
  });
  await rename
    .getByLabel("Template name", { exact: true })
    .fill("Renamed template");
  await rename.getByRole("button", { name: "Rename", exact: true }).click();
  const renamed = page
    .getByRole("dialog")
    .locator("li")
    .filter({ hasText: "Renamed template" });
  await expect(renamed).toBeVisible();
  await renamed.getByRole("button", { name: "Delete", exact: true }).click();
  const deletion = page.getByRole("dialog", {
    name: "Delete this template?",
    exact: true,
  });
  await expect(deletion).toContainText("Applied plans will remain.");
  await deletion.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(renamed).toBeVisible();
  await renamed.getByRole("button", { name: "Delete", exact: true }).click();
  await deletion.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(renamed).toHaveCount(0);
  await page.goto("/tasks");
  await page.getByRole("button", { name: "New task", exact: true }).click();
  const task = page.getByRole("dialog", { name: "Create task", exact: true });
  await task
    .getByLabel("Task title", { exact: true })
    .fill("Retain this task draft");
  await task.getByRole("button", { name: "Close dialog", exact: true }).click();
  const discard = page.getByRole("dialog", {
    name: "Discard unsaved changes?",
    exact: true,
  });
  await discard
    .getByRole("button", { name: "Keep editing", exact: true })
    .click();
  await expect(task.getByLabel("Task title", { exact: true })).toHaveValue(
    "Retain this task draft",
  );
  await task.getByRole("button", { name: "Close dialog", exact: true }).click();
  await discard.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(task).not.toBeVisible();
  await page
    .getByLabel("Quick task title", { exact: true })
    .fill("Unsaved quick capture");
  if (info.project.name === "phone")
    await page.getByRole("button", { name: "Day", exact: true }).click();
  await page.getByRole("link", { name: "Open Calendar", exact: true }).click();
  const navigation = page.getByRole("dialog", {
    name: "Discard changes?",
    exact: true,
  });
  await navigation
    .getByRole("button", { name: "Keep editing", exact: true })
    .click();
  await expect(page).toHaveURL(/\/tasks/);
  await page.getByRole("link", { name: "Open Calendar", exact: true }).click();
  await navigation
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
  await expect(page).not.toHaveURL(/\/tasks/);
  expect(native).toEqual([]);
});
