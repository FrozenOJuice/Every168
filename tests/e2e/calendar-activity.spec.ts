import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

test("Calendar brings plans, sessions and moments together with quick creation and safe retries", async ({
  page,
}, testInfo) => {
  const headers = () => ({
    Origin: "http://localhost:3100",
    "Idempotency-Key": randomUUID(),
  });
  const signup = await page.request.post("/api/auth/sign-up/email", {
    headers: headers(),
    data: {
      name: "Day feed member",
      email: `feed-${randomUUID()}@example.com`,
      password: "Synthetic-calendar-password-123",
    },
  });
  expect(signup.status()).toBe(200);
  const me = await (await page.request.get("/api/v1/me")).json();
  expect(
    (
      await page.request.put("/api/v1/preferences", {
        headers: { ...headers(), "If-Match": `"${me.preferences.version}"` },
        data: {
          timezone: "UTC",
          weekStartsOn: 1,
          weightUnit: "kg",
          distanceUnit: "km",
        },
      })
    ).status(),
  ).toBe(200);
  const post = async (path: string, data: object) => {
    const response = await page.request.post("/api/v1/" + path, {
      headers: headers(),
      data,
    });
    expect(response.status()).toBe(201);
    return response.json();
  };
  await post("time-blocks", {
    title: "Morning plan",
    startsAt: "2026-10-07T09:00:00Z",
    endsAt: "2026-10-07T10:00:00Z",
  });
  await post("time-blocks", {
    title: "Current plan",
    startsAt: "2026-10-07T15:30:00Z",
    endsAt: "2026-10-07T16:30:00Z",
  });
  await post("time-blocks", {
    title: "Later plan",
    startsAt: "2026-10-07T17:00:00Z",
    endsAt: "2026-10-07T18:00:00Z",
  });
  for (const minute of [0, 15, 30])
    await post("water-entries", {
      amountMl: 250,
      consumedAt: `2026-10-07T10:${String(minute).padStart(2, "0")}:00Z`,
    });
  const food = await post("foods", {
    name: "Recorded lunch",
    servingAmount: 1,
    servingUnit: "item",
    calories: 300,
  });
  await post("food-entries", {
    foodId: food.id,
    consumedAt: "2026-10-07T12:00:00Z",
    quantity: 1,
  });
  await post("cardio-activities", {
    title: "Recorded walk",
    activityType: "walk",
    startedAt: "2026-10-07T13:00:00Z",
    durationSeconds: 1800,
  });
  await page.clock.install({ time: new Date("2026-10-07T16:00:00Z") });
  await page.goto("/?date=2026-10-07&view=day");
  const feed = page.getByRole("region", { name: "Day activity", exact: true });
  await expect(
    feed.getByRole("heading", { name: "Earlier", exact: true }),
  ).toBeVisible();
  await expect(
    feed.getByRole("heading", { name: "Now", exact: true }),
  ).toBeVisible();
  await expect(
    feed.getByRole("heading", { name: "Coming up", exact: true }),
  ).toBeVisible();
  await expect(feed.getByRole("link", { name: /Recorded walk/ })).toHaveCount(
    1,
  );
  await expect(feed.getByRole("button", { name: /Recorded walk/ })).toHaveCount(
    0,
  );
  await feed.getByText(/3 Water moments/).click();
  await expect(feed.getByRole("link", { name: /Water.*250 ml/ })).toHaveCount(
    3,
  );
  await expect(
    feed.getByRole("link", { name: /Recorded lunch/ }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("calendar-day-feed.png"),
    fullPage: true,
  });
  const day = page.getByRole("region", { name: "Daily time grid" });
  const slot = day.getByRole("button", {
    name: "Add block on 2026-10-07 at 19:00",
    exact: true,
  });
  await slot.scrollIntoViewIfNeeded();
  await slot.click({ position: { x: 15, y: 23 } });
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Start", { exact: true })).toHaveValue(
    "2026-10-07T19:15",
  );
  await expect(
    dialog.getByLabel("Category", { exact: true }),
  ).not.toBeVisible();
  await dialog.getByRole("button", { name: "Record", exact: true }).click();
  await dialog.getByLabel("What did you record?").selectOption("water");
  await expect(dialog.getByLabel("Drank at", { exact: true })).toHaveValue(
    "2026-10-07T19:15",
  );
  const keys: string[] = [];
  await page.route("**/api/v1/water-entries", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    keys.push(route.request().headers()["idempotency-key"]!);
    if (keys.length === 1) {
      expect((await route.fetch()).status()).toBe(201);
      await route.abort("failed");
    } else await route.continue();
  });
  await dialog.getByRole("button", { name: "Log water", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "Record", exact: true }),
  ).toBeDisabled();
  await expect(
    dialog.getByRole("button", { name: "Retry save", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Retry save", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  await page.unroute("**/api/v1/water-entries");
  await expect(feed.getByRole("link", { name: /Water.*7:15/ })).toHaveCount(1);
  // Verify the point log created no accounting duration.
  const week = await (
    await page.request.get("/api/v1/weeks/2026-10-05")
  ).json();
  expect(week.entries).toHaveLength(1);
  const activity = await (
    await page.request.get(
      "/api/v1/calendar/activity?from=2026-10-07&to=2026-10-07",
    )
  ).json();
  const added = activity.entries.find(
    (entry: { source: { type: string }; occurredAt: string }) =>
      entry.source.type === "water_entry" && entry.occurredAt.includes("19:15"),
  );
  expect(added.endsAt).toBeNull();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await dialog.getByLabel("Title", { exact: true }).fill("Simple new plan");
  await dialog
    .getByRole("button", { name: "Create block", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    feed.getByRole("button", { name: /Simple new plan.*planned/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Week", exact: true }).click();
  const marker = page.getByRole("button", {
    name: "Show moments for 2026-10-07",
    exact: true,
  });
  await expect(marker).toBeVisible();
  await marker.click();
  await expect(
    dialog.getByRole("link", { name: /Recorded lunch/ }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Month", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Monthly calendar" }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("calendar-moments-month.png"),
    fullPage: true,
  });
});
