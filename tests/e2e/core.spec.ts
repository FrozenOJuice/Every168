import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";
import type { Block } from "@168hours/contracts";
import { randomUUID } from "node:crypto";
test("Core account, settings and planning flow", async ({ page }, testInfo) => {
  let createdBlock: Block | undefined;
  async function loseFirstWriteResponse(path: string) {
    let lost = false;
    await page.route("**/api/v1/" + path, async (route) => {
      if (route.request().method() === "POST" && !lost) {
        lost = true;
        const committed = await route.fetch();
        expect(committed.status()).toBe(201);
        if (path === "time-blocks") createdBlock = await committed.json();
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
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }).getByRole("link"),
  ).toHaveText(["Calendar", "Fitness"]);
  for (const route of ["/food", "/exercise", "/exercise/workout/retired"])
    expect((await page.request.get(route)).status()).toBe(404);
  await page.getByRole("button", { name: "Account menu" }).click();
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
  await page.screenshot({
    path: testInfo.outputPath("settings.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByLabel("Title", { exact: true }).fill("Read a chapter");
  await page.getByText("More details", { exact: true }).click();
  await expect(page.getByLabel("Category", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Goal (optional)")).toHaveCount(0);
  await loseFirstWriteResponse("time-blocks");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByLabel("Title", { exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Retry save", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Read a chapter.*planned/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Read a chapter.*planned/ }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: /Read a chapter.*planned/ })
    .dblclick();
  await page.getByText("More details", { exact: true }).click();
  await page.getByRole("dialog").getByText("Actions", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Log actual" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/goals");
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
  const goals = await (await page.request.get("/api/v1/goals")).json();
  const linkedGoal = goals.items.find(
    (goal: { title: string }) => goal.title === "Read a book",
  );
  const linkedGoalId = linkedGoal.id;
  const currentBlock: Block = await (
    await page.request.get("/api/v1/time-blocks/" + createdBlock!.id)
  ).json();
  const linkedResponse = await page.request.put(
    "/api/v1/time-blocks/" + createdBlock!.id,
    {
      headers: {
        Origin: "http://localhost:3100",
        "Idempotency-Key": randomUUID(),
        "If-Match": `"${currentBlock.version}"`,
      },
      data: {
        title: createdBlock!.title,
        startsAt: createdBlock!.startsAt,
        endsAt: createdBlock!.endsAt,
        categoryId: linkedGoal.categoryId,
        goalId: linkedGoalId,
        notes: null,
      },
    },
  );
  expect(linkedResponse.status()).toBe(200);
  await page.goto("/goals");
  await page.getByRole("button", { name: "Complete", exact: true }).click();
  await page.getByRole("button", { name: "completed", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Read a book" }),
  ).toBeVisible();
  // The reference fixture changed the block through the API outside the client cache.
  await page.goto("/");
  await page
    .getByRole("button", { name: /Read a chapter.*planned/ })
    .dblclick();
  await page.getByText("More details", { exact: true }).click();
  await expect(page.getByLabel("Category", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Goal (optional)")).toHaveCount(0);
  await page
    .getByLabel("Notes (optional)", { exact: true })
    .fill("Calendar notes.");
  const savedBlock = page.waitForResponse(
    (response) =>
      response.url().includes("/api/v1/time-blocks/") &&
      response.request().method() === "PUT",
  );
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const savedResponse = await savedBlock;
  expect(savedResponse.status()).toBe(200);
  const block = (await savedResponse.json()) as Block;
  expect(block.goalId).toBe(linkedGoalId);
  expect(block.categoryId).toBe(linkedGoal.categoryId);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("button", { name: /Read a chapter.*planned/ })
    .dblclick();
  await page.getByText("More details", { exact: true }).click();
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
  await page.getByRole("button", { name: "Save", exact: true }).click();
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
  await page.goto("/goals");
  // The preceding reload can cause a full navigation. Wait for client data before clicking server-rendered controls.
  await expect(page.getByText(/^No active goals yet\./)).toBeVisible();
  await page.getByRole("button", { name: "completed", exact: true }).click();
  await page.getByRole("button", { name: "Reopen", exact: true }).click();
  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  await expect(
    page.getByRole("region", { name: "Weekly time grid" }),
  ).toBeVisible();
  await expect(page).toHaveTitle("168Hours");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: testInfo.outputPath("calendar.png"),
    fullPage: true,
  });
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  await page.getByRole("link", { name: "Day", exact: true }).click();
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/login/);
});
