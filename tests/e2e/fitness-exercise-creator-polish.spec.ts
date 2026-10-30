import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.use({ actionTimeout: 10000 });
async function signup(page: Page) {
  const response = await page.request.post("/api/auth/sign-up/email", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      name: "Exercise creator",
      email: `exercise-creator-${randomUUID()}@example.com`,
      password: "Synthetic-creator-password-123",
    },
  });
  expect(response.ok()).toBe(true);
}
const creator = (page: Page) =>
  page.getByRole("region", { name: "Create exercise", exact: true });
const toast = (page: Page, text: string) =>
  page.getByRole("status").filter({ hasText: text });

test("creator explains fields, shares discard confirmation and recovers an uncertain creation", async ({
  page,
}, info) => {
  await signup(page);
  if (info.project.name === "phone")
    await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/fitness/exercises");
  await page
    .locator("#exercises")
    .getByRole("button", { name: "Create exercise", exact: true })
    .click();
  const form = creator(page);
  await expect(form.getByLabel("Exercise name", { exact: true })).toBeFocused();
  await expect(
    form.getByText("Equipment (optional)", { exact: true }),
  ).toBeVisible();
  await expect(
    form.getByText("Muscles worked (optional)", { exact: true }),
  ).toBeVisible();
  await expect(
    form.getByText(/Choose what you’ll track for each set/),
  ).toBeVisible();
  const measurements = form.getByRole("group", {
    name: "Measurements",
    exact: true,
  });
  await measurements
    .getByRole("checkbox", { name: "Weight", exact: true })
    .uncheck();
  await expect(
    measurements.getByRole("checkbox", { name: "Reps", exact: true }),
  ).toBeDisabled();
  await form
    .getByRole("button", { name: "Create exercise", exact: true })
    .click();
  await expect(form.getByLabel("Exercise name", { exact: true })).toBeFocused();
  await expect(
    form.getByText("Enter an exercise name.", { exact: true }),
  ).toBeVisible();
  await form
    .getByLabel("Exercise name", { exact: true })
    .fill("Recovered movement");
  await form.getByRole("button", { name: "Cancel", exact: true }).click();
  const discard = page.getByRole("dialog", {
    name: "Discard exercise changes?",
    exact: true,
  });
  await expect(
    discard.getByRole("button", { name: "Discard changes", exact: true }),
  ).toHaveClass(/danger/);
  await discard
    .getByRole("button", { name: "Keep editing", exact: true })
    .click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: info.outputPath("exercise-creator.png") });
  const keys: string[] = [];
  const bodies: string[] = [];
  await page.route("**/api/v1/exercises", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    keys.push(route.request().headers()["idempotency-key"]!);
    bodies.push(route.request().postData()!);
    if (keys.length === 1) {
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await form
    .getByRole("button", { name: "Create exercise", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Retry same change", exact: true }),
  ).toBeVisible();
  await expect(
    form.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Calendar", exact: true })
    .click();
  await expect(page).toHaveURL(/\/fitness\/exercises$/);
  await page.reload();
  await expect(form.getByLabel("Exercise name", { exact: true })).toHaveValue(
    "Recovered movement",
  );
  await expect(
    form.getByRole("button", { name: "Awaiting confirmation…", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Retry same change", exact: true })
    .click();
  await expect(toast(page, "Exercise created.")).toBeVisible();
  expect(keys).toHaveLength(2);
  expect(new Set(keys).size).toBe(1);
  expect(bodies[1]).toBe(bodies[0]);
  const rows = await (
    await page.request.get("/api/v1/exercises?search=Recovered%20movement")
  ).json();
  expect(rows.items).toHaveLength(1);
  expect(rows.items[0].loggingType).toBe("reps");
  expect(
    await page.evaluate(() =>
      Object.keys(sessionStorage).some((key) =>
        key.startsWith("168hours:exercise-editor:"),
      ),
    ),
  ).toBe(false);
});

test("exercise editing retries the original revision after refresh", async ({
  page,
}) => {
  await signup(page);
  const response = await page.request.post("/api/v1/exercises", {
    headers: {
      Origin: "http://localhost:3100",
      "Idempotency-Key": randomUUID(),
    },
    data: {
      name: "Original movement",
      loggingType: "reps",
      intentTags: ["technique"],
    },
  });
  expect(response.ok()).toBe(true);
  const original = await response.json();
  await page.goto(`/fitness/exercises/${original.id}`);
  await page
    .getByRole("button", { name: "Exercise actions", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Edit exercise", exact: true })
    .click();
  await page
    .getByLabel("Exercise name", { exact: true })
    .fill("Updated movement");
  const attempts: { key: string; version: string; body: string }[] = [];
  let committedVersion: number | undefined;
  await page.route(`**/api/v1/exercises/${original.id}`, async (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    const headers = route.request().headers();
    attempts.push({
      key: headers["idempotency-key"]!,
      version: headers["if-match"]!,
      body: route.request().postData()!,
    });
    if (attempts.length === 1) {
      committedVersion = (await (await route.fetch()).json()).version;
      await route.abort("failed");
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Retry same change", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Exercise name", { exact: true })).toHaveValue(
    "Updated movement",
  );
  await page
    .getByRole("button", { name: "Retry same change", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Updated movement", exact: true }),
  ).toBeVisible();
  expect(attempts).toHaveLength(2);
  expect(attempts[1]).toEqual(attempts[0]);
  expect(attempts[0]!.version).toBe(`"${original.version}"`);
  const saved = await (
    await page.request.get(`/api/v1/exercises/${original.id}`)
  ).json();
  expect(committedVersion).toBeGreaterThan(original.version);
  expect(saved.version).toBe(committedVersion);
  expect(saved.intentTags).toEqual(["technique"]);
});

test("creation inside a workout confirms addition and retains the workout", async ({
  page,
}, info) => {
  await signup(page);
  await page.goto("/fitness/workout/new");
  await page
    .getByLabel("Workout name", { exact: true })
    .fill("My retained workout");
  if (info.project.name === "phone")
    await page
      .getByRole("button", { name: "Add exercises", exact: true })
      .click();
  await page
    .locator("#exercises")
    .getByRole("button", { name: "Create exercise", exact: true })
    .click();
  await creator(page)
    .getByLabel("Exercise name", { exact: true })
    .fill("Workout movement");
  const keys: string[] = [];
  await page.route("**/api/v1/exercises", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    keys.push(route.request().headers()["idempotency-key"]!);
    if (keys.length === 1) {
      await route.fetch();
      await route.abort("failed");
    } else await route.continue();
  });
  await creator(page)
    .getByRole("button", { name: "Create and add to workout", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Retry same change", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    creator(page).getByLabel("Exercise name", { exact: true }),
  ).toHaveValue("Workout movement");
  await page
    .getByRole("button", { name: "Retry same change", exact: true })
    .click();
  expect(keys).toHaveLength(2);
  expect(new Set(keys).size).toBe(1);
  await expect(toast(page, "Created and added to workout.")).toBeVisible();
  await expect(page.getByLabel("Workout name", { exact: true })).toHaveValue(
    "My retained workout",
  );
  await expect(
    page
      .getByRole("region", { name: "Workout exercises", exact: true })
      .getByRole("heading", { name: "Workout movement", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save workout", exact: true }).click();
  await expect(page).toHaveURL(/\/fitness$/);
  const saved = await (
    await page.request.get(
      "/api/v1/strength-plans?search=My%20retained%20workout",
    )
  ).json();
  expect(saved.items).toHaveLength(1);
  const plan = await (
    await page.request.get(`/api/v1/strength-plans/${saved.items[0].id}`)
  ).json();
  expect(plan.exercises).toHaveLength(1);
  expect(plan.exercises[0].name).toBe("Workout movement");
});
