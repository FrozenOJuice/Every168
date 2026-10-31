import { fillCalendarField } from "./helpers/calendar-form";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.use({ actionTimeout: 10000 });
test("Tasks captures, organizes projects, schedules work, logs time and repeats without losing history", async ({
  page,
}, info) => {
  await page.request.post("/api/__test/register", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      name: "Tasks member",
      email: `tasks-${randomUUID()}@example.com`,
      password: "Synthetic-task-password-123",
    },
  });
  const me = await (await page.request.get("/api/v1/me")).json();
  await page.request.put("/api/v1/preferences", {
    headers: {
      Origin: "http://localhost:3100",
      "Idempotency-Key": randomUUID(),
      "If-Match": `"${me.preferences.version}"`,
    },
    data: {
      timezone: "UTC",
      weekStartsOn: 1,
      weightUnit: "kg",
      distanceUnit: "km",
    },
  });
  await page.goto("/tasks?date=2026-10-23");
  await page.getByLabel("Quick task title", { exact: true }).fill("Book a van");
  await page
    .locator(".tasks-capture")
    .getByRole("button", { name: "Add task", exact: true })
    .click();
  await page.getByRole("link", { name: /Book a van/ }).click();
  let dialog = page.getByRole("dialog", { name: "Task details", exact: true });
  await dialog
    .getByRole("button", { name: "Move out of Inbox", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Move out of Inbox", exact: true }),
  ).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await expect(page.getByRole("link", { name: /Book a van/ })).toHaveCount(0);
  await page.getByRole("link", { name: "Projects", exact: true }).click();
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  const projectDialog = page.getByRole("dialog", {
    name: "Create project",
    exact: true,
  });
  await projectDialog
    .getByLabel("Project name", { exact: true })
    .fill("Move house");
  await projectDialog
    .getByRole("button", { name: "Add section", exact: true })
    .click();
  await projectDialog
    .getByLabel("Section 1", { exact: true })
    .fill("Preparation");
  await projectDialog
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await page.getByRole("link", { name: /Move house/ }).click();
  await expect(
    page.getByRole("heading", { name: "Move house", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "New task", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Create task", exact: true });
  await editor.getByLabel("Task title", { exact: true }).fill("Monthly review");
  await expect(editor).toBeVisible();
  await editor
    .getByRole("combobox", { name: "Section", exact: true })
    .selectOption({ label: "Preparation" });
  await editor.getByLabel("Planned day", { exact: true }).fill("2026-10-23");
  await editor.getByLabel("Due date", { exact: true }).fill("2026-10-25");
  await editor
    .getByRole("combobox", { name: "Priority", exact: true })
    .selectOption("high");
  await editor.getByLabel("Tags", { exact: true }).fill("moving, planning");
  await editor
    .getByRole("button", { name: "Add subtask", exact: true })
    .click();
  await editor.getByLabel("Subtask 1", { exact: true }).fill("Check quotes");
  await editor
    .getByRole("combobox", { name: "Repeat", exact: true })
    .selectOption("monthly");
  await editor
    .getByRole("button", { name: "Create task", exact: true })
    .click();
  await page.getByRole("link", { name: /Monthly review/ }).click();
  dialog = page.getByRole("dialog", { name: "Task details", exact: true });
  await dialog
    .getByRole("button", { name: "Schedule work", exact: true })
    .click();
  await fillCalendarField(dialog, "Start", "2026-10-23T09:00");
  await fillCalendarField(dialog, "End", "2026-10-23T10:00");
  await dialog
    .getByRole("button", { name: "Schedule work", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Remove scheduled block", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Complete task", exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Log actual time", exact: true })
    .click();
  await fillCalendarField(dialog, "Start", "2026-10-23T09:05");
  await fillCalendarField(dialog, "End", "2026-10-23T09:35");
  await dialog
    .getByRole("button", { name: "Save actual time", exact: true })
    .click();
  await expect(dialog.getByText("30 minutes", { exact: true })).toBeVisible();
  await dialog
    .getByRole("button", { name: "Correct time", exact: true })
    .click();
  await fillCalendarField(dialog, "End", "2026-10-23T09:45");
  await dialog
    .getByRole("button", { name: "Save correction", exact: true })
    .click();
  await expect(dialog.getByText("40 minutes", { exact: true })).toBeVisible();
  await dialog
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  const nav = page.getByRole("navigation", { name: "Tasks views" });
  await nav.getByRole("link", { name: "Today", exact: true }).click();
  if (info.project.name !== "desktop")
    await page.getByRole("button", { name: "Day", exact: true }).click();
  const panel =
    info.project.name === "desktop"
      ? page.getByRole("complementary", { name: "Tasks day panel" })
      : page.getByRole("dialog", { name: "Your day", exact: true });
  await expect(
    panel.getByText("Planned for this day", { exact: true }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: info.outputPath("tasks-day.png"),
    fullPage: true,
  });
  await panel
    .getByRole("link", { name: "Open Calendar", exact: false })
    .click();
  await expect(page).toHaveURL(/date=2026-10-23/);
  await expect(
    page.getByRole("heading", { name: "Any time", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("region", { name: "Day activity" })
    .getByRole("link", { name: /Monthly review.*Any time/ })
    .click();
  dialog = page.getByRole("dialog", { name: "Task details", exact: true });
  await dialog
    .getByRole("button", { name: "Complete task", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Reopen task", exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await nav.getByRole("link", { name: "All tasks", exact: true }).click();
  await page.getByText("Search and filters", { exact: true }).click();
  await page.getByLabel("Search tasks", { exact: true }).fill("Monthly review");
  await expect(
    page.getByRole("link", { name: /Monthly review.*Nov/ }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Task status", exact: true })
    .selectOption("done");
  await expect(
    page.getByRole("link", { name: /Monthly review/ }),
  ).toBeVisible();
  await nav.getByRole("link", { name: "Routines", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Routines", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add routine", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("Task forms validate, protect drafts, retain stale edits and retry uncertain writes", async ({
  page,
}) => {
  await page.request.post("/api/__test/register", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      name: "Task forms",
      email: `task-forms-${randomUUID()}@example.com`,
      password: "Synthetic-task-password-123",
    },
  });
  await page.goto("/tasks?date=2026-10-23");
  await page.getByRole("button", { name: "New task", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Create task", exact: true });
  await form.getByRole("button", { name: "Create task", exact: true }).click();
  await expect(form.getByLabel("Task title", { exact: true })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await form.getByLabel("Task title", { exact: true }).fill("Keep this draft");
  await form.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Discard unsaved changes?", exact: true })
    .getByRole("button", { name: "Keep editing", exact: true })
    .click();
  await expect(form.getByLabel("Task title", { exact: true })).toHaveValue(
    "Keep this draft",
  );
  let dropped = false;
  await page.route("**/api/v1/tasks", async (route) => {
    if (route.request().method() === "POST" && !dropped) {
      dropped = true;
      await route.fetch();
      await route.abort();
    } else await route.continue();
  });
  await form.getByRole("button", { name: "Create task", exact: true }).click();
  await expect(
    form.getByRole("button", { name: "Retry same change", exact: true }),
  ).toBeVisible();
  await form
    .getByRole("button", { name: "Retry same change", exact: true })
    .click();
  await expect(form).toHaveCount(0);
  await page.getByRole("link", { name: /Keep this draft/ }).click();
  const details = page.getByRole("dialog", {
    name: "Task details",
    exact: true,
  });
  await details.getByRole("button", { name: "Edit task", exact: true }).click();
  await details
    .getByLabel("Task title", { exact: true })
    .fill("My unsaved edit");
  const list = await (
    await page.request.get("/api/v1/tasks?date=2026-10-23&view=all")
  ).json();
  expect(list.items).toHaveLength(1);
  const task = list.items[0];
  await page.request.put(`/api/v1/tasks/${task.id}/state`, {
    headers: {
      Origin: "http://localhost:3100",
      "Idempotency-Key": randomUUID(),
      "If-Match": `"${task.version}"`,
    },
    data: { status: "in_progress" },
  });
  await details.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(details.getByRole("alert")).toContainText("changed since");
  await expect(details.getByLabel("Task title", { exact: true })).toHaveValue(
    "My unsaved edit",
  );
});

test("Quick capture keeps an uncertain save through day changes and blocks leaving before retry", async ({
  page,
}) => {
  await page.request.post("/api/__test/register", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      name: "Quick tasks",
      email: `quick-tasks-${randomUUID()}@example.com`,
      password: "Synthetic-task-password-123",
    },
  });
  await page.goto("/tasks?date=2026-10-23&view=today");
  let dropped = false;
  await page.route("**/api/v1/tasks", async (route) => {
    if (route.request().method() === "POST" && !dropped) {
      dropped = true;
      await route.fetch();
      await route.abort();
    } else await route.continue();
  });
  await page
    .getByLabel("Quick task title", { exact: true })
    .fill("Confirm this capture");
  const capture = page.locator(".tasks-capture");
  await capture.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(
    capture.getByRole("button", { name: "Retry same change", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Food", exact: true })
    .click();
  await expect(page).toHaveURL(/\/tasks\?/);
  await expect(
    page.getByLabel("Quick task title", { exact: true }),
  ).toHaveValue("Confirm this capture");
  await capture
    .getByRole("button", { name: "Retry same change", exact: true })
    .click();
  await expect(
    page.getByLabel("Quick task title", { exact: true }),
  ).toHaveValue("");
  const list = await (
    await page.request.get("/api/v1/tasks?date=2026-10-23&view=all")
  ).json();
  expect(list.items).toHaveLength(1);
  expect(list.items[0]).toMatchObject({
    title: "Confirm this capture",
    plannedDate: "2026-10-23",
  });
});
