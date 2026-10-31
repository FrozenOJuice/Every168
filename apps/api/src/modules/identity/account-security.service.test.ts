import { afterEach, expect, it, vi } from "vitest";
import { accountSecurityService } from "./account-security.service.js";
afterEach(() => vi.useRealTimers());
it("does not expose mailbox existence through a slow email provider", async () => {
  vi.useFakeTimers();
  type Args = Parameters<typeof accountSecurityService>;
  const repo = {
    issue: vi.fn().mockResolvedValue({ email: "synthetic@example.com" }),
  } as unknown as Args[0];
  const run: Args[1] = (work) =>
    work({} as Parameters<Parameters<Args[1]>[0]>[0]);
  let release!: () => void;
  const delivery = new Promise<void>((resolve) => {
    release = resolve;
  });
  const logger = { error: vi.fn() } as unknown as Args[3];
  const service = accountSecurityService(repo, run, () => delivery, logger);
  let settled = false;
  const pending = service.request("synthetic@example.com", "reset").then(() => {
    settled = true;
  });
  await vi.advanceTimersByTimeAsync(500);
  try {
    expect(settled).toBe(true);
  } finally {
    release();
    await vi.runAllTimersAsync();
    await pending;
  }
});
