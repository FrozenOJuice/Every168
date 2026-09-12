import { expect, it, vi } from "vitest";
import { createClient } from "./index";
const at = "2026-09-07T09:00:00Z";

it("retries the exact unresolved payload and key, including a generated timestamp", async () => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockRejectedValueOnce(new Error("Response lost"))
    .mockResolvedValueOnce(Response.json({ id: "saved", version: 1 }));
  const api = createClient({ fetch });
  const key = crypto.randomUUID();
  await expect(
    api.logWater({ amountMl: 250, consumedAt: at }, key),
  ).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  await expect(
    api.logWater(
      { amountMl: 250, consumedAt: "2026-09-07T09:01:00Z" },
      key.toUpperCase(),
    ),
  ).resolves.toMatchObject({ id: "saved" });
  const calls = fetch.mock.calls;
  expect(calls[1]![1]!.body).toBe(calls[0]![1]!.body);
  expect(new Headers(calls[1]![1]!.headers).get("Idempotency-Key")).toBe(key);
});

it("sends independent keys for deliberate identical logs and the last-seen revision for edits", async () => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockImplementation(async () => Response.json({ id: "saved", version: 2 }));
  const api = createClient({ fetch });
  await api.logWater({ amountMl: 250, consumedAt: at });
  await api.logWater({ amountMl: 250, consumedAt: at });
  await api.updateWater("saved", { amountMl: 500, consumedAt: at }, 1);
  const headers = fetch.mock.calls.map((call) => new Headers(call[1]!.headers));
  expect(headers[0]!.get("Idempotency-Key")).not.toBe(
    headers[1]!.get("Idempotency-Key"),
  );
  expect(headers[2]!.get("If-Match")).toBe('"1"');
});

it("retains an attempt after a 503 or truncated success, but surfaces a stale revision without retrying it", async () => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValueOnce(
      Response.json(
        { error: { code: "TEMPORARILY_UNAVAILABLE", message: "Retry" } },
        { status: 503 },
      ),
    )
    .mockResolvedValueOnce(new Response('{"id":'))
    .mockResolvedValueOnce(
      Response.json(
        { error: { code: "STALE_REVISION", message: "Reload latest" } },
        { status: 409 },
      ),
    );
  const api = createClient({ fetch });
  const key = crypto.randomUUID();
  for (const code of [
    "TEMPORARILY_UNAVAILABLE",
    "INCOMPLETE_RESPONSE",
    "STALE_REVISION",
  ])
    await expect(
      api.updateWater("saved", { amountMl: 250, consumedAt: at }, 1, key),
    ).rejects.toMatchObject({ code });
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(
    fetch.mock.calls.map((call) =>
      new Headers(call[1]!.headers).get("Idempotency-Key"),
    ),
  ).toEqual([key, key, key]);
});

it("keeps authentication separate from domain write receipts", async () => {
  const fetch = vi
    .fn<typeof globalThis.fetch>()
    .mockResolvedValue(Response.json({ user: { id: "member" } }));
  await createClient({ fetch }).signIn({
    email: "test@example.com",
    password: "Synthetic-password",
  });
  expect(
    new Headers(fetch.mock.calls[0]![1]!.headers).has("Idempotency-Key"),
  ).toBe(false);
});
