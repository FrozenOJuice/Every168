import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("summary exercise references return to the same workout repeatedly and navigate to other workouts", async ({
  page,
}, info) => {
  const write = async (path: string, data: object, version?: number) => {
    const response = await page.request[version ? "put" : "post"](path, {
      headers: {
        Origin: "http://localhost:3100",
        "Idempotency-Key": randomUUID(),
        ...(version ? { "If-Match": `"${version}"` } : {}),
      },
      data,
    });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  };
  await write("/api/__test/register", {
    name: "Summary references",
    email: `summary-reference-${randomUUID()}@example.com`,
    password: "Synthetic-reference-password-123",
  });
  const exercise = await write("/api/v1/exercises", {
    name: "Reference bench",
  });
  const sessions = [];
  for (const [title, day, weight] of [
    ["Earlier session", "2026-10-24", 40],
    ["Latest session", "2026-10-25", 50],
  ] as const) {
    const created = await write("/api/v1/strength-workouts", {
      title,
      startedAt: `${day}T12:00:00Z`,
    });
    sessions.push(
      await write(
        `/api/v1/strength-workouts/${created.id}`,
        {
          title,
          startedAt: created.startedAt,
          endedAt: `${day}T13:00:00Z`,
          exercises: [
            {
              exerciseId: exercise.id,
              sets: [{ completed: true, reps: 10, weightKg: weight }],
            },
          ],
        },
        created.version,
      ),
    );
  }
  const [earlier, latest] = sessions;
  await page.goto(`/fitness/session/${latest.id}`);
  const details = page.getByRole("region", {
    name: "Reference bench details",
    exact: true,
  });
  const latestSummary = page.getByRole("heading", {
    name: "Latest session - Summary",
    exact: true,
  });
  const card = page.getByRole("region", {
    name: "Reference bench results 1",
    exact: true,
  });
  const aligned = async () => {
    const heading = await card
      .locator(".fitness-summary-exercise-heading")
      .boundingBox();
    const info = await card
      .getByRole("button", { name: "Help with Reference bench", exact: true })
      .boundingBox();
    expect(
      Math.abs(info!.y + info!.height / 2 - heading!.y - heading!.height / 2),
    ).toBeLessThan(2);
  };
  await aligned();
  const baseHistoryLength = await page.evaluate(() => history.length);
  for (let attempt = 0; attempt < 2; attempt++) {
    await page
      .getByRole("button", { name: "Help with Reference bench", exact: true })
      .click();
    await expect(details).toBeVisible();
    const source = details
      .locator(".fitness-recall-section")
      .getByRole("link", { name: /^Open workout: Latest session,/ });
    await expect(source).toBeVisible();
    await source.click();
    await expect(latestSummary).toBeVisible();
    await expect(details).not.toBeVisible();
    await expect(
      page.getByRole("link", { name: "Back to History", exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => history.length)).toBe(
      baseHistoryLength + 1,
    );
    await expect(
      card.getByRole("list", {
        name: "Reference bench recorded sets",
        includeHidden: true,
      }),
    ).not.toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
  await page
    .getByRole("button", { name: "Show all sets", exact: true })
    .click();
  await aligned();
  await page
    .getByRole("button", { name: "Hide all sets", exact: true })
    .click();
  if (info.project.name === "phone") {
    await page.setViewportSize({ width: 320, height: 740 });
    await aligned();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.goto(`/fitness/session/${earlier.id}`);
  await page
    .getByRole("button", { name: "Help with Reference bench", exact: true })
    .click();
  await details
    .locator(".fitness-recall-section")
    .getByRole("link", { name: /^Open workout: Latest session,/ })
    .click();
  await expect(latestSummary).toBeVisible();
  await expect
    .poll(() => new URL(page.url()).pathname)
    .toBe(`/fitness/session/${latest.id}`);
  // A different workout returns to the same exercise with its original parent.
  await expect(
    page.getByRole("link", { name: "Back to Reference bench", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("link", { name: "Back to Reference bench", exact: true })
    .click();
  await expect(details).toBeVisible();
  await expect(
    details.getByRole("button", { name: "Back to summary", exact: true }),
  ).toBeVisible();
  await details
    .getByRole("button", { name: "Back to summary", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Earlier session - Summary",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Back to History", exact: true }),
  ).toBeVisible();
  expect(
    (
      await (
        await page.request.get(`/api/v1/strength-workouts/${earlier.id}`)
      ).json()
    ).version,
  ).toBe(earlier.version);
  expect(
    (
      await (
        await page.request.get(`/api/v1/strength-workouts/${latest.id}`)
      ).json()
    ).version,
  ).toBe(latest.version);
  await page.screenshot({
    path: info.outputPath("summary-reference-return.png"),
  });
});
