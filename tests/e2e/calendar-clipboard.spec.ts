import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("copy selected days with gaps and paste one block at a selected time", async ({
  page,
}, testInfo) => {
  const headers = () => ({
    Origin: "http://localhost:3100",
    "Idempotency-Key": randomUUID(),
  });
  expect(
    (
      await page.request.post("/api/auth/sign-up/email", {
        headers: headers(),
        data: {
          name: "Clipboard test",
          email: `clip-${randomUUID()}@example.com`,
          password: "Synthetic-calendar-password-123",
        },
      })
    ).status(),
  ).toBe(200);
  for (const [title, day] of [
    ["Monday shift", "07"],
    ["Thursday shift", "10"],
    ["Existing target", "15"],
  ]) {
    expect(
      (
        await page.request.post("/api/v1/time-blocks", {
          headers: headers(),
          data: {
            title,
            startsAt: `2026-09-${day}T15:00:00Z`,
            endsAt: `2026-09-${day}T16:00:00Z`,
          },
        })
      ).status(),
    ).toBe(201);
  }
  await page.goto("/?date=2026-09-07&view=month");
  const month = page.getByRole("region", { name: "Monthly calendar" });
  const day = (date: string) =>
    month.locator(`[data-date="${date}"] .month-select-day`);
  async function clickDay(date: string, modifiers: ("Meta" | "Shift")[] = []) {
    const bounds = await day(date).boundingBox();
    expect(bounds).toBeTruthy();
    await day(date).click({
      modifiers,
      position: { x: bounds!.width - 7, y: 7 },
    });
  }
  await clickDay("2026-09-07");
  await clickDay("2026-09-10", ["Meta"]);
  await expect(day("2026-09-07")).toHaveAttribute("aria-pressed", "true");
  await expect(day("2026-09-10")).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Meta+c");
  await clickDay("2026-09-15");
  await page.keyboard.press("Meta+v");
  const dialog = page.getByRole("dialog", { name: "Paste plans" });
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".calendar-notice")).toContainText("Plans pasted");
  await expect(day("2026-09-15")).toHaveAttribute(
    "aria-label",
    "Select 2026-09-15, 2 records",
  );
  await expect(day("2026-09-18")).toHaveAttribute(
    "aria-label",
    "Select 2026-09-18, 1 records",
  );
  if (testInfo.project.name !== "phone") {
    await expect(month.locator('[data-date="2026-09-15"]')).toContainText(
      "Monday shift",
    );
    await expect(month.locator('[data-date="2026-09-15"]')).toContainText(
      "Existing target",
    );
  }
  await page.keyboard.press("Meta+z");
  await expect(day("2026-09-15")).toHaveAttribute(
    "aria-label",
    "Select 2026-09-15, 1 records",
  );
  await expect(day("2026-09-18")).toHaveAttribute(
    "aria-label",
    "Select 2026-09-18, 0 records",
  );

  await clickDay("2026-09-07");
  await clickDay("2026-09-10", ["Shift"]);
  for (const date of ["07", "08", "09", "10"])
    await expect(day(`2026-09-${date}`)).toHaveAttribute(
      "aria-pressed",
      "true",
    );

  const first = await day("2026-09-20").boundingBox();
  const last = await day("2026-09-22").boundingBox();
  expect(first && last).toBeTruthy();
  await page.mouse.move(
    first!.x + first!.width / 2,
    first!.y + first!.height / 2,
  );
  await page.mouse.down();
  await expect(day("2026-09-20")).toHaveAttribute("aria-pressed", "true");
  await expect(day("2026-09-07")).toHaveAttribute("aria-pressed", "false");
  await page.mouse.move(last!.x + last!.width / 2, last!.y + last!.height / 2, {
    steps: 8,
  });
  await page.mouse.up();
  for (const date of ["20", "21", "22"])
    await expect(day(`2026-09-${date}`)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  await clickDay("2026-09-25");
  await expect(day("2026-09-25")).toHaveAttribute("aria-pressed", "true");
  for (const date of ["20", "21", "22"])
    await expect(day(`2026-09-${date}`)).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  await clickDay("2026-09-25", ["Meta"]);
  await expect(day("2026-09-25")).toHaveAttribute("aria-pressed", "false");
  await expect(month.locator('[data-date="2026-09-25"]')).not.toHaveClass(
    /is-selected/,
  );
  await page.keyboard.press("Meta+v");
  await expect(page.locator(".calendar-notice")).toContainText(
    "Select a destination day first.",
  );
  await clickDay("2026-09-26", ["Shift"]);
  await expect(day("2026-09-25")).toHaveAttribute("aria-pressed", "false");
  await expect(day("2026-09-26")).toHaveAttribute("aria-pressed", "true");

  await clickDay("2026-09-25");
  await clickDay("2026-09-26", ["Meta"]);
  await clickDay("2026-09-26", ["Meta"]);
  await expect(day("2026-09-26")).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("Meta+v");
  await expect(day("2026-09-25")).toHaveAttribute(
    "aria-label",
    "Select 2026-09-25, 1 records",
  );
  await expect(day("2026-09-26")).toHaveAttribute(
    "aria-label",
    "Select 2026-09-26, 0 records",
  );
  await page.keyboard.press("Meta+z");

  await page.goto("/?date=2026-09-07&view=week");
  const weekDay = page.getByRole("button", { name: "Select 2026-09-08" });
  await weekDay.click();
  await expect(weekDay).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/view=week/);
  const weekStart = page.getByRole("button", { name: "Select 2026-09-07" });
  const weekEndDate = testInfo.project.name === "phone" ? "08" : "09";
  const weekEnd = page.getByRole("button", {
    name: `Select 2026-09-${weekEndDate}`,
  });
  const weekStartBounds = await weekStart.boundingBox();
  const weekEndBounds = await weekEnd.boundingBox();
  expect(weekStartBounds && weekEndBounds).toBeTruthy();
  await page.mouse.move(
    weekStartBounds!.x + weekStartBounds!.width / 2,
    weekStartBounds!.y + weekStartBounds!.height / 2,
  );
  await page.mouse.down();
  await expect(weekStart).toHaveAttribute("aria-pressed", "true");
  await expect(weekDay).toHaveAttribute("aria-pressed", "false");
  await page.mouse.move(
    weekEndBounds!.x + weekEndBounds!.width / 2,
    weekEndBounds!.y + weekEndBounds!.height / 2,
    { steps: 8 },
  );
  await page.mouse.up();
  for (const weekDate of weekEndDate === "08"
    ? ["07", "08"]
    : ["07", "08", "09"])
    await expect(
      page.getByRole("button", { name: `Select 2026-09-${weekDate}` }),
    ).toHaveAttribute("aria-pressed", "true");
  await weekDay.click();
  await expect(weekDay).toHaveAttribute("aria-pressed", "true");
  await expect(weekStart).toHaveAttribute("aria-pressed", "false");
  await expect(page).toHaveURL(/view=week/);
  if (testInfo.project.name === "phone") {
    const start = await weekStart.boundingBox();
    const viewport = await page.locator(".calendar-scroll").boundingBox();
    expect(start && viewport).toBeTruthy();
    await page.mouse.move(
      start!.x + start!.width / 2,
      start!.y + start!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      viewport!.x + viewport!.width - 12,
      start!.y + start!.height / 2,
      { steps: 8 },
    );
    await expect(
      page.getByRole("button", { name: "Select 2026-09-13" }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.mouse.up();
    for (const dateOfWeek of ["07", "08", "09", "10", "11", "12", "13"])
      await expect(
        page.getByRole("button", { name: `Select 2026-09-${dateOfWeek}` }),
      ).toHaveAttribute("aria-pressed", "true");
    const sunday = page.getByRole("button", { name: "Select 2026-09-13" });
    await sunday.click();
    await expect(weekStart).toHaveAttribute("aria-pressed", "false");
    const sundayBounds = await sunday.boundingBox();
    expect(sundayBounds).toBeTruthy();
    await page.mouse.move(
      sundayBounds!.x + sundayBounds!.width / 2,
      sundayBounds!.y + sundayBounds!.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(
      viewport!.x + 70,
      sundayBounds!.y + sundayBounds!.height / 2,
      { steps: 8 },
    );
    await expect(weekStart).toHaveAttribute("aria-pressed", "true");
    await page.mouse.up();
  }
  await weekDay.dblclick();
  await expect(page).toHaveURL(/date=2026-09-08&view=day/);
  await page.goto("/?date=2026-09-07&view=week");
  await weekDay.focus();
  await page.keyboard.press("Space");
  await expect(weekDay).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(/view=week/);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/date=2026-09-08&view=day/);

  await page.goto("/?date=2026-09-07&view=day");
  const grid = page.getByRole("region", { name: "Daily time grid" });
  const dayHeading = grid.getByRole("button", {
    name: "Select 2026-09-07",
  });
  await expect(dayHeading).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("Meta+c");
  await page.goto("/?date=2026-09-20&view=month");
  await clickDay("2026-09-20");
  await page.keyboard.press("Meta+v");
  await expect(day("2026-09-20")).toHaveAttribute(
    "aria-label",
    "Select 2026-09-20, 1 records",
  );
  await page
    .locator(".calendar-notice")
    .getByRole("button", { name: "Undo" })
    .click();
  await expect(day("2026-09-20")).toHaveAttribute(
    "aria-label",
    "Select 2026-09-20, 0 records",
  );
  await page.goto("/?date=2026-09-07&view=day");
  const dayHeadingBounds = await dayHeading.boundingBox();
  expect(dayHeadingBounds).toBeTruthy();
  await page.mouse.move(
    dayHeadingBounds!.x + dayHeadingBounds!.width / 2,
    dayHeadingBounds!.y + dayHeadingBounds!.height / 2,
  );
  await page.mouse.down();
  await expect(dayHeading).toHaveAttribute("aria-pressed", "true");
  await expect(grid.locator(".grid-day-heading")).toHaveClass(/is-selected/);
  await page.mouse.up();
  await page.keyboard.press("Meta+c");
  await page.goto("/?date=2026-09-20&view=day");
  const destinationHeading = grid.getByRole("button", {
    name: "Select 2026-09-20",
  });
  await expect(destinationHeading).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("Meta+v");
  await expect(page.locator("[data-calendar-clipboard-status]")).toHaveText(
    "Select the day heading before pasting.",
  );
  await expect(dialog).toHaveCount(0);
  await destinationHeading.click();
  await page.keyboard.press("Meta+v");
  await expect(
    grid.getByRole("button", { name: /Monday shift.*planned/ }),
  ).toBeVisible();
  await page.keyboard.press("Meta+z");
  await page.goto("/?date=2026-09-20&view=month");
  await clickDay("2026-09-20");
  await page.keyboard.press("Meta+v");
  await expect(day("2026-09-20")).toHaveAttribute(
    "aria-label",
    "Select 2026-09-20, 1 records",
  );
  await page.keyboard.press("Meta+z");
  await page.goto("/?date=2026-09-07&view=day");
  await grid.getByRole("button", { name: /Monday shift.*planned/ }).click();
  await page.keyboard.press("Meta+c");
  await page.goto("/?date=2026-09-07&view=month");
  await clickDay("2026-09-07");
  await page.keyboard.press("Meta+v");
  await expect(page.locator("[data-calendar-clipboard-status]")).toHaveText(
    "Plans pasted",
  );
  await expect(day("2026-09-07")).toHaveAttribute(
    "aria-label",
    "Select 2026-09-07, 2 records",
  );
  await page.keyboard.press("Meta+z");
  await expect(day("2026-09-07")).toHaveAttribute(
    "aria-label",
    "Select 2026-09-07, 1 records",
  );
  await page.goto("/?date=2026-09-16&view=day");
  const timedDestinationHeading = grid.getByRole("button", {
    name: "Select 2026-09-16",
  });
  await expect(timedDestinationHeading).toBeVisible();
  await page.keyboard.press("Meta+v");
  await expect(page.locator("[data-calendar-clipboard-status]")).toHaveText(
    "Select the day heading or a five-minute time slice first.",
  );
  await timedDestinationHeading.click();
  await page.keyboard.press("Meta+v");
  await expect(
    grid.getByRole("button", { name: /Monday shift.*planned/ }),
  ).toBeVisible();
  await page.keyboard.press("Meta+z");
  await expect(
    grid.getByRole("button", { name: /Monday shift.*planned/ }),
  ).toHaveCount(0);
  await grid
    .getByRole("button", { name: "Select time on 2026-09-16 at 10:00" })
    .click({ position: { x: 20, y: 11 } });
  await expect(page.locator("[data-selected-time]")).toHaveAttribute(
    "data-selected-time",
    "2026-09-16T10:10",
  );
  await page.keyboard.press("Meta+v");
  await expect(
    grid.getByRole("button", { name: /Monday shift.*planned/ }),
  ).toBeVisible();
  await page.keyboard.press("Meta+z");
  await expect(
    grid.getByRole("button", { name: /Monday shift.*planned/ }),
  ).toHaveCount(0);
});

test("a copied block keeps its captured details after the source changes and is deleted", async ({
  page,
}) => {
  const headers = () => ({
    Origin: "http://localhost:3100",
    "Idempotency-Key": randomUUID(),
  });
  expect(
    (
      await page.request.post("/api/auth/sign-up/email", {
        headers: headers(),
        data: {
          name: "Clipboard snapshot test",
          email: `snapshot-${randomUUID()}@example.com`,
          password: "Synthetic-calendar-password-123",
        },
      })
    ).status(),
  ).toBe(200);
  const original = {
    title: "Original plan",
    notes: "Notes at copy time",
    startsAt: "2026-09-07T15:00:00Z",
    endsAt: "2026-09-07T16:00:00Z",
  };
  const createdResponse = await page.request.post("/api/v1/time-blocks", {
    headers: headers(),
    data: original,
  });
  expect(createdResponse.status()).toBe(201);
  const created = await createdResponse.json();

  await page.goto("/?date=2026-09-07&view=day");
  const grid = page.getByRole("region", { name: "Daily time grid" });
  await grid.getByRole("button", { name: /Original plan.*planned/ }).click();
  await page.keyboard.press("Meta+c");
  await expect(page.locator("[data-calendar-clipboard-status]")).toHaveText(
    "Plan copied.",
  );
  const updatedResponse = await page.request.put(
    "/api/v1/time-blocks/" + created.id,
    {
      headers: { ...headers(), "If-Match": `"${created.version}"` },
      data: {
        ...original,
        title: "Changed plan",
        notes: "Changed notes",
        startsAt: "2026-09-10T18:00:00Z",
        endsAt: "2026-09-10T19:00:00Z",
      },
    },
  );
  expect(updatedResponse.status()).toBe(200);
  const updated = await updatedResponse.json();
  expect(
    (
      await page.request.delete("/api/v1/time-blocks/" + created.id, {
        headers: { ...headers(), "If-Match": `"${updated.version}"` },
      })
    ).status(),
  ).toBe(200);

  await page.goto("/?date=2026-09-14&view=day");
  await grid.getByRole("button", { name: "Select 2026-09-14" }).click();
  await page.keyboard.press("Meta+v");
  const pasted = grid.getByRole("button", {
    name: /Original plan.*planned/,
  });
  await expect(pasted).toBeVisible();
  const pastedId = await pasted.getAttribute("data-calendar-record");
  expect(pastedId).toBeTruthy();
  const copiedResponse = await page.request.get(
    "/api/v1/time-blocks/" + pastedId,
  );
  expect(copiedResponse.status()).toBe(200);
  const copied = await copiedResponse.json();
  expect(copied.notes).toBe(original.notes);
  expect(copied.startsAt).toBe("2026-09-14T15:00:00.000Z");
  await page.keyboard.press("Meta+z");
  await expect(pasted).toHaveCount(0);
});

test("failed keyboard copy and paste show notices, and uncertain paste retries safely", async ({
  page,
}) => {
  const headers = () => ({
    Origin: "http://localhost:3100",
    "Idempotency-Key": randomUUID(),
  });
  expect(
    (
      await page.request.post("/api/auth/sign-up/email", {
        headers: headers(),
        data: {
          name: "Clipboard error test",
          email: `clip-error-${randomUUID()}@example.com`,
          password: "Synthetic-calendar-password-123",
        },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await page.request.post("/api/v1/time-blocks", {
        headers: headers(),
        data: {
          title: "Copy source",
          startsAt: "2026-09-07T15:00:00Z",
          endsAt: "2026-09-07T16:00:00Z",
        },
      })
    ).status(),
  ).toBe(201);
  await page.goto("/?date=2026-09-07&view=day");
  const sourceBlock = page
    .getByRole("region", { name: "Daily time grid" })
    .getByRole("button", { name: /Copy source.*planned/ });
  await expect(sourceBlock).toBeVisible();
  await page.keyboard.press("Meta+c");
  await expect(page.locator(".calendar-notice")).toContainText(
    "Select a plan or day to copy.",
  );
  await page.keyboard.press("Meta+v");
  await expect(page.locator(".calendar-notice")).toContainText(
    "Copy a plan or day before pasting.",
  );

  await sourceBlock.click();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("calendar-clip:")) throw new Error("storage full");
      return original.call(this, key, value);
    };
  });
  await page.keyboard.press("Meta+c");
  await expect(page.locator(".calendar-notice")).toContainText(
    "Could not copy plans in this tab.",
  );
  await page.reload();
  await sourceBlock.click();
  await page.keyboard.press("Meta+c");
  await expect(page.locator(".calendar-notice")).toContainText("Plan copied.");

  await page.goto("/?date=2026-09-14&view=month");
  const targetDay = page
    .getByRole("region", { name: "Monthly calendar" })
    .locator('[data-date="2026-09-14"] .month-select-day');
  const bounds = await targetDay.boundingBox();
  expect(bounds).toBeTruthy();
  await targetDay.click({ position: { x: bounds!.width - 7, y: 7 } });
  await page.route("**/api/v1/calendar/snapshot-preview", (route) =>
    route.fulfill({
      status: 422,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "VALIDATION_ERROR", message: "Test preview failure." },
      }),
    }),
  );
  await page.keyboard.press("Meta+v");
  await expect(page.locator(".calendar-notice")).toContainText(
    "Could not paste plans. Test preview failure.",
  );
  await page.unroute("**/api/v1/calendar/snapshot-preview");

  let failed = false;
  await page.route("**/api/v1/calendar/snapshot-copy", (route) => {
    if (!failed) {
      failed = true;
      return route.abort("failed");
    }
    return route.continue();
  });
  await page.keyboard.press("Meta+v");
  await expect(page.locator(".calendar-notice")).toContainText(
    "Could not confirm paste. Retry the same change.",
  );
  await page
    .locator(".calendar-notice")
    .getByRole("button", { name: "Retry" })
    .click();
  await expect(page.locator(".calendar-notice")).toContainText("Plans pasted");
  await expect(targetDay).toHaveAttribute(
    "aria-label",
    "Select 2026-09-14, 1 records",
  );
  await page.keyboard.press("Meta+z");
  await expect(targetDay).toHaveAttribute(
    "aria-label",
    "Select 2026-09-14, 0 records",
  );
});
