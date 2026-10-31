import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.use({ actionTimeout: 10000 });
async function setup(page: Page) {
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
    name: "Secondary actions",
    email: `secondary-${randomUUID()}@example.com`,
    password: "Synthetic-secondary-password-123",
  });
  return write;
}
async function action(page: Page, name: string) {
  await page
    .getByRole("button", { name: "Exercise actions", exact: true })
    .click();
  await page.getByRole("menuitem", { name, exact: true }).click();
}
test("duplicate is an unsaved creation, cancel creates nothing and uncertain creation recovers exactly once", async ({
  page,
}) => {
  const write = await setup(page);
  const original = await write("/api/v1/exercises", {
    name: "Copy movement",
    notes: "Keep these instructions.",
    equipment: ["Barbell"],
    muscles: ["Chest"],
    loggingType: "reps_load",
    favourite: true,
  });
  await page.goto(`/fitness/exercises/${original.id}`);
  await action(page, "Duplicate exercise");
  await expect(
    page.getByRole("heading", { name: "Create exercise", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Exercise name", { exact: true })).toHaveValue(
    "Copy movement (copy)",
  );
  await expect(
    page.getByRole("button", { name: "Favourite", exact: true }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(
    (
      await (
        await page.request.get("/api/v1/exercises?search=Copy%20movement")
      ).json()
    ).items,
  ).toHaveLength(1);
  await action(page, "Duplicate exercise");
  await page
    .getByLabel("Exercise name", { exact: true })
    .fill("Confirmed movement copy");
  let key = "";
  await page.route("**/api/v1/exercises", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    key = route.request().headers()["idempotency-key"]!;
    await route.fetch();
    await route.abort("failed");
  });
  await page
    .getByRole("button", { name: "Create exercise", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Retry same change", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Exercise name", { exact: true })).toHaveValue(
    "Confirmed movement copy",
  );
  await page.unroute("**/api/v1/exercises");
  const retry = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      request.url().endsWith("/api/v1/exercises"),
  );
  await page
    .getByRole("button", { name: "Retry same change", exact: true })
    .click();
  expect((await retry).headers()["idempotency-key"]).toBe(key);
  await expect(
    page.getByRole("heading", { name: "Confirmed movement copy", exact: true }),
  ).toBeVisible();
  const copies = (
    await (
      await page.request.get(
        "/api/v1/exercises?search=Confirmed%20movement%20copy",
      )
    ).json()
  ).items;
  expect(copies).toHaveLength(1);
  expect(copies[0].notes).toBe(original.notes);
  expect(copies[0].favourite).toBe(false);
  await page.goto("/fitness/exercises/catalog/barbell-bench-press");
  await action(page, "Duplicate exercise");
  await expect(page.getByLabel("Exercise name", { exact: true })).toHaveValue(
    "Bench press (copy)",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Bench press", exact: true }),
  ).toBeVisible();
});
test("visibility actions give reversible feedback and pending actions protect navigation", async ({
  page,
}) => {
  const write = await setup(page);
  const exercise = await write("/api/v1/exercises", {
    name: "Visibility movement",
  });
  await page.goto(`/fitness/exercises/${exercise.id}`);
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`**/exercises/${exercise.id}/archive`, async (route) => {
    await held;
    await route.continue();
  });
  const request = page.waitForRequest((request) =>
    request.url().endsWith(`/exercises/${exercise.id}/archive`),
  );
  await action(page, "Archive exercise");
  await request;
  await page
    .getByRole("navigation", { name: "Fitness views" })
    .getByRole("link", { name: "Training", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/exercises/${exercise.id}$`));
  await expect(
    page.getByRole("button", { name: "Back to Exercises", exact: true }),
  ).toBeDisabled();
  release();
  const toast = page.locator(".app-toast");
  await expect(toast).toContainText("Visibility movement archived.");
  await page.unroute(`**/exercises/${exercise.id}/archive`);
  await toast.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(toast).toContainText("Visibility movement restored.");
  expect(
    (await (await page.request.get(`/api/v1/exercises/${exercise.id}`)).json())
      .archivedAt,
  ).toBeNull();
  await page.goto("/fitness/exercises/catalog/barbell-bench-press");
  await action(page, "Hide from library");
  await expect(toast).toContainText("Bench press hidden from library.");
  await toast.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(toast).toContainText("Bench press shown in library.");
  await expect(
    toast.getByRole("button", { name: "Undo", exact: true }),
  ).toBeEnabled();
  await toast.evaluate(async (node) => {
    await Promise.all(
      node.getAnimations().map((animation) => animation.finished),
    );
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("used exercise deletion explains archive, unused deletion and reusable-workout deletion return correctly", async ({
  page,
}) => {
  const write = await setup(page);
  const used = await write("/api/v1/exercises", {
    name: "Referenced movement",
  });
  const plan = await write("/api/v1/strength-plans", {
    title: "Secondary plan",
    isDraft: false,
    exercises: [{ exerciseId: used.id, sets: [{ targetReps: 10 }] }],
  });
  await page.goto(`/fitness/exercises/${used.id}`);
  await page
    .getByRole("button", { name: "Exercise actions", exact: true })
    .click();
  const unavailable = page.getByRole("menuitem", { name: /Delete exercise/ });
  await expect(unavailable).toBeDisabled();
  await expect(unavailable).toContainText(
    "Used in workouts or history. Archive it instead.",
  );
  await page.keyboard.press("Escape");
  const unused = await write("/api/v1/exercises", { name: "Unused movement" });
  await page.goto(`/fitness/exercises/${unused.id}`);
  await action(page, "Delete exercise");
  const confirm = page.getByRole("dialog", {
    name: "Delete exercise?",
    exact: true,
  });
  await confirm.getByRole("button", { name: "Cancel", exact: true }).click();
  await action(page, "Delete exercise");
  await confirm
    .getByRole("button", { name: "Delete exercise", exact: true })
    .click();
  await expect(page).toHaveURL(/\/fitness\/exercises$/);
  expect(
    (await page.request.get(`/api/v1/exercises/${unused.id}`)).status(),
  ).toBe(404);
  await page.goto(`/fitness/workout/${plan.id}`);
  await page
    .getByRole("button", { name: "Workout actions", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Delete reusable workout", exact: true })
    .click();
  const deletion = page.getByRole("dialog", {
    name: "Delete reusable workout?",
    exact: true,
  });
  await expect(deletion).toContainText(
    "Scheduled workouts and recorded results will stay.",
  );
  await deletion
    .getByRole("button", { name: "Delete reusable workout", exact: true })
    .click();
  await expect(page).toHaveURL(/\/fitness$/);
  expect(
    (await page.request.get(`/api/v1/exercises/${used.id}`)).status(),
  ).toBe(200);
});

test("saving a session as a new workout names the reusable destination and leaves the session intact", async ({
  page,
}) => {
  const write = await setup(page);
  const exercise = await write("/api/v1/exercises", { name: "Reuse movement" });
  const created = await write("/api/v1/strength-workouts", {
    title: "Reusable session",
    startedAt: "2026-10-27T12:00:00Z",
  });
  const session = await write(
    `/api/v1/strength-workouts/${created.id}`,
    {
      title: created.title,
      startedAt: created.startedAt,
      endedAt: "2026-10-27T13:00:00Z",
      exercises: [
        {
          exerciseId: exercise.id,
          sets: [{ targetReps: 10, reps: 12, completed: true }],
        },
      ],
    },
    created.version,
  );
  await page.goto(`/fitness/session/${session.id}`);
  const copy = page.getByRole("button", {
    name: "Save as new workout",
    exact: true,
  });
  await copy.click();
  const toast = page.locator(".app-toast");
  await expect(toast).toContainText("Saved “Reusable session” to My workouts.");
  await expect(copy).toBeDisabled();
  const plans = (
    await (await page.request.get("/api/v1/strength-plans?kind=workout")).json()
  ).items;
  expect(plans).toHaveLength(1);
  expect(plans[0].title).toBe(session.title);
  expect(plans[0].exercises[0].sets[0].targetReps).toBe(10);
  expect(
    (
      await (
        await page.request.get(`/api/v1/strength-workouts/${session.id}`)
      ).json()
    ).version,
  ).toBe(session.version);
});
