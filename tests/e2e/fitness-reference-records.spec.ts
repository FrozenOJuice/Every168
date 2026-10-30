import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test.use({ actionTimeout: 10000 });
test("workout reference reuses personal records and reps by weight without session history", async ({
  page,
}, info) => {
  const write = async (path: string, data: object, version?: number) => {
    const r = await page.request[version ? "put" : "post"](path, {
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
  await write("/api/auth/sign-up/email", {
    name: "Reference records",
    email: `reference-records-${randomUUID()}@example.com`,
    password: "Synthetic-reference-password-123",
  });
  const exercise = await write("/api/v1/exercises", {
    name: "Records press",
    loggingType: "reps_load",
    notes: "Move with control.",
  });
  for (const [day, title, sets] of [
    [
      25,
      "Earlier results",
      [
        { reps: 12, weightKg: 50, completed: true },
        { reps: 8, weightKg: 50, completed: true },
        { reps: 6, weightKg: 60, completed: true },
        { reps: 999, weightKg: 999, skipped: true, completed: false },
        { reps: 888, weightKg: 888, completed: false },
      ],
    ],
    [26, "Recent results", [{ reps: 10, weightKg: 50, completed: true }]],
  ] as const) {
    const session = await write("/api/v1/strength-workouts", {
      title,
      startedAt: `2026-10-25T${day === 25 ? "15" : "18"}:00:00Z`,
    });
    await write(
      `/api/v1/strength-workouts/${session.id}`,
      {
        title,
        startedAt: session.startedAt,
        endedAt: `2026-10-25T${day === 25 ? "16" : "19"}:00:00Z`,
        exercises: [
          { exerciseId: exercise.id, loggingType: "reps_load", sets },
        ],
      },
      session.version,
    );
  }
  const plan = await write("/api/v1/strength-plans", {
    title: "Review records",
    exercises: [
      {
        exerciseId: exercise.id,
        sets: [{ targetReps: 8, targetWeightKg: 40 }],
      },
    ],
  });
  if (info.project.name === "phone")
    await page.setViewportSize({ width: 320, height: 844 });
  await page.goto(`/fitness/workout/${plan.id}`);
  const workout = page.getByRole("region", {
    name: "Workout workspace",
    includeHidden: true,
  });
  const opener = workout.getByRole("button", {
    name: "Exercise details for Records press",
    exact: true,
  });
  await opener.click();
  const guide = page.getByRole("region", {
    name: "Records press details",
    exact: true,
  });
  const records = guide.locator(".fitness-exercise-records");
  await expect(
    records.getByRole("heading", { name: "Personal records", exact: true }),
  ).toBeVisible();
  const prs = records.locator(".fitness-progress-records > li");
  await expect(prs).toHaveCount(2);
  await expect(prs.filter({ hasText: "Heaviest weight" })).toContainText(
    "60 kg",
  );
  await expect(prs.filter({ hasText: "Heaviest weight" })).toContainText(
    "6 reps",
  );
  await expect(prs.filter({ hasText: "Most reps in a set" })).toContainText(
    "12 reps",
  );
  await expect(prs.filter({ hasText: "Most reps in a set" })).toContainText(
    "50 kg",
  );
  const weights = guide.getByRole("region", {
    name: "Reps by weight",
    exact: true,
  });
  const rows = weights.locator(".fitness-weight-record-row");
  await expect(rows).toHaveCount(2);
  const columns = weights.locator(".fitness-weight-record-columns");
  await expect(columns).toBeVisible();
  await expect(columns.getByText("Weight", { exact: true })).toBeVisible();
  await expect(
    rows.first().locator(".fitness-weight-record-label").first(),
  ).toBeHidden();
  await expect(
    rows.first().getByText("Best reps achieved", { exact: true }),
  ).toBeVisible();
  const valueBoxes = await rows
    .first()
    .locator(
      ":scope > strong, :scope > .fitness-weight-record-number > span:last-child",
    )
    .evaluateAll((nodes) =>
      nodes.map((node) => {
        const box = node.getBoundingClientRect();
        return { x: box.x, y: box.y };
      }),
    );
  expect(valueBoxes).toHaveLength(3);
  for (const value of valueBoxes)
    expect(value.y).toBeCloseTo(valueBoxes[0]!.y, 0);
  const headingBoxes = await columns
    .locator(":scope > span")
    .evaluateAll((nodes) =>
      nodes
        .filter((node) => node.getClientRects().length)
        .map((node) => node.getBoundingClientRect().x),
    );
  expect(headingBoxes).toHaveLength(3);
  headingBoxes.forEach((x, index) =>
    expect(x).toBeCloseTo(valueBoxes[index]!.x, 0),
  );
  const fifty = rows.filter({ hasText: "50 kg" });
  await expect(fifty).toContainText("12 reps");
  await expect(fifty.locator(".fitness-weight-record-total")).toContainText(
    "30 reps",
  );
  await expect(weights).not.toContainText("999");
  await expect(weights).not.toContainText("888");
  await expect(
    guide.getByRole("heading", { name: "Latest session", exact: true }),
  ).toHaveCount(0);
  await expect(
    guide.getByRole("heading", { name: "All sessions", exact: true }),
  ).toHaveCount(0);
  await expect(
    guide.locator(".fitness-detail-tabs,.fitness-inline-recall"),
  ).toHaveCount(0);
  const link = prs
    .first()
    .getByRole("link", { name: /Open workout: Earlier results/ });
  await expect(link).toHaveAttribute(
    "href",
    /\/fitness\/session\/.+\?returnExercise=/,
  );
  await weights.scrollIntoViewIfNeeded();
  await page.screenshot({ path: info.outputPath("reference-records.png") });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const references = guide.locator(".fitness-workout-reference");
  await expect(references.locator(":scope > time")).toHaveCount(0);
  await expect(references.locator("a time")).toHaveCount(
    await references.count(),
  );
  const source = rows.first().getByRole("link");
  const rowBox = (await rows.first().boundingBox())!,
    sourceBox = (await source.boundingBox())!;
  expect(sourceBox.y).toBeGreaterThan(rowBox.y + 20);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await guide
    .getByRole("button", { name: "Back to workout", exact: true })
    .click();
  await expect(opener).toBeFocused();
  await expect(workout.getByLabel("Workout name", { exact: true })).toHaveValue(
    "Review records",
  );
  // The main details page retains its complete review structure and the same totals.
  await page.goto(`/fitness/exercises/${exercise.id}`);
  await expect(
    page.getByRole("heading", { name: "Latest session", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "All sessions", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".fitness-weight-record-total").filter({ hasText: "30 reps" }),
  ).toHaveCount(1);
  const times = page.locator(".fitness-exercise-session-list a time");
  await expect(times).toHaveCount(2);
  const me = await (await page.request.get("/api/v1/me")).json();
  const timezone = me.preferences.timezone;
  const dates: string[] = [];
  for (const time of await times.all()) {
    const instant = new Date((await time.getAttribute("datetime"))!);
    const date = new Intl.DateTimeFormat("en", {
      timeZone: timezone,
      dateStyle: "medium",
    }).format(instant);
    const clock = new Intl.DateTimeFormat("en", {
      timeZone: timezone,
      timeStyle: "short",
    }).format(instant);
    await expect(time).toHaveText(`${date} · ${clock}`);
    dates.push(date);
  }
  expect(new Set(dates).size).toBe(1);
  expect(new Set(await times.allTextContents()).size).toBe(2);
  await times.first().click();
  await expect(
    page.getByRole("link", { name: "Back to Records press", exact: true }),
  ).toBeVisible();
});
