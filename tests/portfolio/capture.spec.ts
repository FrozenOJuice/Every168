import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import {
  categorySchema,
  exerciseSchema,
  meSchema,
  strengthPlanSchema,
  workoutSchema,
} from "../../packages/contracts/src/index";

// Real API records and browser renders only: no mocked responses, DOM edits or private data.
test("capture the Every168 Calendar and Fitness portfolio with synthetic records", async ({
  page,
}) => {
  const output = path.resolve("docs/media/screenshots");
  await mkdir(output, { recursive: true });
  await page.goto("/login");
  await expect(page).toHaveTitle("Every168");
  await expect(page.getByRole("link", { name: "Every168 home" })).toBeVisible();
  await page.getByLabel("Email", { exact: true }).focus();
  await page.screenshot({
    path: path.join(output, "sign-in.png"),
    animations: "disabled",
  });
  const write = async (
    route: string,
    data: object,
    version?: number,
    method: "post" | "put" = version ? "put" : "post",
  ) => {
    const response = await page.request[method](route, {
      headers: {
        Origin: "http://localhost:3100",
        "Idempotency-Key": randomUUID(),
        ...(version ? { "If-Match": `"${version}"` } : {}),
      },
      data,
    });
    expect(
      response.ok(),
      `Fixture request failed: ${route} (${response.status()}): ${await response.text()}`,
    ).toBe(true);
    return response.json();
  };
  await write("/api/__test/register", {
    name: "Portfolio demo",
    email: `portfolio-${randomUUID()}@example.com`,
    password: `Synthetic-${randomUUID()}`,
  });
  const me = meSchema.parse(
    await (await page.request.get("/api/v1/me")).json(),
  );
  await write(
    "/api/v1/preferences",
    {
      timezone: "America/Edmonton",
      weekStartsOn: 1,
      weightUnit: "kg",
      distanceUnit: "km",
    },
    me.preferences.version,
  );
  const at = (day: number, time: string) =>
    new Date(
      `2026-10-${String(day).padStart(2, "0")}T${time}:00-06:00`,
    ).toISOString();
  const categories = await Promise.all(
    ["Work", "Learning", "Personal"].map((name) =>
      write("/api/v1/categories", { name }).then((value) =>
        categorySchema.parse(value),
      ),
    ),
  );
  const block = async (
    day: number,
    title: string,
    start: string,
    end: string,
    category = 0,
    notes: string | null = null,
  ) =>
    write("/api/v1/time-blocks", {
      title,
      startsAt: at(day, start),
      endsAt: at(day, end),
      categoryId: categories[category]!.id,
      notes,
    });
  for (const day of [5, 7, 9, 12, 14, 16, 19, 21, 23, 26, 27, 28, 29, 30])
    await block(day, "Focused work", "09:00", "11:00");
  await block(26, "Project planning", "13:00", "14:00");
  await block(27, "Design review", "13:00", "14:00");
  await block(27, "Read & take notes", "17:00", "18:00", 1);
  await block(28, "Build & refine", "13:00", "15:00");
  await block(29, "Learn something new", "14:00", "15:30", 1);
  const review = await block(
    30,
    "Weekly review",
    "14:00",
    "15:00",
    0,
    "Review what worked this week, then choose next week's priorities.",
  );
  await block(31, "A walk outside", "10:00", "11:00", 2);
  await block(31, "Read & unwind", "15:00", "16:00", 2);
  await write("/api/v1/calendar/items", {
    title: "A little room to recharge",
    kind: "all_day",
    date: "2026-10-31",
    endDate: "2026-10-31",
  });

  const useExercise = async (key: string) =>
    exerciseSchema.parse(
      await write("/api/v1/exercises/from-catalog", { key }),
    );
  const bench = await useExercise("barbell-bench-press"),
    row = await useExercise("dumbbell-row"),
    press = await useExercise("shoulder-press"),
    squat = await useExercise("barbell-squat");
  for (const exercise of [bench, row, squat])
    await write(
      `/api/v1/exercises/${exercise.id}/favourite`,
      { favourite: true },
      exercise.version,
    );
  const planned = [bench, row, press].map((exercise, index) => ({
    exerciseId: exercise.id,
    sets: Array.from({ length: 3 }, () => ({
      targetReps: index === 0 ? 8 : 10,
      targetWeightKg: index === 0 ? 55 : index === 1 ? 24 : 16,
      restSeconds: 90,
    })),
  }));
  const upper = strengthPlanSchema.parse(
    await write("/api/v1/strength-plans", {
      title: "Upper body A",
      notes: "Controlled reps. Take a full rest between sets.",
      exercises: planned,
    }),
  );
  await write("/api/v1/strength-plans", {
    title: "Lower body",
    exercises: [
      {
        exerciseId: squat.id,
        sets: Array.from({ length: 3 }, () => ({
          targetReps: 8,
          targetWeightKg: 70,
        })),
      },
    ],
  });
  await write("/api/v1/strength-plans", {
    title: "Full body",
    exercises: [
      planned[0],
      { exerciseId: squat.id, sets: [{ targetReps: 8, targetWeightKg: 60 }] },
      planned[1],
    ],
  });
  const finished: string[] = [];
  for (const [day, weight, reps] of [
    [19, 45, 12],
    [21, 50, 10],
    [26, 50, 10],
    [28, 55, 8],
  ] as const) {
    const session = workoutSchema.parse(
      await write("/api/v1/strength-workouts", {
        title: "Upper body A",
        startedAt: at(day, "17:00"),
      }),
    );
    const saved = workoutSchema.parse(
      await write(
        `/api/v1/strength-workouts/${session.id}`,
        {
          title: session.title,
          startedAt: session.startedAt,
          endedAt: at(day, "17:45"),
          notes: "A steady session. Ready to build on this next time.",
          exercises: [bench, row, press].map((exercise, index) => ({
            exerciseId: exercise.id,
            sets: Array.from({ length: 3 }, () => ({
              reps: index === 0 ? reps : 10,
              weightKg: index === 0 ? weight : index === 1 ? 24 : 16,
              completed: true,
            })),
          })),
        },
        session.version,
      ),
    );
    finished.push(saved.id);
  }
  const scheduled = strengthPlanSchema.parse(
    await write(
      `/api/v1/strength-plans/${upper.id}/schedule`,
      { startsAt: at(30, "11:00"), endsAt: at(30, "12:00") },
      upper.version,
      "post",
    ),
  );
  // Schedule/begin are POST commands with an expected version, unlike ordinary PUT writes.
  const begin = await page.request.post(
    `/api/v1/strength-plans/${scheduled.id}/begin`,
    {
      headers: {
        Origin: "http://localhost:3100",
        "Idempotency-Key": randomUUID(),
        "If-Match": `"${scheduled.version}"`,
      },
      data: { startedAt: at(30, "11:00") },
    },
  );
  expect(begin.ok()).toBe(true);
  const active = workoutSchema.parse(await begin.json());
  await write(
    `/api/v1/strength-workouts/${active.id}`,
    {
      title: active.title,
      endedAt: null,
      startedAt: active.startedAt,
      linkedTimeBlockId: active.linkedTimeBlockId,
      notes: upper.notes,
      exercises: planned.map((exercise, exerciseIndex) => ({
        ...exercise,
        sets: exercise.sets.map((set, setIndex) => ({
          ...set,
          completed: exerciseIndex === 0 && setIndex < 2,
          ...(exerciseIndex === 0 && setIndex < 2
            ? { reps: 8, weightKg: 55 }
            : {}),
        })),
      })),
    },
    active.version,
  );

  await page.clock.setFixedTime(new Date(at(30, "11:20")));
  const capture = async (name: string) => {
    await expect(page).toHaveTitle("Every168");
    await expect(
      page.getByRole("link", { name: "Every168 home" }),
    ).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/168\s*Hours/i);
    await expect(
      page.getByText("Loading your records…", { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText("Loading activity…", { exact: true }),
    ).toHaveCount(0);
    await page.mouse.move(5, 5);
    await page.screenshot({
      path: path.join(output, `${name}.png`),
      animations: "disabled",
    });
  };
  const calendar = async (view: string) => {
    await page.goto(`/?date=2026-10-30&view=${view}`);
    await expect(page.locator(".calendar-interactions")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    await expect(
      page.locator(`[data-calendar-record="${review.id}"]`).first(),
    ).toBeVisible();
    await expect(
      page.getByText("Loading activity…", { exact: true }),
    ).toHaveCount(0);
    if (view === "week")
      await page.locator(".calendar-scroll").evaluate((element) => {
        element.scrollTop = 8 * 60;
      });
  };
  await calendar("week");
  await capture("calendar-week");
  await calendar("month");
  await capture("calendar-month");
  await calendar("week");
  await page
    .locator(`[data-calendar-record="${review.id}"]`)
    .first()
    .dblclick();
  await expect(
    page.getByRole("dialog", { name: "Edit plan", exact: true }),
  ).toBeVisible();
  await capture("plan-editor");
  await page.keyboard.press("Escape");
  await page.goto("/fitness/exercises?date=2026-10-30");
  await expect(
    page.getByRole("heading", { name: "Exercise library", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Bench press", { exact: true }).first(),
  ).toBeVisible();
  await capture("exercise-library");
  await page.goto(`/fitness/workout/${upper.id}`);
  const expand = page.getByRole("button", {
    name: "Expand Bench press exercise",
    exact: true,
  });
  await expect(expand).toBeVisible();
  await expand.click();
  await capture("workout-builder");
  await page.goto(`/fitness/session/${active.id}`);
  await expect(
    page.getByRole("region", { name: "Current set", exact: true }),
  ).toBeVisible();
  await capture("live-workout");
  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("region", { name: "Current set", exact: true })
    .evaluate((element) => element.scrollIntoView({ block: "center" }));
  await capture("live-workout-responsive");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/fitness/session/${finished.at(-1)}`);
  await expect(
    page.getByRole("region", { name: "Workout results", exact: true }),
  ).toBeVisible();
  await capture("workout-summary");
  await page.goto(`/fitness/exercises/${bench.id}`);
  const history = page.getByRole("heading", {
    name: "Your history",
    exact: true,
  });
  await expect(history).toBeVisible();
  await history.evaluate((element) =>
    element.scrollIntoView({ block: "start" }),
  );
  await expect(
    page.getByRole("heading", { name: "Personal records", exact: true }),
  ).toBeVisible();
  const historyBox = await history.boundingBox();
  if (historyBox && historyBox.y > 24) {
    await page.mouse.move(700, 500);
    await page.mouse.wheel(0, historyBox.y - 24);
  }
  await capture("exercise-history");
  // Captures are fixed; an interactive recording needs a clock that advances.
  const runningStart = Date.parse(at(30, "11:20"));
  await page.clock.install({ time: runningStart });
  await expect
    .poll(() => page.evaluate(() => Date.now()))
    .toBeGreaterThan(runningStart + 100);
  if (process.env.PORTFOLIO_PAUSE === "1") {
    test.setTimeout(0);
    await page.pause();
  }
});
