import { describe, expect, it } from "vitest";
import { formatRestDuration } from "./rest-duration";
describe("duration display", () => {
  it("hides timestamp fractions and floating-point remainders", () => {
    expect(formatRestDuration(2724.4740000000002)).toBe("45m 24s");
  });
  it("rounds before splitting so minutes and hours carry correctly", () => {
    expect(formatRestDuration(59.999)).toBe("1m");
    expect(formatRestDuration(3599.999)).toBe("1h");
    expect(formatRestDuration(3600.6)).toBe("1h 1s");
    expect(formatRestDuration(0)).toBe("0s");
  });
});
