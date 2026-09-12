import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
test("second browser account cannot access known private record IDs", async ({
  browser,
}) => {
  const first = await browser.newContext({ baseURL: "http://localhost:3100" }),
    second = await browser.newContext({ baseURL: "http://localhost:3100" });
  try {
    for (const context of [first, second]) {
      const signup = await context.request.post("/api/auth/sign-up/email", {
        headers: { Origin: "http://localhost:3100" },
        data: {
          name: "Isolation member",
          email: "isolation-" + randomUUID() + "@example.com",
          password: "Synthetic-isolation-password-123",
        },
      });
      expect(signup.status()).toBe(200);
    }
    const input = {
      title: "Private planning block",
      startsAt: "2026-09-07T10:00:00Z",
      endsAt: "2026-09-07T11:00:00Z",
    };
    const created = await first.request.post("/api/v1/time-blocks", {
      headers: { Origin: "http://localhost:3100" },
      data: input,
    });
    expect(created.status()).toBe(201);
    const block = (await created.json()) as { id: string };
    for (const method of ["GET", "PUT", "DELETE"]) {
      const response = await second.request.fetch(
        "/api/v1/time-blocks/" + block.id,
        {
          method,
          headers: { Origin: "http://localhost:3100" },
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
  } finally {
    await first.close();
    await second.close();
  }
});
