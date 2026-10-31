import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
test("exercise pagination retains loaded history and retries only the missing page", async ({
  page,
}) => {
  const write = async (
    method: "post" | "put",
    path: string,
    data: object,
    version?: number,
  ) => {
    const r = await page.request[method](path, {
      headers: {
        Origin: "http://localhost:3100",
        "Idempotency-Key": randomUUID(),
        ...(version ? { "If-Match": `"${version}"` } : {}),
      },
      data,
    });
    expect(r.ok(), await r.text()).toBe(true);
    return r.json();
  };
  await write("post", "/api/__test/register", {
    name: "History recovery",
    email: `history-recovery-${randomUUID()}@example.com`,
    password: "Synthetic-history-password-123",
  });
  const exercise = await write("post", "/api/v1/exercises", {
    name: "Recovery exercise",
  });
  for (let day = 1; day <= 7; day++) {
    const startedAt = `2026-09-0${day}T12:00:00Z`;
    const w = await write("post", "/api/v1/strength-workouts", {
      title: `Recovery session ${day}`,
      startedAt,
    });
    await write(
      "put",
      `/api/v1/strength-workouts/${w.id}`,
      {
        title: w.title,
        startedAt,
        endedAt: `2026-09-0${day}T13:00:00Z`,
        exercises: [
          { exerciseId: exercise.id, sets: [{ reps: day, completed: true }] },
        ],
      },
      w.version,
    );
  }
  await page.goto(`/fitness/exercises/${exercise.id}`);
  const history = page.locator(".fitness-progress-page");
  await expect(history.locator(".fitness-session-history")).toHaveCount(6);
  await page.route("**/api/v1/fitness-progress/exercises/*", (route) =>
    new URL(route.request().url()).searchParams.has("cursor")
      ? route.fulfill({
          status: 503,
          json: {
            error: { code: "SYNTHETIC_PAGE_ERROR", message: "Unavailable" },
          },
        })
      : route.continue(),
  );
  await history
    .getByRole("button", { name: "Load older sessions", exact: true })
    .click();
  await expect(
    history.getByText(
      "Could not load older sessions. Your loaded history is still available.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    history.getByRole("heading", { name: "Latest session", exact: true }),
  ).toBeVisible();
  await expect(history.locator(".fitness-session-history")).toHaveCount(6);
  await page.unroute("**/api/v1/fitness-progress/exercises/*");
  await history
    .getByRole("button", { name: "Retry older sessions", exact: true })
    .click();
  await expect(history.locator(".fitness-session-history")).toHaveCount(7);
  await expect(
    history.getByRole("button", { name: "Retry older sessions", exact: true }),
  ).toHaveCount(0);
});
