import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("routines are editable ordered checklists with saved progress", async ({
  page,
}) => {
  const headers = {
    Origin: "http://localhost:3100",
    "Idempotency-Key": randomUUID(),
  };
  expect(
    (
      await page.request.post("/api/__test/register", {
        headers,
        data: {
          name: "Routine test",
          email: `routines-${randomUUID()}@example.com`,
          password: "Synthetic-routine-password-123",
        },
      })
    ).status(),
  ).toBe(200);
  await page.goto("/routines");
  await expect(page.getByRole("heading", { name: "Routines" })).toBeVisible();
  await page.getByRole("button", { name: "Add routine" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Routine name").fill("Bedtime");
  await dialog
    .getByRole("textbox", { name: "Step 1", exact: true })
    .fill("Brush teeth");
  await dialog.getByRole("button", { name: "Add step" }).click();
  await dialog
    .getByRole("textbox", { name: "Step 2", exact: true })
    .fill("Read");
  await dialog.getByRole("button", { name: "Save routine" }).click();
  await expect(dialog).toHaveCount(0);
  const routine = page.getByRole("region", { name: "Bedtime" });
  await expect(routine).toBeVisible();
  await routine.getByRole("checkbox", { name: "Brush teeth" }).check();
  await expect(routine).toContainText("1 of 2 steps");
  await page.reload();
  await expect(
    routine.getByRole("checkbox", { name: "Brush teeth" }),
  ).toBeChecked();
  await routine.getByRole("checkbox", { name: "Read" }).check();
  await routine.getByRole("button", { name: "Finish routine" }).click();
  await expect(routine).toContainText("Completed 1 time");
  await expect(
    routine.getByRole("checkbox", { name: "Brush teeth" }),
  ).not.toBeChecked();
  await routine.getByRole("button", { name: "Edit" }).click();
  await dialog.getByRole("button", { name: "Move step 2 up" }).click();
  await dialog.getByRole("button", { name: "Save routine" }).click();
  await expect(routine.locator(".routine-steps li").first()).toContainText(
    "Read",
  );
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
});
