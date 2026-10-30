import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("adjust running rest, switch mid-exercise and finish early", async ({
  page,
}, testInfo) => {
  const write = async (path: string, data: object, version?: number) => {
    const response = await page.request.post(path, {
      headers: {
        Origin: "http://localhost:3100",
        "Idempotency-Key": randomUUID(),
        ...(version ? { "If-Match": `"${version}"` } : {}),
      },
      data,
    });
    expect(response.ok()).toBe(true);
    return response.json();
  };
  await write("/api/auth/sign-up/email", {
    name: "Live polish",
    email: `polish-${randomUUID()}@example.com`,
    password: "Synthetic-live-password-123",
  });
  const exercises = [];
  for (const name of [
    "Bench press",
    "Cable row",
    "Shoulder press",
    "Cable fly",
  ]) {
    const exercise = await write("/api/v1/exercises", { name });
    exercises.push({
      exerciseId: exercise.id,
      sets: Array.from({ length: 3 }, () => ({
        targetReps: 12,
        targetWeightKg: 50,
        restSeconds: 90,
      })),
    });
  }
  const plan = await write("/api/v1/strength-plans", {
    title: "Live polish",
    notes: "Keep a steady tempo.\nRest fully between working sets.",
    isDraft: false,
    exercises,
  });
  const session = await write(
    `/api/v1/strength-plans/${plan.id}/begin`,
    { startedAt: new Date().toISOString() },
    plan.version,
  );
  await page.goto(`/fitness/session/${session.id}`);
  const bench = page.getByRole("region", {
    name: "Bench press exercise 1",
    exact: true,
  });
  const current = bench.getByRole("region", {
    name: "Current set",
    exact: true,
  });
  await expect(current).toBeVisible();
  const notes = page.getByRole("region", {
    name: "Workout notes",
    exact: true,
  });
  await expect(
    notes.getByRole("heading", { name: "Workout notes" }),
  ).toBeVisible();
  await expect(notes).toContainText("Keep a steady tempo.");
  await expect(page.locator(".fitness-session-header")).not.toContainText(
    "Workout in progress",
  );
  await expect(
    page.getByRole("status", { name: "Workout status", exact: true }),
  ).toHaveText("In progress");
  await page
    .getByRole("button", { name: "Discard workout", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Discard this workout?" }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(current).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("live-initial.png") });
  const clockTime = new Date(Date.now() + 1000);
  await page.clock.install({ time: clockTime });
  await page.clock.pauseAt(new Date(clockTime.getTime() + 1000));
  const early = page.getByRole("button", {
    name: "Finish workout",
    exact: true,
  });
  await expect(early).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Edit workout", exact: true }),
  ).toContainText("Edit");
  await current
    .getByRole("button", { name: "Complete set", exact: true })
    .click();
  await expect(
    page.getByRole("timer", { name: "Rest timer", exact: true }),
  ).toContainText("1:30 rest remaining");
  await page.clock.runFor(30000);
  await bench
    .getByRole("button", {
      name: "Edit rest after set 1: Rest 1m 30s",
      exact: true,
    })
    .click();
  await bench
    .getByRole("textbox", { name: "Rest minutes", exact: true })
    .fill("2");
  await bench
    .getByRole("textbox", { name: "Rest seconds", exact: true })
    .fill("0");
  await bench
    .getByRole("textbox", { name: "Rest seconds", exact: true })
    .press("Enter");
  await expect(
    page.getByRole("timer", { name: "Rest timer", exact: true }),
  ).toContainText("1:30 rest remaining");
  await page.clock.resume();
  await current.getByLabel("Actual weight (kg)").fill("25");
  const choose = bench.getByRole("button", {
    name: "Choose exercise",
    exact: true,
  });
  await choose.click();
  await choose.click();
  await expect(
    page.getByRole("menu", { name: "Choose next exercise" }),
  ).toHaveCount(0);
  await choose.click();
  await page.getByRole("menuitem", { name: /Cable row/ }).click();
  const row = page.getByRole("region", {
    name: "Cable row exercise 2",
    exact: true,
  });
  await expect(row.getByRole("heading", { name: "Set 1 of 3" })).toBeFocused();
  await row
    .getByRole("button", { name: "Choose exercise", exact: true })
    .click();
  await page.getByRole("menuitem", { name: /Bench press/ }).click();
  await expect(
    current.getByRole("heading", { name: "Set 2 of 3" }),
  ).toBeFocused();
  await expect(current.getByLabel("Actual weight (kg)")).toHaveValue("25");
  await bench
    .getByRole("button", {
      name: "Edit rest after set 1: Rest 2m",
      exact: true,
    })
    .click();
  await bench
    .getByRole("textbox", { name: "Rest minutes", exact: true })
    .fill("0");
  await bench
    .getByRole("textbox", { name: "Rest seconds", exact: true })
    .fill("20");
  await bench
    .getByRole("textbox", { name: "Rest seconds", exact: true })
    .press("Enter");
  await expect(
    page.getByRole("timer", { name: "Rest timer", exact: true }),
  ).toContainText("Rest finished");
  await early.click();
  await expect(page.getByRole("dialog")).toContainText("Finish workout");
  await page
    .getByRole("button", { name: "Keep training", exact: true })
    .click();
  await expect(current.getByLabel("Actual weight (kg)")).toHaveValue("25");
  await page.screenshot({
    path: testInfo.outputPath("live-polish.png"),
    fullPage: true,
  });
  if (testInfo.project.name === "phone") {
    await page.setViewportSize({ width: 320, height: 740 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await expect(
      page
        .getByRole("button", { name: "Edit workout", exact: true })
        .locator("span")
        .first(),
    ).toBeVisible();
  }
  await early.click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Finish workout", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Correct results", exact: true }),
  ).toBeVisible();
});
