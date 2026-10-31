import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("short timed plans keep their duration and reveal details on interaction", async ({
  page,
}, testInfo) => {
  const headers = () => ({
    Origin: "http://localhost:3100",
    "Idempotency-Key": randomUUID(),
  });
  expect(
    (
      await page.request.post("/api/__test/register", {
        headers: headers(),
        data: {
          name: "Short plans test",
          email: `short-plans-${randomUUID()}@example.com`,
          password: "Synthetic-calendar-password-123",
        },
      })
    ).status(),
  ).toBe(200);
  for (const [title, start, end] of [
    ["Five-minute plan", "15:00", "15:05"],
    ["Fifteen-minute plan", "15:05", "15:20"],
    ["Hour-long plan", "16:00", "17:00"],
  ]) {
    expect(
      (
        await page.request.post("/api/v1/time-blocks", {
          headers: headers(),
          data: {
            title,
            startsAt: `2026-09-07T${start}:00Z`,
            endsAt: `2026-09-07T${end}:00Z`,
          },
        })
      ).status(),
    ).toBe(201);
  }

  for (const view of ["day", "week"]) {
    await page.goto(`/?date=2026-09-07&view=${view}`);
    const grid = page.getByRole("region", {
      name: view === "day" ? "Daily time grid" : "Weekly time grid",
    });
    const five = grid.locator(".grid-record").filter({
      has: page.getByRole("button", { name: /Five-minute plan.*planned/ }),
    });
    const fifteen = grid.locator(".grid-record").filter({
      has: page.getByRole("button", { name: /Fifteen-minute plan.*planned/ }),
    });
    const hour = grid.locator(".grid-record").filter({
      has: page.getByRole("button", { name: /Hour-long plan.*planned/ }),
    });
    await expect(five).toBeVisible();
    await expect(fifteen).toBeVisible();
    await expect(hour).toBeVisible();
    const shortBounds = (await five.boundingBox())!;
    const nextBounds = (await fifteen.boundingBox())!;
    expect(shortBounds.height).toBeCloseTo(5, 0);
    expect(nextBounds.height).toBeCloseTo(15, 0);
    expect(nextBounds.y).toBeCloseTo(shortBounds.y + shortBounds.height, 0);
    const fiveBlock = five.getByRole("button", {
      name: /Five-minute plan.*planned/,
    });
    const fifteenBlock = fifteen.getByRole("button", {
      name: /Fifteen-minute plan.*planned/,
    });
    const fiveDetails = five.locator(".grid-record-details");
    const fiveTitle = fiveBlock.locator("strong");
    const fifteenTitle = fifteenBlock.locator("strong");
    const idleColor = await fiveBlock.evaluate(
      (block) => getComputedStyle(block).backgroundColor,
    );
    const cardColor = await fiveBlock.evaluate((block) => {
      const sample = block.ownerDocument.createElement("span");
      sample.style.backgroundColor = "var(--card)";
      block.ownerDocument.body.append(sample);
      const color = getComputedStyle(sample).backgroundColor;
      sample.remove();
      return color;
    });
    expect(idleColor).not.toBe(cardColor);
    expect(
      await hour
        .getByRole("button", { name: /Hour-long plan.*planned/ })
        .evaluate((block) => getComputedStyle(block).backgroundColor),
    ).toBe(idleColor);
    await expect(fiveDetails).toBeHidden();
    await expect(fiveTitle).toBeHidden();
    await expect(fifteen).toHaveClass(/is-tight-title/);
    await expect(fifteenTitle).toBeVisible();
    await expect(fifteenTitle).toHaveText("Fifteen-minute plan");
    const titleBounds = (await fifteenTitle.boundingBox())!;
    const blockBounds = (await fifteenBlock.boundingBox())!;
    expect(titleBounds.y).toBeGreaterThanOrEqual(blockBounds.y);
    expect(titleBounds.y + titleBounds.height).toBeLessThanOrEqual(
      blockBounds.y + blockBounds.height,
    );
    await expect(five.locator(".calendar-resize-handle")).toHaveCount(0);
    await expect(fifteen.locator(".calendar-resize-handle")).toHaveCount(0);
    if (testInfo.project.name === "desktop") {
      await fiveBlock.hover();
      await expect(fiveDetails).toBeVisible();
      await expect(fiveDetails).toContainText("Five-minute plan");
      await fiveBlock.focus();
      await expect(fiveDetails).toBeVisible();
    }
    await fiveBlock.click();
    await expect(fiveBlock).toHaveAttribute("aria-pressed", "true");
    expect(
      await fiveBlock.evaluate(
        (block) => getComputedStyle(block).backgroundColor,
      ),
    ).not.toBe(idleColor);
    await expect(fiveDetails).toBeVisible();
    const hourSpacing = grid.getByRole("slider", { name: "Hour spacing" });
    await hourSpacing.focus();
    await hourSpacing.press("End");
    await expect(hourSpacing).toHaveAttribute("aria-valuenow", "240");
    await expect(five).toHaveClass(/is-condensed/);
    await expect(five).not.toHaveClass(/is-bare/);
    await expect(fiveTitle).toBeVisible();
    await expect(fiveTitle).toHaveText("Five-minute plan");
    expect((await five.boundingBox())!.height).toBeCloseTo(20, 0);
    await hourSpacing.press("r");
    await expect(hourSpacing).toHaveAttribute("aria-valuenow", "60");
    if (testInfo.project.name === "desktop") {
      const source = (await fiveBlock.boundingBox())!;
      const x = source.x + source.width / 2;
      const y = source.y + source.height / 2;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x, y + 60, { steps: 4 });
      const moving = page.locator(".calendar-moving-block");
      await expect(moving).toBeVisible();
      await expect(moving.locator("strong")).toHaveText("Five-minute plan");
      await expect(moving.locator("span")).toContainText(/ - /);
      await expect(moving.locator("span")).toContainText("2026-09-07");
      await expect(moving.locator(".calendar-drag-hint")).toHaveText(
        "Escape to cancel",
      );
      expect((await moving.boundingBox())!.height).toBeGreaterThan(
        source.height,
      );
      expect(
        await moving.evaluate((element) =>
          [...element.children].every(
            (child) =>
              child.getBoundingClientRect().bottom <=
              element.getBoundingClientRect().bottom,
          ),
        ),
      ).toBe(true);
      await expect(fiveBlock).toHaveClass(/drag-source/);
      expect((await five.boundingBox())!.height).toBeCloseTo(5, 0);
      await page.keyboard.press("Escape");
      await page.mouse.up();
      await expect(moving).toHaveCount(0);
    }
    await fiveBlock.dblclick();
    await expect(page.locator(".calendar-plan-popover")).toBeVisible();
  }

  if (testInfo.project.name === "phone") {
    await page.goto("/?date=2026-09-07&view=day");
    const dayList = page.getByRole("region", { name: "Day activity" });
    await dayList
      .getByRole("button", { name: /Five-minute plan.*planned/ })
      .dblclick();
    await expect(page.locator(".calendar-plan-popover")).toBeVisible();
  }
});
