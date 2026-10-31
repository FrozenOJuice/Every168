import { expect, it } from "vitest";
import { requiresEmailVerification } from "./auth-policy.js";

it.each(["development", "test", "production"] as const)(
  "requires verified email outside development (%s)",
  (NODE_ENV) => {
    expect(requiresEmailVerification({ NODE_ENV })).toBe(
      NODE_ENV !== "development",
    );
  },
);
