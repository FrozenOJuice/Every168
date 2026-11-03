import { foodView } from "./helpers/food-navigation";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("Fitness and Food navigation stays usable while scrolling on desktop and narrow phones", async ({
  page,
}, info) => {
  if (info.project.name === "phone")
    await page.setViewportSize({ width: 320, height: 740 });
  const write = async (path: string, data: object) => {
    const response = await page.request.post(`/api/${path}`, {
      headers: {
        Origin: "http://localhost:3100",
        "Idempotency-Key": randomUUID(),
      },
      data,
    });
    expect(response.ok()).toBe(true);
    return response.json();
  };
  await write("__test/register", {
    name: "Workspace navigation",
    email: `workspace-nav-${randomUUID()}@example.com`,
    password: "Synthetic-navigation-password-123",
  });
  for (let i = 0; i < 12; i++)
    await write("v1/foods", {
      name: `Navigation food ${i + 1}`,
      servingAmount: 100,
      servingUnit: "g",
      calories: 100,
    });
  const top = page.viewportSize()!.width <= 900 ? 64 : 0;
  const styles: object[] = [];
  for (const [path, name, active] of [
    ["/fitness/exercises", "Fitness views", "Exercises"],
    ["/food?view=food", "Food navigation", "Library"],
  ]) {
    await page.goto(path!);
    const nav = page.getByRole("navigation", { name, exact: true });
    const bar = nav.locator("..");
    await expect(
      nav.getByRole("link", { name: active, exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
      page
        .locator(
          path!.startsWith("/fitness")
            ? ".fitness-exercise-grid > *"
            : ".food-library-grid > article",
        )
        .first(),
    ).toBeVisible();
    // The first tab starts at the same inset as the domain content.
    const content = page.locator(
      path!.startsWith("/fitness") ? ".fitness-library-host" : ".food-content",
    );
    const inset = await content.evaluate((el) =>
      parseFloat(getComputedStyle(el).paddingLeft),
    );
    expect(
      Math.abs(
        (await nav.getByRole("link").first().boundingBox())!.x -
          ((await content.boundingBox())!.x + inset),
      ),
    ).toBeLessThan(2);
    await page.evaluate(() => window.scrollTo(0, 450));
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(200);
    await expect
      .poll(async () => Math.abs((await bar.boundingBox())!.y - top))
      .toBeLessThan(2);
    const link = nav.getByRole("link", { name: active, exact: true });
    await link.focus();
    await expect(link).toBeFocused();
    expect(
      await link.evaluate((el) => {
        const s = getComputedStyle(el);
        return s.outlineStyle;
      }),
    ).toBe("solid");
    styles.push(
      await link.evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          size: s.fontSize,
          weight: s.fontWeight,
          color: s.color,
          height: el.getBoundingClientRect().height,
        };
      }),
    );
    const b = (await link.boundingBox())!;
    expect(
      await link.evaluate(
        (el, point) => el.contains(document.elementFromPoint(point.x, point.y)),
        { x: b.x + b.width / 2, y: b.y + b.height / 2 },
      ),
    ).toBe(true);
    if (page.viewportSize()!.width <= 1150) {
      await expect(
        bar.getByRole("button", { name: "Day", exact: true }),
      ).toBeVisible();
      await bar.getByRole("button", { name: "Day", exact: true }).click();
      await expect(
        page.getByRole("dialog", { name: "Your day", exact: true }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("dialog", { name: "Your day", exact: true }),
      ).toHaveCount(0);
    }
    const record = page
      .locator(
        path!.startsWith("/fitness")
          ? ".fitness-exercise-grid > *"
          : ".food-library-grid > article",
      )
      .nth(3);
    await record.evaluate((el) => el.scrollIntoView({ block: "start" }));
    await expect
      .poll(async () => (await record.boundingBox())!.y)
      .toBeGreaterThanOrEqual(top + (await bar.boundingBox())!.height - 1);
    await page.screenshot({
      path: info.outputPath(
        `${name === "Fitness views" ? "fitness" : "food"}-navigation.png`,
      ),
      fullPage: false,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    if (info.project.name === "desktop" && name === "Food navigation") {
      await page.setViewportSize({ width: 2560, height: 900 });
      await expect
        .poll(async () =>
          Math.abs(
            (await nav.getByRole("link").first().boundingBox())!.x -
              ((await content.boundingBox())!.x + inset),
          ),
        )
        .toBeLessThan(2);
      await page.screenshot({
        path: info.outputPath("food-navigation-wide.png"),
      });
    }
    if (name === "Food navigation") {
      await foodView(page, "Search past entries");
      await expect(
        page.getByRole("heading", { name: "Search past entries", exact: true }),
      ).toBeVisible();
      await expect(
        nav.getByRole("link", { name: "Today", exact: true }),
      ).toHaveAttribute("aria-current", "page");
    } else {
      await nav.getByRole("link", { name: "History", exact: true }).click();
      await expect(
        nav.getByRole("link", { name: "History", exact: true }),
      ).toHaveAttribute("aria-current", "page");
    }
  }
  expect(styles[0]).toEqual(styles[1]);
  expect(styles[0]).toMatchObject({ size: "15px", weight: "650" });
});
