import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
test.use({ actionTimeout: 10000 });
const headers = () => ({
  Origin: "http://localhost:3100",
  "Idempotency-Key": randomUUID(),
});
async function write(page: Page, path: string, data: object) {
  const response = await page.request.post(path, { headers: headers(), data });
  expect(response.ok(), await response.text()).toBe(true);
  return response.json();
}
async function signUp(page: Page) {
  await write(page, "/api/__test/register", {
    name: "Calendar scheduling",
    email: `calendar-schedule-${randomUUID()}@example.com`,
    password: "Synthetic-calendar-password-123",
  });
}
async function openPicker(page: Page) {
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const menu = page.getByRole("menu", { name: "Add to Calendar", exact: true });
  await expect(menu.getByRole("menuitem")).toHaveText([
    "Add plan",
    "Schedule workout",
  ]);
  await menu
    .getByRole("menuitem", { name: "Schedule workout", exact: true })
    .click();
  return page.getByRole("dialog", { name: "Schedule workout", exact: true });
}

test("Calendar schedules a ready domain workout at the selected time through the canonical service", async ({
  page,
}, info) => {
  if (info.project.name === "phone")
    await page.setViewportSize({ width: 320, height: 740 });
  await signUp(page);
  const exercise = await write(page, "/api/v1/exercises", {
    name: "Scheduling bench",
  });
  const plans = [];
  for (let index = 1; index <= 14; index++)
    plans.push(
      await write(page, "/api/v1/strength-plans", {
        title: `Routine ${String(index).padStart(2, "0")}`,
        notes: "Bring your training notebook.",
        exercises: [
          {
            exerciseId: exercise.id,
            sets: [{ targetReps: 8, targetWeightKg: 50 }],
          },
        ],
      }),
    );
  await write(page, "/api/v1/strength-plans", {
    title: "Unfinished draft",
    isDraft: true,
    exercises: [],
  });
  await page.goto("/?date=2026-09-07&view=day");
  await expect(page.locator(".calendar-interactions")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  const slot = page.locator(
    '.hour-slot[data-context-date="2026-09-07"][data-context-hour="9"]',
  );
  await slot.focus();
  await slot.press("ArrowDown");
  await expect(page.locator("[data-selected-time]")).toHaveAttribute(
    "data-selected-time",
    "2026-09-07T09:05",
  );
  const dialog = await openPicker(page);
  await expect(
    dialog.getByRole("searchbox", { name: "Search workouts" }),
  ).toBeFocused();
  await expect(dialog.locator(".calendar-source-choice")).toHaveCount(12);
  await dialog.getByRole("button", { name: "Load more", exact: true }).click();
  await expect(dialog.locator(".calendar-source-choice")).toHaveCount(14);
  await expect(dialog).not.toContainText("Unfinished draft");
  await dialog
    .getByRole("searchbox", { name: "Search workouts" })
    .fill("Routine 01");
  await expect(dialog.locator(".calendar-source-choice")).toHaveCount(1);
  expect(
    (
      await new AxeBuilder({ page })
        .include(".calendar-source-picker")
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.screenshot({ path: info.outputPath("workout-picker.png") });
  await dialog
    .getByRole("button", { name: "Routine 01 1 exercise", exact: true })
    .click();
  const start = dialog.getByRole("group", { name: "Start", exact: true });
  await expect(
    start.getByRole("button", { name: "Choose start date" }),
  ).toHaveText("Sep 7, 2026");
  await expect(
    start.getByRole("button", { name: "Choose start time" }),
  ).toHaveText("9:05 AM");
  await expect(
    dialog
      .getByRole("group", { name: "End", exact: true })
      .getByRole("button", { name: "Choose end time" }),
  ).toHaveText("10:05 AM");
  await expect(dialog).toContainText("Workout notes");
  await expect(dialog).toContainText("Bring your training notebook.");
  await dialog
    .getByRole("button", { name: "Change workout", exact: true })
    .click();
  await expect(
    dialog.getByRole("searchbox", { name: "Search workouts" }),
  ).toHaveValue("Routine 01");
  await dialog
    .getByRole("button", { name: "Routine 01 1 exercise", exact: true })
    .click();
  // Changing the chosen resource must respect dirty timing before returning to search.
  await dialog
    .getByRole("group", { name: "End", exact: true })
    .getByRole("button", { name: "Choose end time" })
    .click();
  const time = page.getByRole("dialog", {
    name: "Choose end time",
    exact: true,
  });
  await time.getByRole("listbox", { name: "Hour", exact: true }).press("End");
  await time
    .getByRole("listbox", { name: "Hour", exact: true })
    .press("ArrowUp");
  await time.getByRole("button", { name: "Set time", exact: true }).click();
  await dialog
    .getByRole("button", { name: "Change workout", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Discard schedule changes?", exact: true })
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
  await expect(
    dialog.getByRole("searchbox", { name: "Search workouts" }),
  ).toHaveValue("Routine 01");
  await dialog
    .getByRole("button", { name: "Routine 01 1 exercise", exact: true })
    .click();
  const keys: string[] = [];
  await page.route(
    `**/api/v1/strength-plans/${plans[0].id}/schedule`,
    async (route) => {
      keys.push(route.request().headers()["idempotency-key"]!);
      if (keys.length === 1) {
        expect((await route.fetch()).ok()).toBe(true);
        await route.abort("failed");
      } else await route.continue();
    },
  );
  await dialog
    .getByRole("button", { name: "Schedule workout", exact: true })
    .click();
  await expect(
    dialog.getByRole("button", { name: "Change workout", exact: true }),
  ).toBeDisabled();
  await dialog
    .getByRole("button", { name: "Retry same change", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  const scheduled = await (
    await page.request.get("/api/v1/strength-plans?kind=scheduled")
  ).json();
  expect(scheduled.items).toHaveLength(1);
  const reservation = await (
    await page.request.get(
      `/api/v1/time-blocks/${scheduled.items[0].timeBlockId}`,
    )
  ).json();
  expect(reservation).toMatchObject({
    title: "Routine 01",
    startsAt: "2026-09-07T09:05:00.000Z",
    endsAt: "2026-09-07T10:05:00.000Z",
  });
  expect(
    (
      await (
        await page.request.get(`/api/v1/strength-plans/${plans[0].id}`)
      ).json()
    ).version,
  ).toBe(plans[0].version);
  expect(
    (await (await page.request.get("/api/v1/strength-workouts")).json()).items,
  ).toHaveLength(0);
  await expect(page.locator(".app-toast-message")).toContainText(
    "Routine 01 scheduled.",
  );
  await page
    .getByRole("region", { name: "Daily time grid", exact: true })
    .getByRole("button", { name: /Routine 01.*planned/ })
    .dblclick();
  await expect(
    page
      .getByRole("dialog", { name: "Edit plan", exact: true })
      .getByRole("button", { name: "Start workout", exact: true }),
  ).toBeVisible();
});

test("domain scheduling handles empty and failed searches without creating a reservation", async ({
  page,
}) => {
  await signUp(page);
  await page.goto("/?date=2026-09-07&view=month");
  await expect(page.locator(".calendar-interactions")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await page.route("**/api/v1/strength-plans?*", (route) =>
    route.fulfill({
      status: 500,
      json: {
        error: { code: "INTERNAL_ERROR", message: "Could not load workouts." },
      },
    }),
  );
  const dialog = await openPicker(page);
  await expect(
    dialog.getByRole("button", { name: "Try again", exact: true }),
  ).toBeVisible();
  await page.unroute("**/api/v1/strength-plans?*");
  await dialog.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(dialog).toContainText("No workouts ready to schedule.");
  await dialog
    .getByRole("searchbox", { name: "Search workouts" })
    .fill("Missing workout");
  await expect(dialog).toContainText("No workouts match your search.");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(
    (await (await page.request.get("/api/v1/weeks/2026-09-07")).json()).blocks,
  ).toHaveLength(0);
});
