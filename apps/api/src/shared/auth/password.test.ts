import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "./password.js";

describe("password storage", () => {
  it("uses independent salts, a versioned work factor and full Unicode passwords", async () => {
    const password = "Long passphrase café 🔒 " + "z".repeat(70);
    const first = await hashPassword(password);
    const second = await hashPassword(password);
    expect(first).not.toEqual(second);
    expect(first).toMatch(/^scrypt-v1\$[a-f0-9]{32}:[a-f0-9]{128}$/);
    expect(first).not.toContain(password);
    expect(await verifyPassword({ hash: first, password })).toBe(true);
    expect(
      await verifyPassword({
        hash: first,
        password: password.slice(0, -1) + "x",
      }),
    ).toBe(false);
    expect(
      await verifyPassword({
        hash: first,
        password: password.normalize("NFD"),
      }),
    ).toBe(true);
  });
  it("rejects unversioned, malformed and unknown password formats", async () => {
    const password = "Synthetic-passphrase-123";
    const hash = await hashPassword(password);
    const payload = hash.slice("scrypt-v1$".length);
    for (const malformed of [
      "",
      "salt:key",
      payload,
      "scrypt-v2$" + payload,
      hash + "ff",
    ])
      expect(await verifyPassword({ hash: malformed, password })).toBe(false);
    expect(await verifyPassword({ hash, password: "z".repeat(129) })).toBe(
      false,
    );
  });
});
