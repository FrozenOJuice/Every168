import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { openCalendarPlan, fillCalendarField } from "./helpers/calendar-form";
const headers = (version?: number) => ({
  Origin: "http://localhost:3100",
  "Idempotency-Key": randomUUID(),
  ...(version ? { "If-Match": `"${version}"` } : {}),
});
async function start(page: Page) {
  expect(
    (
      await page.request.post("/api/__test/register", {
        headers: headers(),
        data: {
          name: "Calendar reliability",
          email: `reliable-${randomUUID()}@example.com`,
          password: "Synthetic-reliability-password-123",
        },
      })
    ).ok(),
  ).toBe(true);
}
test("a committed Calendar create recovers its original request after refresh", async ({
  page,
}) => {
  await start(page);
  await page.goto("/?date=2026-09-07&view=day");
  const keys: string[] = [];
  await page.route("**/api/v1/time-blocks", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    keys.push(route.request().headers()["idempotency-key"]!);
    if (keys.length === 1) {
      const response = await route.fetch();
      expect(response.status()).toBe(201);
      return route.abort("failed");
    }
    return route.continue();
  });
  await openCalendarPlan(page);
  const editor = page.getByRole("dialog", { name: "Add plan", exact: true });
  await editor.getByLabel("Title", { exact: true }).fill("Recovered once");
  await fillCalendarField(editor, "Start", "2026-09-07T09:00");
  await editor.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    editor.getByRole("button", { name: "Retry save", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Retry same change", exact: true })
    .click();
  await expect.poll(() => keys.length).toBe(2);
  expect(keys[1]).toBe(keys[0]);
  const records = async () =>
    (
      await (await page.request.get("/api/v1/weeks/2026-09-07")).json()
    ).blocks.filter((b: { title: string }) => b.title === "Recovered once");
  await expect.poll(async () => (await records()).length).toBe(1);
  await expect(
    page.getByRole("button", { name: "Retry same change", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Meta+z");
  await expect.poll(async () => (await records()).length).toBe(0);
});
test("an unavailable workout-completion lookup does not promote a finished reservation", async ({
  page,
}) => {
  await start(page);
  await page.clock.install({ time: new Date("2026-10-24T12:00:00Z") });
  const post = async (path: string, data: object, version?: number) => {
    const r = await page.request.post(`/api/v1/${path}`, {
      headers: headers(version),
      data,
    });
    expect(r.status()).toBe(201);
    return r.json();
  };
  const exercise = await post("exercises", { name: "Lookup press" });
  const plan = await post("strength-plans", {
    title: "Finished reservation",
    exercises: [{ exerciseId: exercise.id, sets: [{ targetReps: 8 }] }],
  });
  const scheduled = await post(
    `strength-plans/${plan.id}/schedule`,
    { startsAt: "2026-10-24T13:00:00Z", endsAt: "2026-10-24T14:00:00Z" },
    plan.version,
  );
  const session = await post(
    `strength-plans/${scheduled.id}/begin`,
    { startedAt: "2026-10-24T10:00:00Z" },
    scheduled.version,
  );
  const saved = await page.request.put(
    `/api/v1/strength-workouts/${session.id}`,
    {
      headers: headers(session.version),
      data: {
        title: session.title,
        startedAt: session.startedAt,
        endedAt: "2026-10-24T11:00:00Z",
        linkedTimeBlockId: session.linkedTimeBlockId,
        exercises: [
          { exerciseId: exercise.id, sets: [{ reps: 8, completed: true }] },
        ],
      },
    },
  );
  expect(saved.ok()).toBe(true);
  await page.route("**/api/v1/strength-plans/day-links*", (route) =>
    route.fulfill({
      status: 503,
      json: {
        error: {
          code: "SYNTHETIC_LOOKUP_FAILURE",
          message: "Could not load completion status",
        },
      },
    }),
  );
  await page.goto("/?date=2026-10-24&view=day");
  await expect(
    page.getByText("Could not load workout completion status.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.locator(".day-at-a-glance-next")).toHaveCount(0);
  await page.unroute("**/api/v1/strength-plans/day-links*");
  await page
    .getByRole("button", { name: "Retry workout status", exact: true })
    .click();
  await expect(
    page.getByText("Workout completed", { exact: true }),
  ).toBeVisible();
});

test("a committed manual time correction recovers its exact request after refresh", async ({
  page,
}) => {
  await start(page);
  const response = await page.request.post("/api/v1/time-entries", {
    headers: headers(),
    data: {
      title: "Actual time recovery",
      startsAt: "2026-09-07T09:00:00Z",
      endsAt: "2026-09-07T10:00:00Z",
    },
  });
  expect(response.status()).toBe(201);
  const entry = await response.json();
  await page.goto("/?date=2026-09-07&view=day");
  await page.locator(`[data-calendar-record="${entry.id}"]`).first().click();
  const editor = page.getByRole("dialog", {
    name: "Edit recorded time",
    exact: true,
  });
  await editor
    .getByLabel("Title", { exact: true })
    .fill("Corrected actual time");
  const attempts: { key: string; body: string | null }[] = [];
  await page.route(`**/api/v1/time-entries/${entry.id}`, async (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    attempts.push({
      key: route.request().headers()["idempotency-key"]!,
      body: route.request().postData(),
    });
    if (attempts.length === 1) {
      expect((await route.fetch()).status()).toBe(200);
      return route.abort("failed");
    }
    return route.continue();
  });
  await editor.getByRole("button", { name: /^Save(?: changes)?$/ }).click();
  await expect(
    editor.getByRole("button", { name: "Retry save", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Retry same change", exact: true })
    .click();
  await expect.poll(() => attempts.length).toBe(2);
  expect(attempts[1]).toEqual(attempts[0]);
  const saved = await (
    await page.request.get(`/api/v1/time-entries/${entry.id}`)
  ).json();
  expect(saved.title).toBe("Corrected actual time");
  expect(saved.version).toBe(entry.version + 1);
  await expect(
    page.getByRole("button", { name: "Retry same change", exact: true }),
  ).toHaveCount(0);
});
