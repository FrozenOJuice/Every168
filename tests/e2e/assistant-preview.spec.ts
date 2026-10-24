import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function signUp(page: Page) {
  const response = await page.request.post("/api/auth/sign-up/email", {
    headers: { Origin: "http://localhost:3100" },
    data: {
      name: "Assistant preview",
      email: `assistant-${randomUUID()}@example.com`,
      password: "Synthetic-assistant-password-123",
    },
  });
  expect(response.ok()).toBe(true);
  const me = await (await page.request.get("/api/v1/me")).json();
  expect(
    (
      await page.request.put("/api/v1/preferences", {
        headers: {
          Origin: "http://localhost:3100",
          "Idempotency-Key": randomUUID(),
          "If-Match": `"${me.preferences.version}"`,
        },
        data: {
          timezone: "America/Edmonton",
          weekStartsOn: 1,
          weightUnit: "kg",
          distanceUnit: "km",
        },
      })
    ).ok(),
  ).toBe(true);
}
const popup = (page: Page) =>
  page.getByRole("dialog", { name: "Assistant Preview", exact: true });
const launcher = (page: Page) =>
  page.getByRole("button", { name: "Ask Assistant", exact: true });
const message = (page: Page) =>
  page.getByRole("textbox", { name: "Message Assistant", exact: true });
const context = (page: Page) =>
  page.getByRole("group", { name: "Conversation context", exact: true });

test("quick chat hands its draft and frozen workout context to Assistant and returns to recovered edits", async ({
  page,
}, info) => {
  await signUp(page);
  const response = await page.request.post("/api/v1/exercises", {
    headers: {
      Origin: "http://localhost:3100",
      "Idempotency-Key": randomUUID(),
    },
    data: { name: "Substitution practice" },
  });
  expect(response.ok()).toBe(true);
  const exercise = await response.json();
  const origin = `/fitness/workout/new?exercise=${exercise.id}&date=2026-10-24`;
  await page.goto(origin);
  await page
    .getByLabel("Workout title", { exact: true })
    .fill("Keep this unsaved workout");
  await page.getByLabel("Sets", { exact: true }).fill("3");
  await page.getByLabel("Target reps", { exact: true }).fill("12");
  await page.getByLabel("Target load (kg)", { exact: true }).fill("80");
  const writes: string[] = [];
  page.on("request", (request) => {
    if (
      new URL(request.url()).pathname.startsWith("/api/") &&
      !["GET", "HEAD", "OPTIONS"].includes(request.method())
    )
      writes.push(request.url());
  });
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }).getByRole("link"),
  ).toHaveText(["Calendar", "Fitness", "Food", "Tasks", "Assistant"]);
  await expect(launcher(page)).toBeVisible();
  const launchBox = (await launcher(page).boundingBox())!;
  const saveBox = (await page
    .getByRole("button", { name: "Save workout", exact: true })
    .boundingBox())!;
  if (info.project.name === "phone")
    expect(launchBox.y + launchBox.height).toBeLessThan(saveBox.y);
  await launcher(page).click();
  await expect(context(page)).toContainText("Fitness · Workout editor");
  await expect(context(page)).toContainText("Oct 24, 2026");
  await expect(
    popup(page).getByRole("button", { name: "Send message", exact: true }),
  ).toBeDisabled();
  expect(
    await popup(page).evaluate((element) => element.matches(":modal")),
  ).toBe(info.project.name === "phone");
  const popupBox = (await popup(page).boundingBox())!;
  if (info.project.name === "phone") {
    await expect(
      popup(page).getByRole("button", { name: "Move quick chat", exact: true }),
    ).toHaveCount(0);
    await expect(
      popup(page).getByRole("button", {
        name: "Resize quick chat",
        exact: true,
      }),
    ).toHaveCount(0);
  }
  expect(popupBox.height).toBeLessThan(page.viewportSize()!.height);
  if (info.project.name !== "phone")
    expect(popupBox.width).toBeLessThanOrEqual(400);
  await page.screenshot({
    path: info.outputPath("assistant-quick-workout.png"),
  });
  await popup(page)
    .getByRole("button", { name: "Help me adapt this workout", exact: true })
    .click();
  await expect(message(page)).toHaveValue("Help me adapt this workout");
  await message(page).fill(
    "They don’t have this equipment.\nWhat could I substitute?",
  );
  await message(page).hover();
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(popup(page)).toHaveCount(0);
  await expect(launcher(page)).toBeFocused();
  await expect(page.getByLabel("Workout title", { exact: true })).toHaveValue(
    "Keep this unsaved workout",
  );
  await launcher(page).click();
  await popup(page)
    .getByRole("link", { name: "Open in Assistant", exact: true })
    .click();
  await expect(page).toHaveURL(/\/assistant$/);
  await expect(
    page.getByRole("heading", { name: "Assistant", exact: true, level: 1 }),
  ).toBeVisible();
  await expect(popup(page)).toHaveCount(0);
  await expect(launcher(page)).toHaveCount(0);
  await expect(message(page)).toHaveValue(
    "They don’t have this equipment.\nWhat could I substitute?",
  );
  await expect(context(page)).toContainText("Fitness · Workout editor");
  await expect(
    page.getByRole("link", { name: "Assistant", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await message(page).evaluate((element: HTMLTextAreaElement) => {
    element.focus();
    element.setSelectionRange(element.value.length, element.value.length);
  });
  await message(page).press("Enter");
  await message(page).pressSequentially("Prefer dumbbells.");
  await expect(message(page)).toHaveValue(
    "They don’t have this equipment.\nWhat could I substitute?\nPrefer dumbbells.",
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: info.outputPath("assistant-workspace.png") });
  await page
    .getByRole("link", { name: "Return to workout", exact: true })
    .click();
  await expect(page).toHaveURL(
    new RegExp(
      `/fitness/workout/new\\?exercise=${exercise.id}&date=2026-10-24$`,
    ),
  );
  await expect(page.getByLabel("Workout title", { exact: true })).toHaveValue(
    "Keep this unsaved workout",
  );
  await expect(page.getByLabel("Sets", { exact: true })).toHaveValue("3");
  await expect(page.getByLabel("Target reps", { exact: true })).toHaveValue(
    "12",
  );
  await expect(
    page.getByLabel("Target load (kg)", { exact: true }),
  ).toHaveValue("80");
  // Recovery notices and fixed save controls stay clear of the launcher.
  const recovered = page.locator(".app-toast");
  await expect(recovered).toBeVisible();
  const toastBox = (await recovered.boundingBox())!,
    recoveredLaunch = (await launcher(page).boundingBox())!;
  expect(recoveredLaunch.y + recoveredLaunch.height).toBeLessThanOrEqual(
    toastBox.y,
  );
  await launcher(page).click();
  await expect(message(page)).toHaveValue(
    "They don’t have this equipment.\nWhat could I substitute?\nPrefer dumbbells.",
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await popup(page)
    .getByRole("button", { name: "Close quick chat", exact: true })
    .click();
  expect(writes).toEqual([]);
  // Without recoverable browser storage, the handoff must leave the workout in place.
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new Error("Synthetic unavailable storage");
    };
  });
  await page
    .getByLabel("Workout title", { exact: true })
    .fill("Unrecoverable edit stays here");
  await launcher(page).click();
  await popup(page)
    .getByRole("link", { name: "Open in Assistant", exact: true })
    .click();
  await expect(popup(page)).toBeVisible();
  await expect(page).not.toHaveURL(/\/assistant$/);
  await popup(page)
    .getByRole("button", { name: "Close quick chat", exact: true })
    .click();
  await expect(page.getByLabel("Workout title", { exact: true })).toHaveValue(
    "Unrecoverable edit stays here",
  );
});

test("quick chat moves, resizes, cancels and retains a reachable layout", async ({
  page,
}, info) => {
  test.skip(info.project.name === "phone", "Phones retain the bottom sheet.");
  await signUp(page);
  await page.goto("/food?date=2026-10-24");
  await launcher(page).click();
  await message(page).fill("Keep my draft while moving");
  const originalViewport = page.viewportSize()!;
  const original = (await popup(page).boundingBox())!;
  const title = popup(page).getByRole("heading", {
    name: "Assistant",
    exact: true,
  });
  const move = async (dx: number, dy: number, release = true) => {
    const box = (await title.boundingBox())!;
    const x = box.x + box.width / 2,
      y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy, { steps: 8 });
    if (release) await page.mouse.up();
  };
  await move(-150, -60);
  const moved = (await popup(page).boundingBox())!;
  expect(moved.x).toBeCloseTo(Math.max(8, original.x - 150), 0);
  expect(moved.y).toBeCloseTo(Math.max(8, original.y - 60), 0);
  await popup(page)
    .getByRole("button", { name: "Close quick chat", exact: true })
    .click();
  await launcher(page).click();
  expect(await popup(page).boundingBox()).toEqual(moved);
  await expect(message(page)).toHaveValue("Keep my draft while moving");
  const resize = popup(page).getByRole("button", {
    name: "Resize quick chat",
    exact: true,
  });
  const handle = (await resize.boundingBox())!;
  await page.mouse.move(
    handle.x + handle.width / 2,
    handle.y + handle.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    handle.x + handle.width / 2 + 80,
    handle.y + handle.height / 2 + 60,
    { steps: 8 },
  );
  await page.mouse.up();
  const resized = (await popup(page).boundingBox())!;
  expect(resized.width).toBeCloseTo(moved.width + 80, 0);
  expect(resized.height).toBeCloseTo(moved.height + 60, 0);
  await move(-2000, -2000);
  const bounded = (await popup(page).boundingBox())!;
  expect(bounded.x).toBe(8);
  expect(bounded.y).toBe(8);
  await move(100, 60, false);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(popup(page)).toBeVisible();
  expect(await popup(page).boundingBox()).toEqual(bounded);
  await move(80, 40, false);
  await popup(page)
    .locator(".assistant-heading")
    .dispatchEvent("pointercancel", { pointerId: 1 });
  await page.mouse.up();
  expect(await popup(page).boundingBox()).toEqual(bounded);
  await resize.focus();
  await resize.press("ArrowRight");
  await resize.press("Shift+ArrowDown");
  const larger = (await popup(page).boundingBox())!;
  expect(larger.width).toBeCloseTo(bounded.width + 10, 0);
  expect(larger.height).toBeCloseTo(
    Math.min(originalViewport.height - 16, bounded.height + 40),
    0,
  );
  const moveControl = popup(page).getByRole("button", {
    name: "Move quick chat",
    exact: true,
  });
  await moveControl.focus();
  await moveControl.press("ArrowRight");
  const remembered = (await popup(page).boundingBox())!;
  expect(remembered.x).toBe(18);
  await page.setViewportSize({ width: 650, height: 480 });
  await expect
    .poll(async () => {
      const box = (await popup(page).boundingBox())!;
      return box.y + box.height;
    })
    .toBeLessThanOrEqual(472);
  const fitted = (await popup(page).boundingBox())!;
  expect(fitted.x).toBeGreaterThanOrEqual(8);
  expect(fitted.y).toBeGreaterThanOrEqual(8);
  expect(fitted.x + fitted.width).toBeLessThanOrEqual(642);
  expect(fitted.y + fitted.height).toBeLessThanOrEqual(472);
  await page.setViewportSize({ width: 390, height: 664 });
  await expect(popup(page)).toHaveAttribute("aria-modal", "true");
  await expect(moveControl).toHaveCount(0);
  await expect(resize).toHaveCount(0);
  await page.setViewportSize(originalViewport);
  await expect(popup(page)).not.toHaveAttribute("aria-modal", "true");
  expect(await popup(page).boundingBox()).toEqual(remembered);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await message(page).hover();
  await page.screenshot({
    path: info.outputPath("assistant-moved-resized.png"),
  });
  await popup(page)
    .getByRole("button", {
      name: "Reset quick chat position and size",
      exact: true,
    })
    .click();
  expect(await popup(page).boundingBox()).toEqual(original);
  await expect(message(page)).toHaveValue("Keep my draft while moving");
  await expect(context(page)).toContainText("Food · Daily log");
  await popup(page)
    .getByRole("link", { name: "Open in Assistant", exact: true })
    .click();
  await expect(page).toHaveURL(/\/assistant$/);
  await page.getByRole("link", { name: "Return to Food", exact: true }).click();
  await launcher(page).click();
  expect(await popup(page).boundingBox()).toEqual(original);
  await expect(message(page)).toHaveValue("Keep my draft while moving");
});

test("context is pinned across navigation and can be explicitly replaced, removed and restored", async ({
  page,
}, info) => {
  await signUp(page);
  await page.clock.install({ time: new Date("2026-10-25T02:00:00Z") });
  await page.goto("/food?date=2030-08-15");
  await launcher(page).click();
  await expect(context(page)).toContainText("Food · Daily log");
  await expect(context(page)).toContainText("Aug 15, 2030");
  await message(page).fill("Keep this conversation context");
  if (info.project.name === "phone")
    await popup(page)
      .getByRole("button", { name: "Close quick chat", exact: true })
      .click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Tasks", exact: true })
    .click();
  if (info.project.name === "phone") await launcher(page).click();
  await expect(context(page)).toContainText("Food · Daily log");
  await expect(context(page)).not.toContainText("Tasks");
  await popup(page)
    .getByRole("button", { name: "Use current page", exact: true })
    .click();
  await expect(context(page)).toContainText("Tasks · Inbox");
  await popup(page)
    .getByRole("button", { name: "Remove context", exact: true })
    .click();
  await expect(context(page)).not.toContainText("Tasks · Inbox");
  await popup(page)
    .getByRole("link", { name: "Open in Assistant", exact: true })
    .click();
  await expect(
    page.getByRole("link", { name: "Return to Tasks", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add page context", exact: true })
    .click();
  await expect(context(page)).toContainText("Tasks · Inbox");
  await expect(message(page)).toHaveValue("Keep this conversation context");
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Calendar", exact: true })
    .click();
  await launcher(page).click();
  await expect(context(page)).toContainText("Tasks · Inbox");
  await popup(page)
    .getByRole("button", { name: "Use current page", exact: true })
    .click();
  await expect(context(page)).toContainText("Calendar · Week");
  await expect(context(page)).toContainText("Oct 24, 2026");
  await popup(page)
    .getByRole("link", { name: "Open in Assistant", exact: true })
    .click();
  await expect(page).toHaveURL(/\/assistant$/);
  await page.reload();
  await expect(message(page)).toHaveValue("");
  await expect(context(page)).toHaveCount(0);
  await expect(page.getByRole("link", { name: /^Return to / })).toHaveCount(0);
  await expect(launcher(page)).toHaveCount(0);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("quick chat remains available inside a modal editor and honors cancelled navigation", async ({
  page,
}, info) => {
  await signUp(page);
  await page.goto("/food?view=food&date=2026-10-24");
  await page.getByRole("button", { name: "Create food", exact: true }).click();
  const foodDialog = page.getByRole("dialog", {
    name: "Create food",
    exact: true,
  });
  await foodDialog
    .getByLabel("Food name", { exact: true })
    .fill("Keep this unsaved food");
  await launcher(page).click();
  await expect(popup(page)).toBeVisible();
  expect(
    await popup(page).evaluate((element) => element.matches(":modal")),
  ).toBe(true);
  await message(page).fill("Help me with this food");
  await message(page).hover();
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(popup(page)).toHaveCount(0);
  await expect(foodDialog).toBeVisible();
  await expect(foodDialog.getByLabel("Food name", { exact: true })).toHaveValue(
    "Keep this unsaved food",
  );
  await expect(launcher(page)).toBeFocused();
  await launcher(page).click();
  page.once("dialog", (dialog) => dialog.dismiss());
  await popup(page)
    .getByRole("link", { name: "Open in Assistant", exact: true })
    .click();
  await expect(popup(page)).toBeVisible();
  await expect(page).toHaveURL(/\/food\?/);
  await expect(message(page)).toHaveValue("Help me with this food");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: info.outputPath("assistant-in-editor.png") });
  page.once("dialog", (dialog) => dialog.accept());
  await popup(page)
    .getByRole("link", { name: "Open in Assistant", exact: true })
    .click();
  await expect(page).toHaveURL(/\/assistant$/);
  await expect(message(page)).toHaveValue("Help me with this food");
  await expect(context(page)).toContainText("Food · Food library");
  await expect(
    page.getByRole("link", { name: "Return to Food", exact: true }),
  ).toBeVisible();
  await expect(page.locator("dialog:modal")).toHaveCount(0);
});
