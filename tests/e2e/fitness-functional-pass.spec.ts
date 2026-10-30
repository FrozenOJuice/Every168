import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
async function fixture(page: Page) {
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
    name: "Functional pass",
    email: `functional-${randomUUID()}@example.com`,
    password: "Synthetic-functional-password-123",
  });
  const exercise = await write("/api/v1/exercises", {
    name: "Test bench",
    loggingType: "reps_load",
  });
  const plan = await write("/api/v1/strength-plans", {
    title: "Test workout",
    exercises: [
      {
        exerciseId: exercise.id,
        sets: Array.from({ length: 3 }, () => ({
          targetReps: 12,
          targetWeightKg: 40,
          restSeconds: 120,
        })),
      },
    ],
  });
  const begin = () =>
    write(
      `/api/v1/strength-plans/${plan.id}/begin`,
      { startedAt: new Date().toISOString() },
      plan.version,
    );
  return { exercise, plan, write, begin };
}
const saved = (page: Page) =>
  expect(page.locator(".fitness-save-state")).toHaveText("Saved");
const current = (page: Page) =>
  page.getByRole("region", { name: "Current set", exact: true });
const expand = (page: Page) =>
  page
    .getByRole("button", { name: "Expand Test bench exercise", exact: true })
    .click();

test("cleared actuals survive reload; recorded removals need confirmation and can be undone", async ({
  page,
}) => {
  const { begin } = await fixture(page);
  const session = await begin();
  const endpoint = `/api/v1/strength-workouts/${session.id}`;
  const read = async () => (await page.request.get(endpoint)).json();
  await page.goto(`/fitness/session/${session.id}`);
  await expand(page);
  await current(page)
    .getByRole("button", { name: "Edit results", exact: true })
    .click();
  await current(page)
    .getByRole("spinbutton", { name: "Actual reps", exact: true })
    .fill("");
  await current(page)
    .getByRole("spinbutton", { name: "Actual weight (kg)", exact: true })
    .fill("");
  await saved(page);
  await page.reload();
  await expand(page);
  await expect(current(page).locator("dd")).toHaveText(["—", "—"]);
  await expect(
    current(page).getByRole("button", { name: "Complete set", exact: true }),
  ).toBeDisabled();
  await current(page)
    .getByRole("button", { name: "Edit results", exact: true })
    .click();
  await current(page)
    .getByRole("spinbutton", { name: "Actual reps", exact: true })
    .fill("10");
  await current(page)
    .getByRole("spinbutton", { name: "Actual weight (kg)", exact: true })
    .fill("40");
  await current(page)
    .getByRole("button", { name: "Complete set", exact: true })
    .click();
  await current(page)
    .getByRole("button", { name: "Complete set", exact: true })
    .click();
  await saved(page);
  await expect(page.getByRole("timer")).toContainText("Test bench");
  await page.getByRole("button", { name: "Edit workout", exact: true }).click();
  const editor = page.getByRole("region", {
    name: "Edit current workout",
    exact: true,
  });
  await editor
    .getByRole("button", { name: "Expand Test bench exercise", exact: true })
    .click();
  const count = editor.getByRole("spinbutton", { name: "Sets", exact: true });
  await count.fill("1");
  expect((await read()).exercises[0].sets).toHaveLength(3);
  await count.blur();
  const dialog = page.getByRole("dialog", { name: "Remove recorded results?" });
  await expect(dialog).toContainText("1 recorded set");
  await dialog.getByRole("button", { name: "Keep results" }).click();
  await expect(count).toHaveValue("3");
  await count.fill("1");
  await count.blur();
  await dialog
    .getByRole("button", { name: "Remove results", exact: true })
    .click();
  await saved(page);
  expect((await read()).exercises[0].sets).toHaveLength(1);
  await page.getByRole("button", { name: "Undo removal", exact: true }).click();
  await saved(page);
  expect((await read()).exercises[0].sets).toHaveLength(3);
  expect((await read()).exercises[0].sets[1]).toMatchObject({
    completed: true,
    reps: 12,
    weightKg: 40,
  });
  await page.reload();
  await expect(page.getByRole("timer")).toContainText("Test bench");
});

test("edits queue during autosave and an uncertain save survives reload with its original key", async ({
  page,
}) => {
  const { begin } = await fixture(page);
  const session = await begin();
  await page.goto(`/fitness/session/${session.id}`);
  await expand(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let intercepted = false;
  const endpoint = `**/strength-workouts/${session.id}`;
  await page.route(endpoint, async (route) => {
    if (route.request().method() !== "PUT" || intercepted) {
      await route.continue();
      return;
    }
    intercepted = true;
    const response = await route.fetch();
    await gate;
    await route.fulfill({ response });
  });
  await current(page)
    .getByRole("button", { name: "Edit results", exact: true })
    .click();
  await expect.poll(() => intercepted).toBe(true);
  const reps = current(page).getByRole("spinbutton", {
    name: "Actual reps",
    exact: true,
  });
  await expect(reps).toBeEnabled();
  await reps.fill("9");
  release();
  await saved(page);
  expect(
    (
      await (
        await page.request.get(`/api/v1/strength-workouts/${session.id}`)
      ).json()
    ).exercises[0].sets[0].reps,
  ).toBe(9);
  await page.unroute(endpoint);
  let firstKey = "";
  await page.route(endpoint, async (route) => {
    if (route.request().method() !== "PUT") {
      await route.continue();
      return;
    }
    firstKey = route.request().headers()["idempotency-key"]!;
    await route.fetch();
    await route.abort("failed");
  });
  await reps.fill("8");
  await expect(
    page.getByRole("button", { name: "Retry same change", exact: true }),
  ).toBeVisible();
  await page.unroute(endpoint);
  page.on("dialog", (d) => d.accept());
  await page.reload();
  let retryKey = "";
  page.on("request", (r) => {
    if (
      r.method() === "PUT" &&
      r.url().endsWith(`/strength-workouts/${session.id}`)
    )
      retryKey = r.headers()["idempotency-key"]!;
  });
  await page
    .getByRole("button", { name: "Retry same change", exact: true })
    .click();
  await saved(page);
  expect(retryKey).toBe(firstKey);
  expect(
    (
      await (
        await page.request.get(`/api/v1/strength-workouts/${session.id}`)
      ).json()
    ).exercises[0].sets[0].reps,
  ).toBe(8);
});

test("uncertain schedules cannot be dismissed and refresh retries the same operation", async ({
  page,
}) => {
  const { plan } = await fixture(page);
  await page.goto("/fitness?date=2026-10-29");
  await page.getByRole("button", { name: "Schedule", exact: true }).click();
  const endpoint = `**/strength-plans/${plan.id}/schedule`;
  let key = "";
  let reserved!: { startsAt: string; endsAt: string };
  await page.route(endpoint, async (route) => {
    key = route.request().headers()["idempotency-key"]!;
    reserved = route.request().postDataJSON();
    await route.fetch();
    await route.abort("failed");
  });
  await page
    .getByRole("button", { name: "Schedule workout", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Retry same change", exact: true }),
  ).toBeVisible();
  await page.getByRole("dialog").press("Escape");
  await expect(
    page.getByRole("button", { name: "Retry same change", exact: true }),
  ).toBeVisible();
  await page.unroute(endpoint);
  page.on("dialog", (d) => d.accept());
  await page.goto("/fitness?date=2026-11-03");
  await expect(
    page.getByRole("button", { name: "Choose start date", exact: true }),
  ).toHaveText("Oct 29, 2026");
  let retryKey = "";
  page.on("request", (r) => {
    if (r.url().endsWith(`/strength-plans/${plan.id}/schedule`))
      retryKey = r.headers()["idempotency-key"]!;
  });
  await page
    .getByRole("button", { name: "Retry same change", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(retryKey).toBe(key);
  await expect(page).toHaveURL(/date=2026-10-29/);
  await expect(
    page.getByRole("status").filter({ hasText: "Test workout scheduled for" }),
  ).toBeVisible();
  const scheduled = await (
    await page.request.get("/api/v1/strength-plans?kind=scheduled")
  ).json();
  const block = await (
    await page.request.get(
      `/api/v1/time-blocks/${scheduled.items[0].timeBlockId}`,
    )
  ).json();
  expect(Date.parse(block.startsAt)).toBe(Date.parse(reserved.startsAt));
  expect(Date.parse(block.endsAt)).toBe(Date.parse(reserved.endsAt));
  expect(
    (
      await (
        await page.request.get("/api/v1/strength-plans?kind=scheduled")
      ).json()
    ).items,
  ).toHaveLength(1);
});

test("all active workouts are visible and starting another offers resume", async ({
  page,
}) => {
  const { begin } = await fixture(page);
  await begin();
  await begin();
  await page.goto("/fitness");
  await expect(
    page.getByRole("link", { name: "Continue workout", exact: true }),
  ).toHaveCount(2);
  await page
    .getByRole("button", { name: "Start workout", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "You have a workout in progress",
  });
  await expect(
    dialog.getByRole("link", { name: "Continue workout", exact: true }),
  ).toHaveCount(2);
  await dialog
    .getByRole("button", { name: "Start another workout", exact: true })
    .click();
  await expect(page).toHaveURL(/\/fitness\/session\//);
});

test("mixed measurement history is discoverable and forms identify invalid fields", async ({
  page,
}) => {
  const { exercise, plan, write } = await fixture(page);
  const session = await write(
    `/api/v1/strength-plans/${plan.id}/begin`,
    { startedAt: "2026-10-24T10:00:00Z" },
    plan.version,
  );
  const response = await page.request.put(
    `/api/v1/strength-workouts/${session.id}`,
    {
      headers: {
        Origin: "http://localhost:3100",
        "Idempotency-Key": randomUUID(),
        "If-Match": `"${session.version}"`,
      },
      data: {
        title: session.title,
        startedAt: session.startedAt,
        endedAt: "2026-10-24T11:00:00Z",
        exercises: [
          {
            exerciseId: exercise.id,
            loggingType: "reps_duration_load",
            sets: [
              { reps: 12, weightKg: 40, durationSeconds: 60, completed: true },
            ],
          },
        ],
      },
    },
  );
  expect(response.ok()).toBe(true);
  await page.goto(`/fitness/exercises/${exercise.id}`);
  await expect(page.locator(".fitness-recall-section")).toContainText(
    "Test workout",
  );
  await expect(page.locator(".fitness-recall-section")).toContainText("1m");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.goto("/fitness/programs/new");
  await page.getByRole("button", { name: "Save program", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Program name", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("textbox", { name: "Program name", exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByRole("button", { name: "Add workout", exact: true }),
  ).toHaveAttribute("data-invalid", "true");
});

test("failed draft storage protects navigation and live setup errors identify their field", async ({
  page,
}) => {
  const { begin } = await fixture(page);
  const session = await begin();
  await page.goto(`/fitness/session/${session.id}`);
  await expand(page);
  await current(page)
    .getByRole("button", { name: "Edit results", exact: true })
    .click();
  await saved(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("168hours:strength-draft:"))
        throw new Error("Synthetic storage failure");
      return original.call(this, key, value);
    };
  });
  let confirmations = 0;
  page.on("dialog", async (dialog) => {
    confirmations++;
    await dialog.dismiss();
  });
  // Invalid entry prevents autosave, keeping the storage-failure window deterministic.
  await current(page)
    .getByRole("spinbutton", { name: "Actual reps", exact: true })
    .fill("0");
  await page
    .getByRole("navigation", { name: "Fitness views" })
    .getByRole("link", { name: "Training", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(session.id));
  expect(confirmations).toBe(1);
  await current(page)
    .getByRole("spinbutton", { name: "Actual reps", exact: true })
    .fill("9");
  await saved(page);
  await page.getByRole("button", { name: "Edit workout", exact: true }).click();
  const editor = page.getByRole("region", {
    name: "Edit current workout",
    exact: true,
  });
  await editor
    .getByRole("button", { name: "Expand Test bench exercise", exact: true })
    .click();
  await editor
    .getByRole("spinbutton", { name: "Target weight (kg)", exact: true })
    .fill("-5");
  await expect(
    editor
      .getByRole("spinbutton", { name: "Target weight (kg)", exact: true })
      .first(),
  ).toHaveAttribute("aria-invalid", "true");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    editor
      .getByRole("spinbutton", { name: "Target weight (kg)", exact: true })
      .first(),
  ).toBeFocused();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("browser Back retains unsaved results when local storage fails and leaving is declined", async ({
  page,
}) => {
  const { begin } = await fixture(page);
  const session = await begin();
  await page.goto("/fitness");
  await page
    .getByRole("link", { name: "Continue workout", exact: true })
    .click();
  await expand(page);
  await current(page)
    .getByRole("button", { name: "Edit results", exact: true })
    .click();
  await saved(page);
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("168hours:strength-draft:"))
        throw new Error("Synthetic storage failure");
      return original.call(this, key, value);
    };
  });
  let confirmations = 0;
  page.on("dialog", async (dialog) => {
    confirmations++;
    await dialog.dismiss();
  });
  const reps = current(page).getByRole("spinbutton", {
    name: "Actual reps",
    exact: true,
  });
  await reps.fill("0");
  await expect(
    page.getByText(
      "Local draft storage is unavailable. Keep this page open until saving finishes.",
    ),
  ).toBeVisible();
  await page.evaluate(() => history.back());
  await expect.poll(() => confirmations).toBe(1);
  await expect(page).toHaveURL(new RegExp(session.id));
  await expect(reps).toHaveValue("0");
  await reps.fill("9");
  await saved(page);
  await page.evaluate(() => history.back());
  await expect(page).toHaveURL(/\/fitness$/);
});

test("program scheduling recovers its original request and reviewed times after refresh", async ({
  page,
}) => {
  const { plan, write } = await fixture(page);
  const program = await write("/api/v1/training-programs", {
    title: "Test program",
    startDate: "2026-10-26",
    steps: [{ workoutId: plan.id }],
  });
  await page.goto(`/fitness/programs/${program.id}`);
  await page
    .getByRole("button", { name: "Schedule next workout", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Start", { exact: true }).fill("2026-10-27T09:15");
  await dialog.getByLabel("End", { exact: true }).fill("2026-10-27T10:15");
  const endpoint = `**/training-programs/${program.id}/schedule`;
  let key = "";
  await page.route(endpoint, async (route) => {
    key = route.request().headers()["idempotency-key"]!;
    await route.fetch();
    await route.abort("failed");
  });
  await dialog
    .getByRole("button", { name: "Save schedule", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Retry same change", exact: true }),
  ).toBeVisible();
  await page.unroute(endpoint);
  page.on("dialog", (d) => d.accept());
  await page.reload();
  await expect(dialog.getByLabel("Start", { exact: true })).toHaveValue(
    "2026-10-27T09:15",
  );
  let retryKey = "";
  page.on("request", (r) => {
    if (r.url().endsWith(`/training-programs/${program.id}/schedule`))
      retryKey = r.headers()["idempotency-key"]!;
  });
  await dialog
    .getByRole("button", { name: "Retry same change", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  expect(retryKey).toBe(key);
  const updated = await (
    await page.request.get(`/api/v1/training-programs/${program.id}`)
  ).json();
  expect(updated.next.sequence).toBe(0);
  expect(updated.version).toBe(program.version + 1);
});
