import { openCalendarPlan } from "./helpers/calendar-form";
import { randomUUID } from "node:crypto";
import { expect, test, type Locator } from "@playwright/test";

test.use({ actionTimeout: 10000 });
test("Fields keep a flush rounded focus ring across account, planning and Fitness forms", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const check = async (field: Locator) => {
    await field.scrollIntoViewIfNeeded();
    await field.focus();
    await expect(field).toBeFocused();
    const result = await field.evaluate((node) => {
      const host =
        node.closest(
          ".fitness-search, .fitness-select-option-search, .fitness-number-control, .fitness-notes-editor, .fitness-rest-disclosure, .password-field, .assistant-composer",
        ) ?? node;
      const css = getComputedStyle(host, host === node ? null : "::after");
      const rect = host.getBoundingClientRect();
      const clipped: string[] = [];
      for (
        let parent = host.parentElement;
        parent;
        parent = parent.parentElement
      ) {
        const style = getComputedStyle(parent);
        const box = parent.getBoundingClientRect();
        if (
          /(hidden|clip|auto|scroll)/.test(style.overflowX) &&
          (rect.left - 3 < box.left - 1 || rect.right + 3 > box.right + 1)
        )
          clipped.push(`${parent.className}:x`);
        if (
          /(hidden|clip|auto|scroll)/.test(style.overflowY) &&
          (rect.top - 3 < box.top - 1 || rect.bottom + 3 > box.bottom + 1)
        )
          clipped.push(`${parent.className}:y`);
      }
      return {
        composite: host !== node,
        shadow: css.boxShadow,
        border: css.borderTopWidth,
        top: css.top,
        radius: css.borderTopLeftRadius,
        clipped,
      };
    });
    expect(
      result.clipped,
      (await field.getAttribute("aria-label")) ??
        (await field.getAttribute("name")) ??
        "field",
    ).toEqual([]);
    if (result.composite) {
      expect(result.border).toBe("3px");
      expect(["-3px", "-4px"]).toContain(result.top);
    } else expect(result.shadow).toContain("0px 0px 0px 3px");
    expect(parseFloat(result.radius)).toBeGreaterThan(0);
  };
  const scan = async () => {
    const fields = page.locator(
      'input:not([type="checkbox"], [type="radio"], [type="range"], [type="hidden"]), textarea, select, .fitness-select-trigger',
    );
    await fields.filter({ visible: true }).first().waitFor();
    let count = 0;
    for (const field of await fields.all()) {
      if ((await field.isVisible()) && (await field.isEnabled())) {
        await check(field);
        count++;
      }
    }
    expect(count).toBeGreaterThan(0);
  };
  await page.goto("/signup");
  await scan();
  await page.getByLabel("Name", { exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Email", { exact: true })).toBeFocused();
  await expect(page.getByLabel("Email", { exact: true })).toHaveCSS(
    "outline-style",
    "none",
  );
  await page.getByLabel("Password", { exact: true }).click();
  await page.screenshot({ path: info.outputPath("password-focus.png") });
  const response = await page.request.post("/api/__test/register", {
    headers: {
      Origin: "http://localhost:3100",
      "Idempotency-Key": randomUUID(),
    },
    data: {
      name: "Focus check",
      email: `focus-${randomUUID()}@example.com`,
      password: "Synthetic-focus-password-123",
    },
  });
  expect(response.ok()).toBe(true);
  for (const path of [
    "/settings",
    "/tasks",
    "/fitness",
    "/fitness/workout/new",
    "/assistant",
  ]) {
    await page.goto(path);
    await expect(
      page.getByRole("navigation", { name: "Main navigation" }),
    ).toBeVisible();
    await scan();
    await page.screenshot({
      path: info.outputPath(`${path.replaceAll("/", "-")}-focus.png`),
    });
  }
  const post = async (path: string, data: object) => {
    const result = await page.request.post(path, {
      headers: {
        Origin: "http://localhost:3100",
        "Idempotency-Key": randomUUID(),
      },
      data,
    });
    expect(result.ok()).toBe(true);
    return result.json();
  };
  const exercise = await post("/api/v1/exercises", {
    name: "Focus press",
    loggingType: "reps_load",
  });
  const plan = await post("/api/v1/strength-plans", {
    title: "Focus workout",
    exercises: [
      {
        exerciseId: exercise.id,
        loggingType: "reps_load",
        sets: [
          { targetReps: 12, targetWeightKg: 50, restSeconds: 90 },
          { targetReps: 12, targetWeightKg: 50 },
        ],
      },
    ],
  });
  await page.goto(`/fitness/workout/${plan.id}`);
  await page
    .getByRole("button", { name: "Expand Focus press exercise", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Toggle workout notes", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Toggle exercise notes", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Rest between sets", exact: true })
    .click();
  await scan();
  await page.screenshot({ path: info.outputPath("basic-focus.png") });
  await page
    .getByRole("button", { name: "Target weight unit", exact: true })
    .click();
  await expect(
    page.getByRole("listbox", { name: "Target weight unit" }),
  ).toBeVisible();
  await scan();
  await page.keyboard.press("Escape");
  await page.goto("/");
  await openCalendarPlan(page);
  await page.getByLabel("Title", { exact: true }).waitFor();
  await scan();
  await page.screenshot({ path: info.outputPath("calendar-focus.png") });
  await page.emulateMedia({ forcedColors: "active" });
  const title = page.getByLabel("Title", { exact: true });
  await title.focus();
  await expect(title).toHaveCSS("outline-width", "3px");
  await expect(title).toHaveCSS("outline-offset", "0px");
});
