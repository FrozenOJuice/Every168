import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("exercise creation validates, protects changes and adds directly to a workout", async ({
  page,
}, testInfo) => {
  expect(
    (
      await page.request.post("/api/auth/sign-up/email", {
        headers: { Origin: "http://localhost:3100" },
        data: {
          name: "Exercise editor member",
          email: `editor-${randomUUID()}@example.com`,
          password: "Synthetic-editor-password-123",
        },
      })
    ).status(),
  ).toBe(200);
  await page.goto("/fitness");
  const library = page.getByRole("complementary", {
    name: "Exercise library panel",
  });
  await library
    .getByRole("button", { name: "Create exercise", exact: true })
    .click();
  const editor = page.getByRole("region", {
    name: "Create exercise",
    exact: true,
  });
  const name = editor.getByLabel("Exercise name", { exact: true });
  await expect(name).toBeFocused();
  await expect(editor.getByLabel("Instructions (optional)")).toBeVisible();
  await editor
    .getByRole("button", { name: "Create exercise", exact: true })
    .click();
  await expect(editor.getByText("Enter an exercise name.")).toBeVisible();
  await expect(name).toBeFocused();
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await name.fill("Cable variation");
  const create = editor.getByRole("button", {
    name: "Create exercise",
    exact: true,
  });
  const before = (await create.boundingBox())!;
  const equipment = editor.getByRole("combobox", {
    name: "Equipment",
    exact: true,
  });
  const muscles = editor.getByRole("combobox", {
    name: "Muscles worked",
    exact: true,
  });
  const e = (await equipment.boundingBox())!,
    m = (await muscles.boundingBox())!;
  if (testInfo.project.name === "desktop") expect(e.y).toBeCloseTo(m.y, 0);
  else expect(m.y).toBeGreaterThan(e.y);
  await equipment.fill("Cable");
  await equipment.press("Enter");
  await muscles.fill("Back");
  await muscles.press("Enter");
  await editor.getByLabel("Instructions (optional)").fill("Pull with control.");
  expect((await create.boundingBox())!.y).toBeCloseTo(before.y, 0);
  await editor.getByRole("button", { name: "Favourite", exact: true }).click();
  await editor.getByRole("button", { name: "Cancel", exact: true }).click();
  const discard = page.getByRole("dialog", {
    name: "Discard exercise changes?",
  });
  await expect(discard).toBeVisible();
  await discard
    .getByRole("button", { name: "Keep editing", exact: true })
    .click();
  await expect(name).toHaveValue("Cable variation");
  await expect(editor.getByLabel("Instructions (optional)")).toHaveValue(
    "Pull with control.",
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("create-exercise.png"),
    fullPage: true,
  });
  await create.click();
  await expect(editor).toHaveCount(0);
  const saved = await (
    await page.request.get("/api/v1/exercises?search=Cable%20variation")
  ).json();
  expect(saved.items[0]).toMatchObject({
    equipment: ["Cable"],
    muscles: ["Back"],
    notes: "Pull with control.",
    favourite: true,
  });
  await page
    .getByRole("button", { name: "Back to exercises", exact: true })
    .click();
  await library
    .getByRole("button", { name: "Create exercise", exact: true })
    .click();
  await name.fill("Discard this exercise");
  await editor.getByRole("button", { name: "Cancel", exact: true }).click();
  await discard
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  expect(
    (
      await (
        await page.request.get(
          "/api/v1/exercises?search=Discard%20this%20exercise",
        )
      ).json()
    ).items,
  ).toEqual([]);
  await page.getByRole("link", { name: "Create workout", exact: true }).click();
  const workout = page.getByRole("region", {
    name: "Workout workspace",
    includeHidden: true,
  });
  await workout
    .getByLabel("Workout title", { exact: true })
    .fill("Custom workout");
  if (testInfo.project.name === "phone")
    await workout
      .getByRole("button", { name: "Add exercise", exact: true })
      .click();
  await library
    .getByRole("button", { name: "Create exercise", exact: true })
    .click();
  await name.fill("Workout variation");
  await editor
    .getByRole("button", { name: "Create and add to workout", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  if (testInfo.project.name === "phone")
    await page
      .getByRole("button", { name: "Back to workout", exact: true })
      .click();
  await expect(
    workout.getByLabel("Workout title", { exact: true }),
  ).toHaveValue("Custom workout");
  await expect(
    workout.getByRole("heading", { name: "Workout variation", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
