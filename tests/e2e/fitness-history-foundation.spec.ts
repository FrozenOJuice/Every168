import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("history preserves actual outcomes, targets and notes, with sourced records recalculated after correction", async ({
  page,
}, info) => {
  const write = async (
    method: "post" | "put" | "delete",
    path: string,
    data: object,
    version = 1,
  ) => {
    const response = await page.request[method](path, {
      headers: {
        Origin: "http://localhost:3100",
        "Idempotency-Key": randomUUID(),
        "If-Match": `"${version}"`,
      },
      data,
    });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  };
  await write("post", "/api/__test/register", {
    name: "History review",
    email: `history-${randomUUID()}@example.com`,
    password: "Synthetic-history-password-123",
  });
  const exercise = await write("post", "/api/v1/exercises", {
    name: "History bench",
    loggingType: "reps_load",
  });
  const destination = await write("post", "/api/v1/strength-plans", {
    title: "History destination",
    exercises: [{ exerciseId: exercise.id, sets: [{ targetReps: 8 }] }],
  });
  const input = (reps: number) => ({
    title: "Evening session",
    notes: "Stopped before the final sets",
    startedAt: "2026-10-25T12:00:00Z",
    endedAt: "2026-10-25T13:00:00Z",
    exercises: [
      {
        exerciseId: exercise.id,
        loggingType: "reps_load",
        notes: "Paused on the chest",
        sets: [
          {
            targetReps: 8,
            targetWeightKg: 50,
            reps,
            weightKg: 50,
            completed: true,
          },
          {
            targetReps: 8,
            targetWeightKg: 50,
            reps: 999,
            weightKg: 999,
            completed: false,
            skipped: true,
          },
          {
            targetReps: 8,
            targetWeightKg: 50,
            reps: 888,
            weightKg: 888,
            completed: false,
          },
        ],
      },
    ],
  });
  const early = await write("post", "/api/v1/strength-workouts", {
    title: "Earlier session",
    startedAt: "2026-10-24T12:00:00Z",
  });
  await write(
    "put",
    `/api/v1/strength-workouts/${early.id}`,
    {
      ...input(8),
      title: "Earlier session",
      startedAt: "2026-10-24T12:00:00Z",
      endedAt: "2026-10-24T13:00:00Z",
      exercises: [
        { ...input(8).exercises[0], sets: [input(8).exercises[0]!.sets[0]] },
      ],
    },
    early.version,
  );
  const created = await write("post", "/api/v1/strength-workouts", {
    title: "Evening session",
    startedAt: "2026-10-25T12:00:00Z",
  });
  let saved = await write(
    "put",
    `/api/v1/strength-workouts/${created.id}`,
    input(10),
    created.version,
  );
  await page.goto(`/fitness/session/${saved.id}`);
  await expect(
    page.getByRole("heading", {
      name: "Evening session - Summary",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("Workout time", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Show all sets", exact: true })
    .click();
  const results = page.getByRole("region", {
    name: "History bench results 1",
    exact: true,
  });
  await expect(results).toContainText("10 reps · 50 kg");
  await expect(results).toContainText("Planned: 1×8 | 50 kg");
  await expect(results).toContainText("New record - most reps at 50 kg");
  await expect(results).toContainText("Skipped");
  await expect(results).toContainText("Unfinished");
  await expect(results).not.toContainText("999");
  await expect(results).not.toContainText("888");
  await page.screenshot({
    path: info.outputPath("history-summary.png"),
    fullPage: true,
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.goto(`/fitness/exercises/${exercise.id}`);
  const history = page.getByRole("region", {
    name: "Your history",
    exact: true,
  });
  await expect(
    history.getByRole("heading", { name: "Latest session", exact: true }),
  ).toBeVisible();
  const visual = await page
    .locator(".fitness-exercise-overview > .fitness-exercise-visual")
    .boundingBox();
  const trigger = page.getByRole("button", {
    name: "Add to workout",
    exact: true,
  });
  const action = await trigger.boundingBox();
  if (info.project.name === "desktop")
    expect(action!.x).toBeGreaterThan(visual!.x + visual!.width);
  else expect(action!.y).toBeGreaterThanOrEqual(visual!.y + visual!.height);
  await trigger.click();
  const chooser = page.getByRole("region", {
    name: "Choose a workout",
    exact: true,
  });
  await expect(chooser).toBeVisible();
  if (info.project.name === "desktop")
    expect((await chooser.boundingBox())!.width).toBeGreaterThan(visual!.width);
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(page).toHaveURL(
    new RegExp(`/fitness/exercises/${exercise.id}$`),
  );
  await trigger.click();
  await chooser.getByRole("radio", { name: /History destination/ }).check();
  await chooser
    .getByRole("button", { name: "Add to History destination", exact: true })
    .click();
  await expect(
    page.getByText("History bench added to History destination.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(
    (
      await (
        await page.request.get(`/api/v1/strength-plans/${destination.id}`)
      ).json()
    ).exercises,
  ).toHaveLength(2);

  await expect(
    history.getByText("Session statistics", { exact: true }),
  ).toHaveCount(0);
  const headings = await history
    .getByRole("heading", { level: 3 })
    .allTextContents();
  expect(headings.indexOf("Latest session")).toBeLessThan(
    headings.indexOf("Personal records"),
  );
  expect(headings.indexOf("Personal records")).toBeLessThan(
    headings.indexOf("All sessions"),
  );
  await expect(history.locator(".fitness-recall-section")).toContainText(
    "Paused on the chest",
  );
  await expect(history.locator(".fitness-recall-section")).toContainText(
    "Skipped",
  );
  await expect(history.locator(".fitness-recall-section")).toContainText(
    "Unfinished",
  );
  await expect(history.locator(".fitness-session-history")).toHaveCount(2);
  const weights = history.locator(".fitness-weight-records");
  await expect(
    history.getByText(
      "Best reps is one set. Totals include all completed sets in finished workouts.",
      { exact: true },
    ),
  ).toHaveCount(0);
  await expect(history.locator(".fitness-weight-record-columns")).toContainText(
    "Best reps in one set",
  );
  await expect(history.locator(".fitness-weight-record-columns")).toContainText(
    "Total reps all time",
  );
  await expect(
    history.locator(".fitness-session-history").first().getByRole("link"),
  ).toHaveCount(1);
  await expect(
    history.locator(".fitness-exercise-session-preview"),
  ).toHaveCount(0);
  await expect(
    history.getByRole("heading", { name: "Reps by weight", exact: true }),
  ).toBeVisible();
  await expect(history.locator(".fitness-weight-record-columns")).toContainText(
    "Best reps achieved",
  );
  await expect(
    history.locator(".fitness-workout-reference > time"),
  ).toHaveCount(0);
  await expect(weights.locator(".fitness-weight-record-total")).toContainText(
    "18 reps",
  );
  await expect(weights).toContainText("10 reps");
  await expect(weights).toContainText("50 kg");
  await expect(weights.getByRole("link")).toHaveAttribute(
    "href",
    new RegExp(`^/fitness/session/${saved.id}\\?`),
  );
  await page.screenshot({
    path: info.outputPath("exercise-history.png"),
    fullPage: true,
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await history
    .getByRole("checkbox", { name: "Duration", exact: true })
    .check();
  for (const selector of [
    ".fitness-recall-section .fitness-workout-reference-link",
    ".fitness-progress-records .fitness-workout-reference-link",
    ".fitness-weight-records .fitness-workout-reference-link",
    ".fitness-session-history .fitness-workout-reference-link",
  ]) {
    const link = history.locator(selector).first();
    const date = link.locator("time");
    await date.scrollIntoViewIfNeeded();
    const position = await page.evaluate(() => ({
      page: window.scrollY,
      pane: document.querySelector(".fitness-primary-pane")?.scrollTop ?? 0,
    }));
    await date.click();
    const back = page.getByRole("link", {
      name: "Back to History bench",
      exact: true,
    });
    await expect(back).toBeVisible();
    if (selector.startsWith(".fitness-session-history")) {
      await page.reload();
      await expect(back).toBeVisible();
      await page
        .getByRole("button", { name: "Correct results", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Back to summary", exact: true })
        .click();
      await expect(back).toBeVisible();
    }
    await back.click();
    await expect(page).toHaveURL(
      new RegExp(`/fitness/exercises/${exercise.id}(?:\\?|$)`),
    );
    await expect(
      history.getByRole("checkbox", { name: "Duration", exact: true }),
    ).toBeChecked();
    await expect(link).toBeFocused();
    await expect
      .poll(async () =>
        page.evaluate(
          (before) =>
            Math.abs(window.scrollY - before.page) +
            Math.abs(
              (document.querySelector(".fitness-primary-pane")?.scrollTop ??
                0) - before.pane,
            ),
          position,
        ),
      )
      .toBeLessThan(4);
  }
  saved = await write(
    "put",
    `/api/v1/strength-workouts/${saved.id}`,
    input(7),
    saved.version,
  );
  await page.reload();
  await expect(weights).toContainText("8 reps");
  await expect(weights.locator(".fitness-weight-record-total")).toContainText(
    "15 reps",
  );
  await expect(weights).toContainText("50 kg");
  await expect(weights.getByRole("link")).toHaveAttribute(
    "href",
    new RegExp(`^/fitness/session/${early.id}\\?`),
  );
  await page.goto(`/fitness/session/${saved.id}`);
  await expect(
    page.getByRole("link", { name: "Back to History", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Show all sets", exact: true })
    .click();
  await expect(page.locator(".fitness-summary-record")).toHaveCount(0);
  await page.goto(`/fitness/session/${early.id}`);
  await page
    .getByRole("button", { name: "Show all sets", exact: true })
    .click();
  await expect(
    page.locator(".fitness-summary-highlights .fitness-summary-record"),
  ).toHaveText(["First recorded result"]);
  await expect(
    page.locator(".fitness-review-exercise ol .fitness-summary-record"),
  ).toHaveText(["First recorded result"]);
  const empty = await write("post", "/api/v1/exercises", {
    name: "Unused exercise",
    loggingType: "reps_load",
  });
  await page.goto(`/fitness/exercises/${empty.id}`);
  await expect(
    page.getByRole("heading", { name: "No workout history yet", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Personal records", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Instructions", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Add to workout", exact: true }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: info.outputPath("exercise-empty-history.png"),
    fullPage: true,
  });
});
