import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("first release exposes Calendar and Fitness without deferred entry points", async ({
  page,
}, info) => {
  test.skip(
    info.config.metadata.releaseScope !== "core",
    "Run with playwright.release.config.ts for the first-release boundary.",
  );
  const signup = await page.request.post("/api/__test/register", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      name: "Release scope",
      email: `release-${randomUUID()}@example.com`,
      password: "Synthetic-release-password-123",
    },
  });
  expect(signup.ok()).toBe(true);
  await page.goto("/?date=2026-10-27&view=day");
  const navigation = page.getByRole("navigation", {
    name: "Main navigation",
    exact: true,
  });
  await expect(navigation.getByRole("link")).toHaveText([
    "Calendar",
    "Fitness",
  ]);
  await expect(page.locator(".assistant-launcher")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /^Quick actions on/ }),
  ).toHaveCount(0);
  await page
    .locator(".calendar-toolbar")
    .getByRole("button", { name: "Actions", exact: true })
    .click();
  await expect(
    page.getByRole("menuitem", { name: "Calendar tools…", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("menuitem", { name: /Quick actions/ }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("menuitem", { name: "Templates…", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await navigation.getByRole("link", { name: "Fitness", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "My workouts", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Training programs", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Create program", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Exercise library", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Fitness views", exact: true })
    .getByRole("link", { name: "Exercises", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Exercise library", exact: true }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("release-navigation.png"),
    fullPage: true,
  });
  for (const path of [
    "/food",
    "/food?view=recipe",
    "/assistant",
    "/goals",
    "/routines",
    "/unscheduled",
    "/tasks",
    `/tasks?task=${randomUUID()}`,
    `/tasks?view=projects&project=${randomUUID()}`,
    "/fitness/programs",
    "/fitness/programs/new",
    `/fitness/programs/${randomUUID()}`,
    `/fitness/programs/${randomUUID()}/edit`,
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "404", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".assistant-launcher")).toHaveCount(0);
  }
  for (const path of [
    "foods",
    "food-entries",
    "water-entries",
    "weight-entries",
    "dashboard",
    "tasks?date=2026-10-27&view=all",
    "task-projects",
    `tasks/${randomUUID()}`,
    "goals",
    "routines",
    "calendar/backlog",
    "calendar/search?kind=unscheduled",
    "cardio-activities",
    "calendar/templates",
    `calendar/templates/${randomUUID()}/preview?targetDate=2026-10-27`,
    "training-programs",
    `training-program-for-session/${randomUUID()}`,
  ]) {
    expect((await page.request.get(`/api/v1/${path}`)).status()).toBe(404);
  }
});

test("My workouts fills responsive rows and paginates a shorter phone list", async ({
  page,
}, info) => {
  test.skip(
    info.config.metadata.releaseScope !== "core",
    "Use the release config.",
  );
  const post = async (path: string, data: object) => {
    const response = await page.request.post(path, {
      headers: {
        Origin: "http://localhost:3100",
        "Idempotency-Key": randomUUID(),
      },
      data,
    });
    expect(response.ok()).toBe(true);
    return response.json();
  };
  await post("/api/__test/register", {
    name: "Workout layout",
    email: `workout-layout-${randomUUID()}@example.com`,
    password: "Synthetic-layout-password-123",
  });
  const exercise = await post("/api/v1/exercises", {
    name: "Review squat",
    loggingType: "reps",
  });
  for (let index = 0; index < 7; index++)
    await post("/api/v1/strength-plans", {
      title: `Layout workout ${index}`,
      isDraft: index === 6,
      exercises:
        index === 6
          ? []
          : [{ exerciseId: exercise.id, sets: [{ targetReps: 8 }] }],
    });
  await page.goto("/fitness");
  const cards = page.locator("#my-workouts .fitness-workout-card");
  await expect(cards).toHaveCount(
    (page.viewportSize()?.width ?? 1280) <= 900 ? 4 : 6,
  );
  const grid = await page.locator("#my-workouts .fitness-cards").boundingBox();
  const first = await cards.nth(0).boundingBox();
  const second = await cards.nth(1).boundingBox();
  expect(grid).not.toBeNull();
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  if (info.project.name === "phone") {
    expect(Math.abs(first!.width - grid!.width)).toBeLessThan(1);
    expect(second!.y).toBeGreaterThan(first!.y);
  } else {
    expect(Math.abs(first!.width - second!.width)).toBeLessThan(1);
    expect(Math.abs(first!.height - second!.height)).toBeLessThan(1);
    expect(Math.abs(first!.y - second!.y)).toBeLessThan(1);
    expect(first!.width).toBeLessThan(340);
    expect(second!.x).toBeGreaterThan(first!.x);
  }
  if (info.project.name === "desktop") {
    for (const width of [1600, 1400, 1280, 1160, 1100, 901, 900, 700]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(cards).toHaveCount(width <= 900 ? 4 : 6);
      const bounds = await page
        .locator("#my-workouts .fitness-cards")
        .boundingBox();
      const boxes = await cards.evaluateAll((elements) =>
        elements.map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            x: rect.x,
            y: rect.y,
            right: rect.right,
            width: rect.width,
            height: rect.height,
          };
        }),
      );
      const row = boxes.filter((box) => Math.abs(box.y - boxes[0]!.y) < 1);
      expect(
        Math.abs(row.at(-1)!.right - bounds!.x - bounds!.width),
      ).toBeLessThan(1);
      expect(
        row.every(
          (box) =>
            Math.abs(box.width - row[0]!.width) < 1 &&
            Math.abs(box.height - row[0]!.height) < 1,
        ),
      ).toBe(true);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(cards).toHaveCount(6);
  }
  await page
    .getByRole("button", { name: "Load more workouts", exact: true })
    .click();
  await expect(cards).toHaveCount(7);
  await expect(
    page.getByRole("button", { name: "Load more workouts", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("searchbox", { name: "Search workouts", exact: true })
    .fill("Layout workout 0");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("Layout workout 0");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("core Calendar never requests deferred Task actions for retained plans or recorded time", async ({
  page,
}, info) => {
  test.skip(
    info.config.metadata.releaseScope !== "core",
    "Use the release config.",
  );
  const signup = await page.request.post("/api/__test/register", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      name: "Retained Calendar",
      email: `retained-calendar-${randomUUID()}@example.com`,
      password: "Synthetic-calendar-password-123",
    },
  });
  expect(signup.ok()).toBe(true);
  const post = async (path: string, data: object) => {
    const response = await page.request.post(`/api/v1/${path}`, {
      headers: {
        Origin: "http://localhost:3100",
        "Idempotency-Key": randomUUID(),
      },
      data,
    });
    expect(response.ok()).toBe(true);
    return response.json();
  };
  const block = await post("time-blocks", {
    title: "Retained plan",
    startsAt: "2026-10-27T12:00:00Z",
    endsAt: "2026-10-27T13:00:00Z",
  });
  const entry = await post("time-entries", {
    title: "Retained actual work",
    startsAt: "2026-10-27T12:00:00Z",
    endsAt: "2026-10-27T13:00:00Z",
    timeBlockId: block.id,
  });
  // Exercise the retained task-time UI shape; real retained data and accounting
  // are covered by the core/preview PostgreSQL boundary test.
  await page.route("**/api/v1/weeks/**", async (route) => {
    const response = await route.fetch();
    const week = await response.json();
    week.entries = week.entries.map((row: { id: string }) =>
      row.id === entry.id
        ? { ...row, sourceType: "task_time", sourceId: randomUUID() }
        : row,
    );
    await route.fulfill({ response, json: week });
  });
  const taskRequests: string[] = [];
  page.on("request", (request) => {
    if (
      /\/api\/v1\/(tasks|task-projects|task-times|task-schedules)([/?]|$)/.test(
        new URL(request.url()).pathname,
      )
    )
      taskRequests.push(new URL(request.url()).pathname);
  });
  await page.goto("/?date=2026-10-27&view=day");
  const grid = page.getByRole("region", {
    name: "Daily time grid",
    exact: true,
  });
  await grid
    .getByRole("button", { name: /Retained actual work.*recorded/ })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(
    "Its editing workspace is not available yet.",
  );
  await expect(
    dialog.getByRole("link", { name: "Open task", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await grid.getByRole("button", { name: /Retained plan.*planned/ }).dblclick();
  await expect(
    page.getByRole("dialog", { name: "Edit plan", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Could not load task link.", { exact: false }),
  ).toHaveCount(0);
  expect(taskRequests).toEqual([]);
});
