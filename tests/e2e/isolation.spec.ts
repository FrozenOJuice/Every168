import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
test("second browser account cannot access known private record IDs", async ({
  browser,
}) => {
  const device = test.info().project.use;
  const options = {
    baseURL: "http://localhost:3100",
    viewport: device.viewport,
    isMobile: device.isMobile,
    hasTouch: device.hasTouch,
    userAgent: device.userAgent,
  };
  const first = await browser.newContext(options),
    second = await browser.newContext(options);
  const emails: string[] = [];
  try {
    for (const context of [first, second]) {
      const email = "isolation-" + randomUUID() + "@example.com";
      emails.push(email);
      const signup = await context.request.post("/api/auth/sign-up/email", {
        headers: {
          Origin: "http://localhost:3100",
          "Idempotency-Key": randomUUID(),
          "If-Match": '"1"',
        },
        data: {
          name: "Isolation member",
          email,
          password: "Synthetic-isolation-password-123",
        },
      });
      expect(signup.status()).toBe(200);
      expect(await signup.json()).not.toHaveProperty("token");
    }
    const input = {
      title: "Private planning block",
      startsAt: "2026-09-07T10:00:00Z",
      endsAt: "2026-09-07T11:00:00Z",
    };
    const created = await first.request.post("/api/v1/time-blocks", {
      headers: {
        Origin: "http://localhost:3100",
        "Idempotency-Key": randomUUID(),
        "If-Match": '"1"',
      },
      data: input,
    });
    expect(created.status()).toBe(201);
    const block = (await created.json()) as { id: string };
    for (const method of ["GET", "PUT", "DELETE"]) {
      const response = await second.request.fetch(
        "/api/v1/time-blocks/" + block.id,
        {
          method,
          headers: {
            Origin: "http://localhost:3100",
            "Idempotency-Key": randomUUID(),
            "If-Match": '"1"',
          },
          data: method === "PUT" ? input : undefined,
        },
      );
      expect(response.status()).toBe(404);
    }
    const page = await second.newPage();
    await page.goto("/week?date=2026-09-07");
    await expect(
      page.getByRole("heading", { name: "Your week", exact: true }),
    ).toBeVisible();
    await expect(page.getByText("Private planning block")).toHaveCount(0);
    const stillThere = await first.request.get(
      "/api/v1/time-blocks/" + block.id,
    );
    expect(stillThere.status()).toBe(200);
    const ownerPage = await first.newPage();
    await ownerPage.goto("/week?date=2026-09-07");
    await expect(ownerPage.getByText("Private planning block")).toBeVisible();
    expect(await ownerPage.evaluate(() => document.cookie)).not.toContain(
      "session_token",
    );
    const sessionCookie = (await first.cookies()).find((cookie) =>
      cookie.name.endsWith("session_token"),
    )!;
    expect(sessionCookie.httpOnly).toBe(true);
    expect(sessionCookie.sameSite).toBe("Lax");
    await ownerPage
      .getByRole("button", { name: "Sign out", exact: true })
      .click();
    await expect(ownerPage).toHaveURL(/\/login$/);
    expect(
      (
        await first.request.get("/api/v1/me", {
          headers: { Cookie: `${sessionCookie.name}=${sessionCookie.value}` },
        })
      ).status(),
    ).toBe(401);
    await ownerPage.getByLabel("Email", { exact: true }).fill(emails[1]!);
    await ownerPage
      .getByLabel("Password", { exact: true })
      .fill("Synthetic-isolation-password-123");
    await ownerPage
      .getByRole("button", { name: "Sign in", exact: true })
      .click();
    await expect(ownerPage).toHaveURL("http://localhost:3100/");
    await ownerPage.goto("/week?date=2026-09-07");
    await expect(
      ownerPage.getByRole("heading", { name: "Your week", exact: true }),
    ).toBeVisible();
    await expect(ownerPage.getByText("Private planning block")).toHaveCount(0);
    // Traversing old history must not restore the first account's cached page.
    await ownerPage.goBack();
    await ownerPage.goBack();
    await ownerPage.goBack();
    await expect(ownerPage.getByText("Private planning block")).toHaveCount(0);
    await ownerPage.goto("/week?date=2026-09-07");
    await expect(ownerPage.getByText("Private planning block")).toHaveCount(0);
  } finally {
    await first.close();
    await second.close();
  }
});
