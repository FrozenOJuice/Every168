import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("unsaved workout edits recover across navigation and refresh without overwriting newer saves", async ({
  page,
}, testInfo) => {
  const headers = () => ({
    Origin: "http://localhost:3100",
    "Idempotency-Key": randomUUID(),
  });
  expect(
    (
      await page.request.post("/api/auth/sign-up/email", {
        headers: headers(),
        data: {
          name: "Recovery member",
          email: `recovery-${randomUUID()}@example.com`,
          password: "Synthetic-recovery-password-123",
        },
      })
    ).status(),
  ).toBe(200);
  await page.goto("/fitness/workout/new");
  const workspace = page.getByRole("region", {
    name: "Workout workspace",
    includeHidden: true,
  });
  const title = workspace.getByLabel("Workout name", { exact: true });
  await title.fill("Unfinished workout");
  await workspace
    .getByRole("button", { name: "Toggle workout notes", exact: true })
    .click();
  await workspace
    .getByLabel("Workout notes", { exact: true })
    .fill("Keep these unsaved notes");
  if (testInfo.project.name === "phone")
    await page
      .getByRole("button", { name: "Add exercises", exact: true })
      .click();
  const library = page.getByRole("complementary", {
    name: "Exercise library panel",
  });
  const bench = library.getByRole("button", {
    name: "Bench press",
    exact: true,
  });
  if (testInfo.project.name === "desktop") await bench.hover();
  await library
    .getByRole("button", { name: "Add Bench press", exact: true })
    .click();
  if (testInfo.project.name === "phone")
    await page
      .getByRole("button", { name: "Your workout", exact: true })
      .click();
  const reps = workspace.getByLabel("Target reps", { exact: true }).first();
  await reps.fill("0"); // Invalid entries must also survive recovery.
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Calendar", exact: true })
    .click();
  await expect(page).toHaveURL("http://localhost:3100/");
  await page.goBack();
  await expect(title).toHaveValue("Unfinished workout");
  await expect(reps).toHaveValue("0");
  await expect(
    page.locator(".app-toast").getByText("Draft restored", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(title).toHaveValue("Unfinished workout");
  await expect(reps).toHaveValue("0");
  await expect(
    workspace.getByLabel("Workout notes", { exact: true }),
  ).toHaveValue("Keep these unsaved notes");
  expect(
    (await (await page.request.get("/api/v1/strength-plans")).json()).items,
  ).toHaveLength(0);
  await reps.fill("8");
  await workspace
    .getByRole("button", { name: "Save draft", exact: true })
    .click();
  await expect(page).toHaveURL(/\/fitness$/);
  await page.goto("/fitness/workout/new");
  await expect(title).toHaveValue(""); // Successful save clears the new-workout recovery.
  const plans = (
    await (await page.request.get("/api/v1/strength-plans")).json()
  ).items;
  const original = plans[0];
  await page.goto(`/fitness/workout/${original.id}`);
  await title.fill("Recovered edits");
  const update = await page.request.put(
    `/api/v1/strength-plans/${original.id}`,
    {
      headers: { ...headers(), "If-Match": `"${original.version}"` },
      data: {
        title: "Newer saved workout",
        notes: null,
        exercises: original.exercises.map(
          (e: {
            exerciseId: string;
            loggingType: string;
            notes: string | null;
            sets: unknown[];
          }) => ({
            exerciseId: e.exerciseId,
            loggingType: e.loggingType,
            notes: e.notes,
            sets: e.sets,
          }),
        ),
        isDraft: true,
      },
    },
  );
  expect(update.status()).toBe(200);
  await page.reload();
  await expect(title).toHaveValue("Recovered edits");
  await expect(
    workspace.getByRole("button", { name: "Save draft", exact: true }),
  ).toBeDisabled();
  await expect(
    workspace.getByRole("button", { name: "Save workout", exact: true }),
  ).toBeDisabled();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await workspace
    .getByRole("button", { name: "Save as new draft", exact: true })
    .click();
  await expect(page).toHaveURL(/\/fitness$/);
  const after = (
    await (await page.request.get("/api/v1/strength-plans")).json()
  ).items;
  expect(after).toHaveLength(2);
  expect(after.find((p: { id: string }) => p.id === original.id).title).toBe(
    "Newer saved workout",
  );
  expect(after.find((p: { id: string }) => p.id !== original.id).title).toBe(
    "Recovered edits",
  );
  await page.goto(`/fitness/workout/${original.id}`);
  await title.fill("Discard this");
  await page.reload();
  await page
    .locator(".app-toast")
    .getByRole("button", { name: "Discard", exact: true })
    .click();
  await expect(title).toHaveValue("Newer saved workout");
  await title.fill("Deliberate discard");
  await page
    .getByRole("button", { name: "Back to Fitness", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Discard", exact: true })
    .click();
  await expect(page).toHaveURL(/\/fitness$/);
  await page.goto(`/fitness/workout/${original.id}`);
  await expect(title).toHaveValue("Newer saved workout");
  await expect(
    page.locator(".app-toast").getByText("Draft restored", { exact: true }),
  ).toHaveCount(0);
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage blocked", "SecurityError");
    };
  });
  await title.fill("Storage unavailable");
  await expect(workspace.getByRole("alert")).toHaveText(
    "Recovery storage is unavailable. Save draft before leaving.",
  );
});

test("uncertain workout creation and updates retain their original intent across refresh", async ({
  page,
}) => {
  const hydrationErrors: string[] = [];
  page.on("pageerror", (error) => {
    if (
      /hydration|hydrated|server rendered|server-rendered/i.test(error.message)
    )
      hydrationErrors.push(error.message);
  });
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /hydration|hydrated|server rendered|server-rendered/i.test(message.text())
    )
      hydrationErrors.push(message.text());
  });
  const signup = await page.request.post("/api/auth/sign-up/email", {
    headers: {
      Origin: "http://localhost:3100",
      "Idempotency-Key": randomUUID(),
    },
    data: {
      name: "Save recovery",
      email: `save-recovery-${randomUUID()}@example.com`,
      password: "Synthetic-recovery-password-123",
    },
  });
  expect(signup.ok()).toBe(true);
  page.on("dialog", (dialog) => dialog.accept());
  const attempts: {
    method: string;
    key: string;
    body: string;
    version?: string;
  }[] = [];
  let loseNextResponse = true;
  await page.route("**/api/v1/strength-plans{,/*}", async (route) => {
    const request = route.request();
    if (!["POST", "PUT"].includes(request.method())) return route.continue();
    attempts.push({
      method: request.method(),
      key: request.headers()["idempotency-key"]!,
      body: request.postData()!,
      version: request.headers()["if-match"],
    });
    if (loseNextResponse) {
      loseNextResponse = false;
      expect((await route.fetch()).ok()).toBe(true);
      return route.abort("failed");
    }
    return route.continue();
  });
  await page.goto("/fitness/workout/new");
  await page
    .getByLabel("Workout name", { exact: true })
    .fill("Recovered save intent");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Retry same change", exact: true }),
  ).toBeVisible();
  const firstSaved = (
    await (await page.request.get("/api/v1/strength-plans")).json()
  ).items;
  expect(firstSaved).toHaveLength(1);
  await page.reload();
  await expect(page.getByLabel("Workout name", { exact: true })).toHaveValue(
    "Recovered save intent",
  );
  await expect(
    page.getByRole("button", { name: "Save draft", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Retry same change", exact: true })
    .click();
  await expect(page).toHaveURL(/\/fitness$/);
  expect(attempts).toHaveLength(2);
  expect(attempts[1]).toEqual(attempts[0]);
  expect(
    (await (await page.request.get("/api/v1/strength-plans")).json()).items,
  ).toHaveLength(1);

  const original = firstSaved[0];
  await page.goto(`/fitness/workout/${original.id}`);
  await page
    .getByLabel("Workout name", { exact: true })
    .fill("Updated recovered workout");
  loseNextResponse = true;
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Retry same change", exact: true }),
  ).toBeVisible();
  const committed = await (
    await page.request.get(`/api/v1/strength-plans/${original.id}`)
  ).json();
  expect(committed.version).toBe(original.version + 1);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Save draft", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Retry same change", exact: true })
    .click();
  await expect(page).toHaveURL(/\/fitness$/);
  expect(attempts).toHaveLength(4);
  expect(attempts[3]).toEqual(attempts[2]);
  expect(
    await (
      await page.request.get(`/api/v1/strength-plans/${original.id}`)
    ).json(),
  ).toEqual(committed);
  expect(
    (await (await page.request.get("/api/v1/strength-plans")).json()).items,
  ).toHaveLength(1);
  expect(hydrationErrors).toEqual([]);
});
