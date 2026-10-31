import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { Workout } from "../../packages/contracts/src/exercise";

const headers = (version?: number) => ({
  Origin: "http://localhost:3100",
  "Idempotency-Key": randomUUID(),
  ...(version ? { "If-Match": `"${version}"` } : {}),
});
async function seed(page: Page, finished = false) {
  const write = async (
    method: "post" | "put",
    path: string,
    data: object,
    version?: number,
  ) => {
    const response = await page.request[method](path, {
      headers: headers(version),
      data,
    });
    expect(response.ok()).toBe(true);
    return response.json();
  };
  await write("post", "/api/__test/register", {
    name: "Fitness regression",
    email: `fitness-integrity-${randomUUID()}@example.com`,
    password: "Synthetic-fitness-password-123",
  });
  const me = await (await page.request.get("/api/v1/me")).json();
  await write(
    "put",
    "/api/v1/preferences",
    {
      timezone: "UTC",
      weekStartsOn: 1,
      weightUnit: "kg",
      distanceUnit: "km",
    },
    me.preferences.version,
  );
  const exercise = await write("post", "/api/v1/exercises", {
    name: "Regression squat",
  });
  const plan = await write("post", "/api/v1/strength-plans", {
    title: "Regression workout",
    exercises: [
      {
        exerciseId: exercise.id,
        sets: [{ targetReps: 8 }, { targetReps: 10 }],
      },
    ],
  });
  let session: Workout = await write(
    "post",
    `/api/v1/strength-plans/${plan.id}/begin`,
    {
      startedAt: "2026-10-14T15:00:00Z",
    },
    plan.version,
  );
  if (finished)
    session = await write(
      "put",
      `/api/v1/strength-workouts/${session.id}`,
      {
        title: session.title,
        notes: null,
        startedAt: session.startedAt,
        endedAt: "2026-10-14T16:00:00Z",
        linkedTimeBlockId: null,
        exercises: session.exercises.map((e) => ({
          id: e.id,
          exerciseId: e.exerciseId,
          sets: e.sets.map((s) => ({ id: s.id, reps: 8, completed: true })),
        })),
      },
      session.version,
    );
  return { plan, session };
}
async function details(page: Page) {
  await page.locator(".fitness-workout-details").waitFor({ state: "attached" });
  const correct = page.getByRole("button", {
    name: "Correct results",
    exact: true,
  });
  if (await correct.isVisible()) await correct.click();
  const element = page.locator(".fitness-workout-details");
  await expect(element).toBeVisible();
  if ((await element.getAttribute("open")) === null)
    await element.locator("summary").click();
}

test("invalid session fields survive refresh and navigation without saving or losing other edits", async ({
  page,
}) => {
  const { session } = await seed(page);
  const path = `/fitness/session/${session.id}`;
  await page.goto(path);
  await details(page);
  await page
    .getByRole("button", {
      name: "Expand Regression squat exercise",
      exact: true,
    })
    .click();
  const editResults = page.getByRole("button", {
    name: "Edit results",
    exact: true,
  });
  if (await editResults.isVisible()) await editResults.click();
  const reps = page.getByLabel("Actual reps", { exact: true }).first();
  const notes = page.getByLabel("Workout notes", { exact: true });
  await reps.fill("0");
  await notes.fill("Retain the rest of my workout");
  await page.reload();
  await details(page);
  await page
    .getByRole("button", {
      name: "Expand Regression squat exercise",
      exact: true,
    })
    .click();
  if (await editResults.isVisible()) await editResults.click();
  await expect(reps).toHaveValue("0");
  await expect(notes).toHaveValue("Retain the rest of my workout");
  await expect(page.locator(".fitness-save-state")).toHaveText(
    "Unsaved changes",
  );
  const persisted = await (
    await page.request.get(`/api/v1/strength-workouts/${session.id}`)
  ).json();
  expect(persisted.version).toBe(session.version);
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Calendar", exact: true })
    .click();
  await expect(page).not.toHaveURL(new RegExp(session.id));
  await page.goto(path);
  await details(page);
  await page
    .getByRole("button", {
      name: "Expand Regression squat exercise",
      exact: true,
    })
    .click();
  if (await editResults.isVisible()) await editResults.click();
  await expect(reps).toHaveValue("0");
  await expect(notes).toHaveValue("Retain the rest of my workout");
  await reps.fill("8");
  await expect(page.locator(".fitness-save-state")).toHaveText("Saved");
  const saved = await (
    await page.request.get(`/api/v1/strength-workouts/${session.id}`)
  ).json();
  expect(saved.exercises[0].sets[0].reps).toBe(8);
  expect(saved.notes).toBe("Retain the rest of my workout");
});

test("each invalid session timestamp blocks autosave independently and survives reload", async ({
  page,
}, testInfo) => {
  const { session } = await seed(page, true);
  await page.goto(`/fitness/session/${session.id}`);
  await details(page);
  const start = page.getByLabel("Started at", { exact: true });
  const end = page.getByLabel("Finished at", { exact: true });
  const status = page.locator(".fitness-save-state");
  let writes = 0;
  page.on("request", (req) => {
    if (
      req.method() === "PUT" &&
      req.url().endsWith(`/strength-workouts/${session.id}`)
    )
      writes++;
  });
  await start.fill("");
  await end.fill("");
  await end.fill("2026-10-14T16:30");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  // Wait beyond the 650ms debounce to prove the remaining invalid field blocks autosave.
  await page.waitForTimeout(900);
  expect(writes).toBe(0);
  await expect(start).toHaveAttribute("aria-invalid", "true");
  await expect(end).toHaveAttribute("aria-invalid", "false");
  await expect(status).toHaveText("Unsaved changes");
  await page.reload();
  await details(page);
  await expect(start).toHaveValue("");
  await expect(start).toHaveAttribute("aria-invalid", "true");
  await expect(end).toHaveValue("2026-10-14T16:30");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("invalid-session-time.png"),
    fullPage: true,
  });
  await start.fill("2026-10-14T14:55");
  await expect(status).toHaveText("Saved");
  expect(writes).toBe(1);
  await end.fill("");
  await start.fill("2026-10-14T14:50");
  await page.waitForTimeout(900);
  expect(writes).toBe(1);
  await expect(end).toHaveValue("");
  await expect(end).toHaveAttribute("aria-invalid", "true");
  await end.fill("2026-10-14T16:30");
  await expect(status).toHaveText("Saved");
  const saved = await (
    await page.request.get(`/api/v1/strength-workouts/${session.id}`)
  ).json();
  expect(Date.parse(saved.startedAt)).toBe(Date.parse("2026-10-14T14:50:00Z"));
  expect(Date.parse(saved.endedAt)).toBe(Date.parse("2026-10-14T16:30:00Z"));
});

test("invalid rest remains actionable when removing the following set in building and training", async ({
  page,
}, testInfo) => {
  const { plan, session } = await seed(page);
  await page.goto("/fitness");
  const me = await (await page.request.get("/api/v1/me")).json();
  for (const [path, saveLabel] of [
    [`/fitness/workout/${plan.id}`, "Save workout"],
    [`/fitness/session/${session.id}`, "Save changes"],
  ]) {
    // Current duration controls clamp valid entry. Exercise recovery of an invalid
    // stored value instead of depending on the retired raw-seconds control.
    await page.evaluate(
      ({ plan, session, userId, builder }) => {
        const exercises = session.exercises.map((e) => ({
          ...e,
          name: e.exerciseNameSnapshot,
          clientKey: e.id,
          sets: e.sets.map((set, index) => ({
            ...set,
            clientKey: set.id,
            restSeconds: index === 0 ? 4000 : null,
          })),
        }));
        if (builder)
          sessionStorage.setItem(
            `168hours:workout-builder:${userId}:${plan.id}`,
            JSON.stringify({
              format: 1,
              version: plan.version,
              draft: { title: plan.title, notes: "", exercises },
            }),
          );
        else
          sessionStorage.setItem(
            `168hours:strength-draft:${userId}:${session.id}`,
            JSON.stringify({
              version: session.version,
              input: {
                title: session.title,
                notes: session.notes,
                startedAt: session.startedAt,
                endedAt: session.endedAt,
                linkedTimeBlockId: session.linkedTimeBlockId,
                exercises,
              },
            }),
          );
      },
      {
        plan,
        session,
        userId: me.user.id,
        builder: saveLabel === "Save workout",
      },
    );
    await page.goto(path!);
    if (saveLabel === "Save changes")
      await page
        .getByRole("button", { name: "Edit workout", exact: true })
        .click();
    await expect(
      page.getByRole("heading", { name: "Regression squat", exact: true }),
    ).toBeVisible();
    const expand = page.getByRole("button", {
      name: "Expand Regression squat exercise",
      exact: true,
    });
    if (await expand.isVisible()) await expand.click();
    await page
      .getByRole("button", { name: "Remove set 2", exact: true })
      .click();
    await page.getByRole("button", { name: saveLabel!, exact: true }).click();
    await expect(
      page.getByText(/The last set has an invalid rest value/),
    ).toBeVisible();
    await expect(page.getByLabel("Rest seconds", { exact: true })).toHaveCount(
      0,
    );
    const clear = page.getByRole("button", {
      name: "Clear invalid rest",
      exact: true,
    });
    if (saveLabel === "Save workout") await expect(clear).toBeFocused();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`invalid-rest-${saveLabel}.png`),
      fullPage: true,
    });
    await clear.click();
    if (saveLabel === "Save workout") {
      await page.getByRole("button", { name: saveLabel, exact: true }).click();
      await expect(page).toHaveURL(/\/fitness$/);
    } else
      await expect(page.locator(".fitness-save-state")).toHaveText("Saved");
    const resource =
      saveLabel === "Save workout"
        ? `strength-plans/${plan.id}`
        : `strength-workouts/${session.id}`;
    const saved = await (await page.request.get(`/api/v1/${resource}`)).json();
    expect(saved.exercises[0].sets).toHaveLength(1);
    expect(saved.exercises[0].sets[0].restSeconds).toBeNull();
  }
});
