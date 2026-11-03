import { foodView as view } from "./helpers/food-navigation";
import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.use({ actionTimeout: 10000 });
async function setup(page: Page) {
  const email = `food-reliability-${randomUUID()}@example.com`;
  const password = "Synthetic-food-reliability-password-123";
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
    name: "Food reliability",
    email,
    password,
  });
  const me = await (await page.request.get("/api/v1/me")).json();
  await write(
    "/api/v1/preferences",
    { timezone: "UTC", weekStartsOn: 1, weightUnit: "kg", distanceUnit: "km" },
    me.preferences.version,
  );
  await page.goto("/food?view=food&date=2026-10-23");
  return { write, me, email, password };
}
const dialog = (page: Page) => page.getByRole("dialog");
test("committed food create recovers its original key after refresh and stays isolated across accounts", async ({
  page,
}, info) => {
  const { write, email, password } = await setup(page);
  const keys: string[] = [];
  let lose = true;
  await page.route("**/api/v1/foods", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    keys.push(route.request().headers()["idempotency-key"]!);
    const response = await route.fetch();
    expect(response.status()).toBe(201);
    if (lose) {
      lose = false;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "UNAVAILABLE", message: "Response lost after commit" },
        }),
      });
    } else await route.fulfill({ response });
  });
  await page.getByRole("button", { name: "Create food", exact: true }).click();
  await dialog(page)
    .getByLabel("Food name", { exact: true })
    .fill("Recovered oats");
  await dialog(page)
    .getByRole("button", { name: "Create food", exact: true })
    .click();
  await expect(
    dialog(page).getByRole("button", { name: "Retry save", exact: true }),
  ).toBeVisible();
  await expect(
    dialog(page).getByRole("button", { name: "Close dialog", exact: true }),
  ).toBeDisabled();
  await page.reload();
  await expect(
    page.getByRole("alert", { name: "Food save recovery" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create food", exact: true }),
  ).toBeDisabled();
  await page.screenshot({
    path: info.outputPath("food-recovery.png"),
    fullPage: true,
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  // A new account cannot see or replay the first account's retained receipt.
  await write("/api/__test/register", {
    name: "Other Food account",
    email: `other-food-${randomUUID()}@example.com`,
    password,
  });
  await page.goto("/food?view=food&date=2026-10-23");
  await expect(
    page.getByRole("button", { name: "Create food", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("alert", { name: "Food save recovery" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Recovered oats", exact: true }),
  ).toHaveCount(0);
  const login = await page.request.post("/api/auth/sign-in/email", {
    headers: { Origin: "http://localhost:3100" },
    data: { email, password },
  });
  expect(login.ok()).toBe(true);
  await page.goto("/food?view=food&date=2026-10-23");
  await page
    .getByRole("button", { name: "Retry saved change", exact: true })
    .click();
  await expect(
    page.getByRole("alert", { name: "Food save recovery" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Recovered oats", exact: true }),
  ).toHaveCount(1);
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  expect(
    (await (await page.request.get("/api/v1/foods?search=Recovered")).json())
      .items,
  ).toHaveLength(1);
  await expect(page).toHaveTitle("Every168");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
test("inline water saves block navigation and replay the original amount and timestamp after refresh", async ({
  page,
}) => {
  await setup(page);
  await view(page, "Today");
  const attempts: { key: string; body: string | null }[] = [];
  let lose = true;
  await page.route("**/api/v1/water-entries", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    attempts.push({
      key: route.request().headers()["idempotency-key"]!,
      body: route.request().postData(),
    });
    const response = await route.fetch();
    if (lose) {
      lose = false;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "UNAVAILABLE", message: "Response lost" },
        }),
      });
    } else await route.fulfill({ response });
  });
  await page.getByRole("button", { name: "+ 250 ml", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Retry same change", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Log weight", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Water history", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Fitness", exact: true })
    .click();
  await expect(page).toHaveURL(/\/food\?/);
  await page.reload();
  await page
    .getByRole("button", { name: "Retry saved change", exact: true })
    .click();
  await expect(page.locator(".food-water .measurement-total")).toContainText(
    "250 ml",
  );
  await expect.poll(() => attempts.length).toBe(2);
  await expect(
    page.getByRole("alert", { name: "Food save recovery" }),
  ).toHaveCount(0);
  expect(attempts[0]).toEqual(attempts[1]);
  expect(
    (await (await page.request.get("/api/v1/water-entries")).json()).items,
  ).toHaveLength(1);
});
test("unavailable receipt storage prevents a save until same-key retry can retain it", async ({
  page,
}) => {
  await setup(page);
  let writes = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/api/v1/foods") && request.method() === "POST")
      writes++;
  });
  await page.getByRole("button", { name: "Create food", exact: true }).click();
  await dialog(page)
    .getByLabel("Food name", { exact: true })
    .fill("Storage-safe food");
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Object.defineProperty(window, "__restoreFoodStorage", {
      configurable: true,
      value: () => {
        Storage.prototype.setItem = original;
      },
    });
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("168hours:food-write:"))
        throw new Error("Recovery storage unavailable");
      return original.call(this, key, value);
    };
  });
  await dialog(page)
    .getByRole("button", { name: "Create food", exact: true })
    .click();
  await expect(
    dialog(page).getByRole("button", { name: "Retry save", exact: true }),
  ).toBeVisible();
  expect(writes).toBe(0);
  await page.evaluate(() =>
    (
      window as unknown as { __restoreFoodStorage: () => void }
    ).__restoreFoodStorage(),
  );
  await dialog(page)
    .getByRole("button", { name: "Retry save", exact: true })
    .click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Storage-safe food", exact: true }),
  ).toBeVisible();
  expect(writes).toBe(1);
});
test("food library and history retain loaded rows when a later page fails", async ({
  page,
}) => {
  const { write } = await setup(page);
  const foods = [];
  for (let index = 0; index < 25; index++)
    foods.push(
      await write("/api/v1/foods", {
        name: `Paged food ${index}`,
        servingAmount: 1,
        servingUnit: "serving",
      }),
    );
  await page.reload();
  const cards = page.locator(".food-library-grid article");
  await expect(cards).toHaveCount(20);
  let fail = true;
  await page.route("**/api/v1/foods?**", async (route) => {
    if (fail && new URL(route.request().url()).searchParams.has("cursor"))
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "UNAVAILABLE", message: "Page unavailable" },
        }),
      });
    else await route.continue();
  });
  await page.getByRole("button", { name: "Load more", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Retry loading foods", exact: true }),
  ).toBeVisible();
  await expect(cards).toHaveCount(20);
  fail = false;
  await page
    .getByRole("button", { name: "Retry loading foods", exact: true })
    .click();
  await expect(cards).toHaveCount(25);
  for (let index = 0; index < 25; index++)
    await write("/api/v1/food-entries", {
      foodId: foods[0].id,
      quantity: 1,
      consumedAt: "2026-10-23T12:00:00Z",
    });
  await view(page, "Search past entries");
  const entries = page.locator(".food-entry-list > li");
  await expect(entries).toHaveCount(20);
  fail = true;
  await page.route("**/api/v1/food-entries?**", async (route) => {
    if (fail && new URL(route.request().url()).searchParams.has("cursor"))
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "UNAVAILABLE", message: "Page unavailable" },
        }),
      });
    else await route.continue();
  });
  await page
    .getByRole("button", { name: "Older entries", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Retry loading food history",
      exact: true,
    }),
  ).toBeVisible();
  await expect(entries).toHaveCount(20);
  fail = false;
  await page
    .getByRole("button", { name: "Retry loading food history", exact: true })
    .click();
  await expect(entries).toHaveCount(25);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("definition, preparation, copied-entry and weight changes recover once with their original revisions", async ({
  page,
}) => {
  const { write, me } = await setup(page);
  const food = await write("/api/v1/foods", {
    name: "Recovery rice",
    servingAmount: 100,
    servingUnit: "g",
    calories: 100,
  });
  const recipe = await write("/api/v1/food-preparations", {
    name: "Recovery pot",
    kind: "recipe",
    ingredients: [{ foodId: food.id, quantity: 2 }],
    yieldServings: 2,
  });
  await write("/api/v1/food-entries", {
    foodId: food.id,
    quantity: 1,
    consumedAt: "2026-10-23T12:00:00Z",
  });
  await write("/api/v1/weight-entries", {
    weightKg: 75,
    measuredAt: "2026-10-23T12:00:00Z",
  });
  const attempts = new Map<
    string,
    {
      path: string;
      method: string;
      body: string | null;
      revision: string | undefined;
    }[]
  >();
  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    if (!["POST", "PUT", "DELETE"].includes(request.method()))
      return route.continue();
    const key = request.headers()["idempotency-key"]!;
    const rows = attempts.get(key) ?? [];
    rows.push({
      path: new URL(request.url()).pathname,
      method: request.method(),
      body: request.postData(),
      revision: request.headers()["if-match"],
    });
    attempts.set(key, rows);
    const response = await route.fetch();
    expect(response.ok(), await response.text()).toBe(true);
    if (rows.length === 1)
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "UNAVAILABLE", message: "Committed response lost" },
        }),
      });
    else await route.fulfill({ response });
  });
  const recover = async (action: () => Promise<unknown>) => {
    await action();
    await expect
      .poll(() =>
        page.evaluate(
          (owner) => sessionStorage.getItem(`168hours:food-write:v1:${owner}`),
          me.user.id,
        ),
      )
      .toBeTruthy();
    // Wait for the response to become uncertain before replacing the document.
    await expect(
      page
        .getByRole("button", {
          name: /^(Retry save|Retry same change|Retry saved change)$/,
        })
        .first(),
    ).toBeVisible();
    await page.reload();
    await page
      .getByRole("button", { name: "Retry saved change", exact: true })
      .click();
    await expect(
      page.getByRole("alert", { name: "Food save recovery" }),
    ).toHaveCount(0);
  };
  const card = (name: string) =>
    page
      .locator(".food-library-grid article")
      .filter({ has: page.getByRole("heading", { name, exact: true }) });
  await page.reload();
  await card("Recovery rice")
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await dialog(page).getByLabel("Calories (kcal)", { exact: true }).fill("200");
  await recover(() =>
    dialog(page)
      .getByRole("button", { name: "Save food", exact: true })
      .click(),
  );
  await expect(card("Recovery rice")).toContainText("200 kcal");
  await recover(() =>
    page
      .getByRole("button", { name: "Favourite Recovery rice", exact: true })
      .click(),
  );
  await expect(
    page.getByRole("button", { name: "Favourite Recovery rice", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await recover(() =>
    card("Recovery rice")
      .getByRole("button", { name: "Archive", exact: true })
      .click(),
  );
  await page.getByRole("button", { name: "Archived", exact: true }).click();
  await recover(() =>
    card("Recovery rice")
      .getByRole("button", { name: "Restore", exact: true })
      .click(),
  );
  await view(page, "Recipes");
  await card("Recovery pot")
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await dialog(page)
    .getByLabel("Recipe yield (portions)", { exact: true })
    .fill("4");
  await recover(() =>
    dialog(page)
      .getByRole("button", { name: "Save changes", exact: true })
      .click(),
  );
  expect(
    (await (await page.request.get(`/api/v1/foods/${recipe.id}`)).json())
      .yieldServings,
  ).toBe(4);
  await view(page, "Today");
  await page.getByRole("button", { name: "Copy entry", exact: true }).click();
  await dialog(page)
    .getByLabel("Eaten at", { exact: true })
    .fill("2026-10-24T12:00");
  await recover(() =>
    dialog(page).getByRole("button", { name: "Log food", exact: true }).click(),
  );
  await expect(page).toHaveURL(/date=2026-10-24/);
  // The copied entry retains the original 100 kcal snapshot after the definition edit.
  await expect(
    page.getByRole("region", { name: "Daily nutrition", exact: true }),
  ).toContainText("100 kcal");
  await recover(async () => {
    await page
      .getByRole("button", { name: "Delete entry", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: /^Delete .* from your log\?$/ })
      .getByRole("button", { name: "Delete", exact: true })
      .click();
  });
  expect(
    (await (await page.request.get("/api/v1/food-entries")).json()).items,
  ).toHaveLength(1);
  await page.goto("/food?view=day&date=2026-10-23");
  await page
    .locator(".food-weight")
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await dialog(page).getByLabel("Weight (kg)", { exact: true }).fill("76");
  await recover(() =>
    dialog(page)
      .getByRole("button", { name: "Save changes", exact: true })
      .click(),
  );
  await expect(page.locator(".food-weight .measurement-total")).toContainText(
    "76 kg",
  );
  await recover(async () => {
    await page
      .locator(".food-weight")
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Delete this weight entry?", exact: true })
      .getByRole("button", { name: "Delete", exact: true })
      .click();
  });
  expect(
    (await (await page.request.get("/api/v1/weight-entries")).json()).items,
  ).toHaveLength(0);
  expect(attempts.size).toBe(9);
  for (const rows of attempts.values()) {
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(rows[1]);
    if (
      rows[0]!.method !== "POST" ||
      /archive|restore|favourite/.test(rows[0]!.path)
    )
      expect(rows[0]!.revision).toMatch(/^"[1-9]\d*"$/);
  }
});

test("ingredient and measurement pagination retain selections and loaded records", async ({
  page,
}) => {
  const { write } = await setup(page);
  for (let i = 0; i < 25; i++)
    await write("/api/v1/foods", {
      name: `Picker food ${String(i).padStart(2, "0")}`,
      servingAmount: 1,
      servingUnit: "serving",
    });
  for (let i = 0; i < 31; i++)
    await write("/api/v1/weight-entries", {
      weightKg: 70 + i / 10,
      measuredAt: "2026-10-23T12:00:00Z",
    });
  let fail = true;
  await page.route("**/api/v1/foods?**", async (route) => {
    if (fail && new URL(route.request().url()).searchParams.has("cursor"))
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "UNAVAILABLE", message: "Later page unavailable" },
        }),
      });
    else await route.continue();
  });
  await view(page, "Recipes");
  await page
    .getByRole("button", { name: "Create recipe", exact: true })
    .click();
  await dialog(page)
    .getByLabel("Find a food", { exact: true })
    .fill("Picker food");
  await expect(dialog(page).locator(".food-picker > li")).toHaveCount(20);
  await dialog(page)
    .getByRole("button", { name: /^Picker food 24/ })
    .click();
  await dialog(page)
    .getByLabel("Servings of Picker food 24 · 1 serving", { exact: true })
    .fill("2");
  await dialog(page).getByText("Add ingredient", { exact: true }).click();
  await dialog(page)
    .getByRole("button", { name: "More foods", exact: true })
    .click();
  await expect(
    dialog(page).getByRole("button", {
      name: "Retry loading foods",
      exact: true,
    }),
  ).toBeVisible();
  await expect(dialog(page).locator(".food-picker > li")).toHaveCount(20);
  await expect(
    dialog(page).getByLabel("Find a food", { exact: true }),
  ).toHaveValue("Picker food");
  await expect(
    dialog(page).getByLabel("Servings of Picker food 24 · 1 serving", {
      exact: true,
    }),
  ).toHaveValue("2");
  fail = false;
  await dialog(page)
    .getByRole("button", { name: "Retry loading foods", exact: true })
    .click();
  await expect(dialog(page).locator(".food-picker > li")).toHaveCount(25);
  await dialog(page)
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Discard unsaved changes?", exact: true })
    .getByRole("button", { name: "Discard", exact: true })
    .click();
  await view(page, "Today");
  await page
    .getByRole("button", { name: "Weight history", exact: true })
    .click();
  await expect(dialog(page).locator(".measurement-list > li")).toHaveCount(30);
  fail = true;
  await page.route("**/api/v1/weight-entries?**", async (route) => {
    if (fail && new URL(route.request().url()).searchParams.has("cursor"))
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "UNAVAILABLE", message: "Later page unavailable" },
        }),
      });
    else await route.continue();
  });
  await dialog(page)
    .getByRole("button", { name: "Load more records", exact: true })
    .click();
  await expect(
    dialog(page).getByRole("button", {
      name: "Retry loading weight history",
      exact: true,
    }),
  ).toBeVisible();
  await expect(dialog(page).locator(".measurement-list > li")).toHaveCount(30);
  fail = false;
  await dialog(page)
    .getByRole("button", { name: "Retry loading weight history", exact: true })
    .click();
  await expect(dialog(page).locator(".measurement-list > li")).toHaveCount(31);
});

test("background refresh failures keep searched library results and retry in place", async ({
  page,
}) => {
  const { write } = await setup(page);
  await write("/api/v1/foods", {
    name: "Refresh rice",
    servingAmount: 1,
    servingUnit: "serving",
  });
  await page.getByLabel("Search library", { exact: true }).fill("Refresh rice");
  await expect(
    page.getByRole("heading", { name: "Refresh rice", exact: true }),
  ).toBeVisible();
  let fail = true;
  await page.route("**/api/v1/foods?**", async (route) => {
    if (fail)
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: "UNAVAILABLE", message: "Refresh unavailable" },
        }),
      });
    else await route.continue();
  });
  // Advance cache age without sleeping; the normal focus observer requests a refresh.
  await page.clock.install();
  await page.clock.fastForward(31000);
  await page.evaluate(() =>
    window.dispatchEvent(new Event("visibilitychange")),
  );
  await expect(
    page.getByRole("button", { name: "Retry refreshing foods", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Refresh rice", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Search library", { exact: true })).toHaveValue(
    "Refresh rice",
  );
  fail = false;
  await page
    .getByRole("button", { name: "Retry refreshing foods", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Retry refreshing foods", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".food-library-grid article")).toHaveCount(1);
});
