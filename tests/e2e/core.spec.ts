import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";
import type { Block } from "@168hours/contracts";
import { randomUUID } from "node:crypto";
test("complete Core planning and tracking flow", async ({ page }, testInfo) => {
  async function loseFirstWriteResponse(path: string) {
    let lost = false;
    await page.route("**/api/v1/" + path, async (route) => {
      if (route.request().method() === "POST" && !lost) {
        lost = true;
        const committed = await route.fetch();
        expect(committed.status()).toBe(201);
        await route.abort("failed");
      } else await route.continue();
    });
  }
  await page.goto("/");
  await expect(page).toHaveURL(/login/);
  await page.getByRole("link", { name: "Create an account" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Browser member");
  await page
    .getByLabel("Email", { exact: true })
    .fill("browser-" + randomUUID() + "@example.com");
  await page
    .getByLabel("Password", { exact: true })
    .fill("Synthetic-browser-password-123");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByLabel("Timezone", { exact: true }).fill("America/Edmonton");
  await page.getByLabel("Weight & strength load").selectOption("lb");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.getByRole("status")).toContainText("Preferences saved");
  await page.getByRole("button", { name: "Add category" }).click();
  await page.getByLabel("Category name").fill("Learning");
  await page
    .getByRole("button", { name: "Create category", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "Week", exact: true }).click();
  await page.getByRole("button", { name: "Add block", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Read a chapter");
  await page
    .getByRole("dialog")
    .getByLabel("Category", { exact: true })
    .selectOption({ label: "Learning" });
  await page.getByRole("button", { name: "Create block", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Read a chapter/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Log actual", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Record time", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "Goals", exact: true }).click();
  await page.getByRole("button", { name: "Add goal", exact: true }).click();
  await page.getByLabel("Goal title").fill("Read a book");
  await page.getByLabel("Target date (optional)").fill("2026-12-31");
  await page
    .getByRole("dialog")
    .getByLabel("Category", { exact: true })
    .selectOption({ label: "Learning" });
  await page.getByRole("button", { name: "Create goal", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Read a book" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Week", exact: true }).click();
  await page.getByRole("button", { name: /Read a chapter/ }).click();
  await page
    .getByLabel("Goal (optional)")
    .selectOption({ label: "Read a book" });
  const linkedGoalId = await page.getByLabel("Goal (optional)").inputValue();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "Goals", exact: true }).click();
  await page.getByRole("button", { name: "Complete", exact: true }).click();
  await page.getByRole("button", { name: "completed", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Read a book" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Week", exact: true }).click();
  await page.getByRole("button", { name: /Read a chapter/ }).click();
  await expect(page.getByLabel("Goal (optional)")).toHaveValue(linkedGoalId);
  await page
    .getByLabel("Notes (optional)", { exact: true })
    .fill("Retain the completed goal link.");
  const savedBlock = page.waitForResponse(
    (response) =>
      response.url().includes("/api/v1/time-blocks/") &&
      response.request().method() === "PUT",
  );
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  const block = (await (await savedBlock).json()) as Block;
  expect(block.goalId).toBe(linkedGoalId);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: /Read a chapter/ }).click();
  await page
    .getByLabel("Notes (optional)", { exact: true })
    .fill("My unsaved notes");
  const elsewhere = await page.request.put("/api/v1/time-blocks/" + block.id, {
    headers: {
      Origin: "http://localhost:3100",
      "Idempotency-Key": randomUUID(),
      "If-Match": `"${block.version}"`,
    },
    data: {
      title: block.title,
      categoryId: block.categoryId,
      goalId: block.goalId,
      startsAt: block.startsAt,
      endsAt: block.endsAt,
      notes: "Saved elsewhere",
    },
  });
  expect(elsewhere.status()).toBe(200);
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "changed since you opened it",
  );
  await expect(
    page.getByLabel("Notes (optional)", { exact: true }),
  ).toHaveValue("My unsaved notes");
  await page
    .getByRole("button", { name: "Reload latest (discard edits)" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    (await (await page.request.get("/api/v1/time-blocks/" + block.id)).json())
      .notes,
  ).toBe("Saved elsewhere");
  await page.getByRole("link", { name: "Goals", exact: true }).click();
  await page.getByRole("button", { name: "completed", exact: true }).click();
  await page.getByRole("button", { name: "Reopen", exact: true }).click();
  await page.getByRole("link", { name: "Food", exact: true }).click();
  await page.getByRole("button", { name: "Add food", exact: true }).click();
  await page.getByLabel("Food name").fill("Test oats");
  await page.getByLabel("Serving amount", { exact: true }).fill("40");
  await page.getByLabel("Calories per serving (kcal)").fill("150");
  await page.getByLabel("Protein per serving (g)").fill("5");
  await page.getByRole("button", { name: "Create food", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Log food", exact: true }).click();
  await page
    .getByLabel("Saved food")
    .selectOption({ label: "Test oats · 40 g" });
  await page.getByLabel("Quantity (servings)").fill("2");
  await page.getByLabel("Meal", { exact: true }).selectOption("breakfast");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Log food", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("300 kcal", { exact: true })).toBeVisible();
  await expect(page.getByText(/unknown from 1 item/).first()).toBeVisible();
  await page.getByRole("button", { name: "Food library", exact: true }).click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Calories per serving (kcal)").fill("200");
  await page.getByRole("button", { name: "Save food", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Daily log", exact: true }).click();
  await expect(page.getByText("300 kcal", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Exercise", exact: true }).click();
  await page.getByRole("button", { name: "Add exercise", exact: true }).click();
  await page.getByLabel("Exercise name").fill("Squat");
  await page
    .getByRole("button", { name: "Create exercise", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Start workout", exact: true })
    .click();
  await page.getByLabel("Workout title").fill("Test strength");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Start workout", exact: true })
    .click();
  await expect(page).toHaveURL(/exercise\/workout/);
  await page.getByLabel("Saved exercise").selectOption({ label: "Squat" });
  await page
    .getByRole("button", { name: "Add to workout", exact: true })
    .click();
  await page.getByLabel("Reps", { exact: true }).fill("5");
  await page.getByLabel("Load (lb)").fill("100");
  await page.getByRole("button", { name: "Add set", exact: true }).click();
  await page.getByLabel("Reps", { exact: true }).nth(1).fill("6");
  await page.getByLabel("Load (lb)").nth(1).fill("90");
  await page
    .getByRole("button", { name: "Move set 2 up", exact: true })
    .click();
  await expect(page.getByLabel("Reps", { exact: true }).first()).toHaveValue(
    "6",
  );
  await page.getByRole("button", { name: "New exercise", exact: true }).click();
  await page.getByLabel("Exercise name", { exact: true }).fill("Plank");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create exercise", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("Saved exercise").selectOption({ label: "Plank" });
  await page
    .getByRole("button", { name: "Add to workout", exact: true })
    .click();
  await page.getByLabel("Time (seconds)").last().fill("60");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("link", { name: "Workout history", exact: true })
    .click();
  await expect(page).toHaveURL(/exercise\/workout/);
  await page.getByRole("button", { name: "Save workout", exact: true }).click();
  await expect(page.getByText("Changes saved.", { exact: true })).toBeVisible();
  await page
    .getByRole("link", { name: "Workout history", exact: true })
    .click();
  await page
    .getByRole("link", { name: "Continue workout", exact: true })
    .click();
  await expect(page.getByLabel("Reps", { exact: true }).first()).toHaveValue(
    "6",
  );
  await page
    .getByRole("button", { name: "Finish workout", exact: true })
    .click();
  await expect(
    page.getByText("Completed workout", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Workout history", exact: true })
    .click();
  await page.getByRole("button", { name: "Log cardio", exact: true }).click();
  await page.getByLabel("Activity type").selectOption("skip");
  await page.getByLabel("Activity title").fill("Test skipping");
  await page.getByLabel("Duration (minutes)").fill("12");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Log cardio", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Test skipping" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await loseFirstWriteResponse("water-entries");
  await page.getByRole("button", { name: "+ 250 ml", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "+ 500 ml", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Retry same change", exact: true })
    .click();
  await expect(page.getByText("250 ml", { exact: true })).toBeVisible();
  expect(
    (await (await page.request.get("/api/v1/water-entries")).json()).items,
  ).toHaveLength(1);
  await loseFirstWriteResponse("weight-entries");
  await page.getByRole("button", { name: "Log weight", exact: true }).click();
  await page.getByLabel("Weight (lb)").fill("154.3");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Log weight", exact: true })
    .click();
  await expect(page.getByLabel("Weight (lb)")).toBeDisabled();
  await page.getByRole("button", { name: "Retry save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("154.3 lb", { exact: true })).toBeVisible();
  expect(
    (await (await page.request.get("/api/v1/weight-entries")).json()).items,
  ).toHaveLength(1);
  await expect(
    page.getByRole("link", { name: "Test strength", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .locator(".health-section")
    .filter({
      has: page.getByRole("heading", { name: "Latest weight", exact: true }),
    })
    .getByRole("button", { name: "History", exact: true })
    .click();
  await expect(
    page.getByText("Recorded measurements (lb)", { exact: true }),
  ).toBeVisible();
  const historyAccessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(historyAccessibility.violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: testInfo.outputPath("dashboard.png"),
    fullPage: true,
  });
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.getByRole("link", { name: "Week", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Recorded this week" }),
  ).toBeVisible();
  await expect(page.getByText("Test skipping", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/login/);
});
