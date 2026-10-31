import { test, expect } from "@playwright/test";
test("production HTML has fresh script nonces and an enforced policy that permits hydration", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const failures: string[] = [];
    (window as Window & { cspFailures: string[] }).cspFailures = failures;
    document.addEventListener("securitypolicyviolation", (event) =>
      failures.push(
        JSON.stringify({
          directive: event.violatedDirective,
          blocked: event.blockedURI,
          source: event.sourceFile,
          line: event.lineNumber,
          column: event.columnNumber,
        }),
      ),
    );
  });
  const response = await page.goto("/login");
  expect(response?.status()).toBe(200);
  const policy = response!.headers()["content-security-policy"];
  expect(policy).toContain("'strict-dynamic'");
  expect(policy).not.toContain("'unsafe-eval'");
  expect(policy).toContain("frame-ancestors 'none'");
  expect(response!.headers()["strict-transport-security"]).toContain(
    "max-age=",
  );
  expect(response!.headers()["x-content-type-options"]).toBe("nosniff");
  const nonce = await page
    .locator("script[nonce]")
    .first()
    .evaluate((node) => (node as HTMLScriptElement).nonce);
  expect(nonce.length).toBeGreaterThan(20);
  expect(policy).toContain(`'nonce-${nonce}'`);
  await expect(page.getByLabel("Email", { exact: true })).toBeEnabled();
  await page
    .getByLabel("Password", { exact: true })
    .fill("Synthetic-header-password-123");
  await page
    .getByRole("button", { name: "Show password", exact: true })
    .click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => (window as Window & { cspFailures: string[] }).cspFailures,
    ),
  ).toEqual([]);
  const second = await page.reload();
  expect(second!.headers()["content-security-policy"]).not.toBe(policy);
});
