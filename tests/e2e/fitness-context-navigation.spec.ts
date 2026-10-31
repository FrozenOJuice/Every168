import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

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
    name: "Context navigation",
    email: `context-${randomUUID()}@example.com`,
    password: "Synthetic-context-password-123",
  });
  const exercise = await write("/api/v1/exercises", { name: "Context press" });
  const sessions = [];
  for (const [title, day] of [
    ["First context", "24"],
    ["Second context", "25"],
  ]) {
    const session = await write("/api/v1/strength-workouts", {
      title,
      startedAt: `2026-10-${day}T12:00:00Z`,
    });
    sessions.push(
      await write(
        `/api/v1/strength-workouts/${session.id}`,
        {
          title,
          startedAt: session.startedAt,
          endedAt: `2026-10-${day}T13:00:00Z`,
          exercises: [
            {
              exerciseId: exercise.id,
              sets: [
                { completed: true, reps: 12, weightKg: day === "25" ? 60 : 50 },
              ],
            },
          ],
        },
        session.version,
      ),
    );
  }
  return { write, exercise, first: sessions[0], second: sessions[1] };
}
for (const fallback of [false, true]) {
  test(`contextual visits unwind summaries and retain correction drafts (${fallback ? "fallback" : "Navigation API"})`, async ({
    page,
  }) => {
    if (fallback)
      await page.addInitScript(() =>
        Object.defineProperty(window, "navigation", {
          value: undefined,
          configurable: true,
        }),
      );
    const { first, second } = await setup(page);
    const dialogs: string[] = [];
    page.on("dialog", async (dialog) => {
      dialogs.push(dialog.type());
      await dialog.dismiss();
    });
    await page.goto("/fitness/history");
    await page.getByRole("link", { name: /First context/ }).click();
    const help = page.getByRole("button", {
      name: /^(Help with Context press|Exercise details for Context press)$/,
      exact: true,
    });
    const details = page.getByRole("region", {
      name: "Context press details",
      exact: true,
    });
    await help.click();
    await details
      .locator(".fitness-recall-section")
      .getByRole("link", { name: /^Open workout: Second context,/ })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Second context - Summary",
        exact: true,
      }),
    ).toBeVisible();
    const beforeLoop = await page.evaluate(() => history.length);
    // Exercise X is already open underneath this workout; visit it without adding another entry.
    await help.click();
    await expect(details).toBeVisible();
    expect(await page.evaluate(() => history.length)).toBe(beforeLoop);
    await expect(
      details.getByRole("button", { name: "Back to summary", exact: true }),
    ).toBeVisible();
    await details
      .getByRole("button", { name: "Back to summary", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "First context - Summary",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Correct results", exact: true })
      .click();
    await page
      .getByLabel("Workout name", { exact: true })
      .fill("Retained corrections");
    await help.click();
    const source = details
      .getByRole("link", { name: /^Open workout: First context,/ })
      .first();
    await source.click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByLabel("Workout name", { exact: true })).toHaveValue(
      "Retained corrections",
    );
    await help.click();
    await details
      .getByRole("link", { name: /^Open workout: Second context,/ })
      .first()
      .click();
    const confirm = page.getByRole("dialog", {
      name: "Discard changes?",
      exact: true,
    });
    await expect(confirm).toBeVisible();
    await confirm
      .getByRole("button", { name: "Keep editing", exact: true })
      .click();
    await expect(details).toBeVisible();
    await details
      .getByRole("button", { name: "Back to workout", exact: true })
      .click();
    await expect(page.getByLabel("Workout name", { exact: true })).toHaveValue(
      "Retained corrections",
    );
    expect(
      (
        await (
          await page.request.get(`/api/v1/strength-workouts/${first.id}`)
        ).json()
      ).version,
    ).toBe(first.version);
    expect(
      (
        await (
          await page.request.get(`/api/v1/strength-workouts/${second.id}`)
        ).json()
      ).version,
    ).toBe(second.version);
    expect(dialogs).toEqual([]);
  });

  test(`Live editor returns through history and retains session edits (${fallback ? "fallback" : "Navigation API"})`, async ({
    page,
  }) => {
    if (fallback)
      await page.addInitScript(() =>
        Object.defineProperty(window, "navigation", {
          value: undefined,
          configurable: true,
        }),
      );
    const { write, exercise } = await setup(page);
    const created = await write("/api/v1/strength-workouts", {
      title: "Live context",
      startedAt: new Date().toISOString(),
    });
    const session = await write(
      `/api/v1/strength-workouts/${created.id}`,
      {
        title: created.title,
        startedAt: created.startedAt,
        endedAt: null,
        exercises: [
          { exerciseId: exercise.id, sets: [{ reps: 10, weightKg: 30 }] },
        ],
      },
      created.version,
    );
    await page.goto(`/fitness/session/${session.id}`);
    await page
      .getByRole("button", { name: "Edit workout", exact: true })
      .click();
    await page
      .getByLabel("Workout name", { exact: true })
      .fill("Edited live context");
    await expect(
      page.getByRole("button", { name: "Done editing", exact: true }),
    ).toBeEnabled();
    const help = page.getByRole("button", {
      name: /^(Help with Context press|Exercise details for Context press)$/,
      exact: true,
    });
    await help.click();
    const details = page.getByRole("region", {
      name: "Context press details",
      exact: true,
    });
    await details
      .getByRole("link", { name: /^Open workout: Second context,/ })
      .first()
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Second context - Summary",
        exact: true,
      }),
    ).toBeVisible();
    await page.reload();
    await page
      .getByRole("link", { name: "Back to Context press", exact: true })
      .click();
    await expect(details).toBeVisible();
    await details
      .getByRole("button", { name: "Back to workout", exact: true })
      .click();
    await expect(page.getByLabel("Workout name", { exact: true })).toHaveValue(
      "Edited live context",
    );
    await expect(
      page.getByRole("button", { name: "Done editing", exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Workout name", { exact: true })).toHaveValue(
      "Edited live context",
    );
    await page
      .getByRole("button", { name: "Done editing", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Edit workout", exact: true }),
    ).toBeVisible();
  });
}

test("library and reusable editor keep their own parent, filters and draft through workout references", async ({
  page,
}) => {
  const { write, exercise } = await setup(page);
  await page.goto("/fitness/exercises");
  const search = page.getByRole("searchbox", {
    name: "Find an exercise",
    exact: true,
  });
  await search.fill("Context press");
  await page
    .getByRole("button", { name: "Context press", exact: true })
    .click();
  const details = page.getByRole("region", {
    name: "Context press details",
    exact: true,
  });
  await details
    .getByRole("link", { name: /^Open workout: Second context,/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Second context - Summary",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("link", { name: "Back to Context press", exact: true })
    .click();
  await details
    .getByRole("button", { name: "Back to Exercises", exact: true })
    .click();
  await expect(search).toHaveValue("Context press");
  const plan = await write("/api/v1/strength-plans", {
    title: "Reusable context",
    isDraft: false,
    exercises: [
      {
        exerciseId: exercise.id,
        sets: [{ targetReps: 10, targetWeightKg: 30 }],
      },
    ],
  });
  await page.goto(`/fitness/workout/${plan.id}`);
  await page
    .getByLabel("Workout name", { exact: true })
    .fill("Retained reusable draft");
  await page
    .getByRole("button", {
      name: "Exercise details for Context press",
      exact: true,
    })
    .click();
  await details
    .getByRole("link", { name: /^Open workout: Second context,/ })
    .first()
    .click();
  await page
    .getByRole("link", { name: "Back to Context press", exact: true })
    .click();
  await details
    .getByRole("button", { name: "Back to workout", exact: true })
    .click();
  await expect(page.getByLabel("Workout name", { exact: true })).toHaveValue(
    "Retained reusable draft",
  );
  await page.getByRole("button", { name: "Save workout", exact: true }).click();
  await expect(page).toHaveURL(/\/fitness$/);
  expect(
    (await (await page.request.get(`/api/v1/strength-plans/${plan.id}`)).json())
      .title,
  ).toBe("Retained reusable draft");
});
