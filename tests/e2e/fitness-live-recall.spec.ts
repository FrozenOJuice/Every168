import { randomUUID } from "node:crypto";
import { expect, test, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("Live previous session stays compact and opens history without losing current results", async ({
  page,
}, info) => {
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
  await write("/api/auth/sign-up/email", {
    name: "Previous session",
    email: `recall-${randomUUID()}@example.com`,
    password: "Synthetic-recall-password-123",
  });
  const exercise = await write("/api/v1/exercises", { name: "Bench press" });
  const previous = await write("/api/v1/strength-workouts", {
    title: "Previous bench workout",
    startedAt: "2026-10-27T12:00:00Z",
  });
  await write(
    `/api/v1/strength-workouts/${previous.id}`,
    {
      title: previous.title,
      startedAt: previous.startedAt,
      endedAt: "2026-10-27T13:00:00Z",
      exercises: [
        {
          exerciseId: exercise.id,
          sets: [
            ...Array.from({ length: 4 }, () => ({
              reps: 12,
              weightKg: 50,
              completed: true,
            })),
            { reps: 999, weightKg: 999, completed: false, skipped: true },
            { reps: 888, weightKg: 888, completed: false },
          ],
        },
      ],
    },
    previous.version,
  );
  const plan = await write("/api/v1/strength-plans", {
    title: "Current bench workout",
    isDraft: false,
    exercises: [
      {
        exerciseId: exercise.id,
        sets: [
          { targetReps: 10, targetWeightKg: 40 },
          { targetReps: 10, targetWeightKg: 40 },
        ],
      },
    ],
  });
  const begin = await page.request.post(
    `/api/v1/strength-plans/${plan.id}/begin`,
    {
      headers: {
        Origin: "http://localhost:3100",
        "Idempotency-Key": randomUUID(),
        "If-Match": `"${plan.version}"`,
      },
      data: { startedAt: new Date().toISOString() },
    },
  );
  expect(begin.ok()).toBe(true);
  const session = await begin.json();
  if (info.project.name === "phone")
    await page.setViewportSize({ width: 320, height: 740 });
  const layoutOf = (scope: Locator) =>
    scope.evaluate((root) => {
      const toolbar = root.querySelector<HTMLElement>(
        ".fitness-exercise-detail-toolbar",
      )!;
      const overview = root.querySelector<HTMLElement>(
        ".fitness-exercise-overview",
      )!;
      const records = root.querySelector<HTMLElement>(
        ".fitness-progress-records",
      )!;
      const cards = records.querySelectorAll<HTMLElement>(":scope > li");
      const host =
        root.closest(".fitness-exercise-panel") ??
        root.closest(".fitness-primary-pane")!;
      return {
        hostPaddingTop: getComputedStyle(host).paddingTop,
        hostBorderTop: getComputedStyle(host).borderTopWidth,
        width: root.getBoundingClientRect().width,
        titleSize: getComputedStyle(root.querySelector("h1")!).fontSize,
        overviewColumns:
          getComputedStyle(overview).gridTemplateColumns.split(" ").length,
        recordsSameRow:
          Math.abs(
            cards[0]!.getBoundingClientRect().y -
              cards[1]!.getBoundingClientRect().y,
          ) < 1,
        toolbarPosition: getComputedStyle(toolbar).position,
        toolbarBackground: getComputedStyle(toolbar).backgroundColor,
      };
    });
  await page.goto(`/fitness/exercises/${exercise.id}`);
  const normalDetails = page.getByRole("region", {
    name: "Bench press details",
    exact: true,
  });
  await expect(
    normalDetails.locator(".fitness-progress-records > li"),
  ).toHaveCount(2);
  const normalLayout = await layoutOf(normalDetails);
  await page.screenshot({
    path: info.outputPath("normal-exercise-details.png"),
  });
  await page.goto(`/fitness/session/${session.id}`);
  const recall = page.getByRole("region", {
    name: "Previous session",
    exact: true,
  });
  await expect(recall.locator("strong")).toHaveText("4×12 | 50 kg");
  await expect(recall).toContainText("Oct 27, 2026");
  await expect(recall).not.toContainText(/Set \d|more sets|999|888/);
  await expect(
    recall.getByRole("button", { name: "View history", exact: true }),
  ).toHaveClass(/button/);
  const current = page.getByRole("region", {
    name: "Current set",
    exact: true,
  });
  await current.getByLabel("Actual weight (kg)").fill("25");
  await recall.scrollIntoViewIfNeeded();
  await page.screenshot({
    path: info.outputPath("compact-previous-session.png"),
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  if (info.project.name === "phone") {
    await page.setViewportSize({ width: 320, height: 740 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await recall.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: info.outputPath("compact-previous-session-320.png"),
    });
  }
  await recall
    .getByRole("button", { name: "View history", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Latest session", exact: true }),
  ).toBeVisible();
  const guide = page.getByRole("region", {
    name: "Bench press details",
    exact: true,
  });
  await expect(
    guide.getByRole("group", { name: "Exercise information", exact: true }),
  ).toHaveCount(0);
  await expect(
    guide.locator(".fitness-exercise-overview.has-title"),
  ).toHaveCount(1);
  const historyHeading = guide.getByRole("heading", {
    name: "Your history",
    exact: true,
  });
  await expect(historyHeading).toBeFocused();
  const headingBounds = await historyHeading.boundingBox();
  const back = guide.getByRole("button", {
    name: "Back to workout",
    exact: true,
  });
  expect(headingBounds!.y).toBeGreaterThanOrEqual(
    info.project.name === "phone" ? 64 : 0,
  );
  expect(headingBounds!.y).toBeLessThan(400);
  await page.screenshot({ path: info.outputPath("unified-live-history.png") });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await expect(guide).not.toHaveClass(/fitness-exercise-reference/);
  await expect(
    guide.getByRole("heading", { name: "Bench press", level: 1, exact: true }),
  ).toHaveCount(1);
  const liveLayout = await layoutOf(guide);
  expect(Math.abs(liveLayout.width - normalLayout.width)).toBeLessThan(2);
  expect({ ...liveLayout, width: 0 }).toEqual({ ...normalLayout, width: 0 });
  expect(liveLayout.toolbarPosition).toBe("static");
  await guide.evaluate((element) => element.scrollIntoView({ block: "start" }));
  await page.screenshot({
    path: info.outputPath("normal-layout-from-live.png"),
  });
  await back.click();
  await expect(current.getByLabel("Actual weight (kg)")).toHaveValue("25");
  await expect(
    recall.getByRole("button", { name: "View history", exact: true }),
  ).toBeFocused();
  await expect(page).toHaveURL(new RegExp(`/fitness/session/${session.id}$`));
});
