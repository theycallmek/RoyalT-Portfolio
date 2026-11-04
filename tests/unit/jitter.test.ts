import { describe, expect, it } from "vitest";
import { drifted, nextDelay, nextOffset } from "../../src/lib/jitter";

describe("nextOffset", () => {
  it("stays within ±amp and is a whole number", () => {
    for (let i = 0; i < 500; i++) {
      const o = nextOffset(2);
      expect(Number.isInteger(o)).toBe(true);
      expect(Math.abs(o)).toBeLessThanOrEqual(2);
    }
  });
  it("covers the whole range", () => {
    expect(nextOffset(2, () => 0)).toBe(-2);
    expect(nextOffset(2, () => 0.9999)).toBe(2);
  });
  it("amp 0 means no movement", () => {
    expect(nextOffset(0, () => 0.9)).toBe(0);
  });
});

describe("drifted", () => {
  it("adds the offset to the real value and clamps to 0..100", () => {
    expect(drifted(40, 2)).toBe(42);
    expect(drifted(1, -2)).toBe(0);
    expect(drifted(99, 2)).toBe(100);
  });
});

describe("nextDelay", () => {
  it("waits between 3 and 8 seconds", () => {
    expect(nextDelay(() => 0)).toBe(3000);
    expect(nextDelay(() => 0.9999)).toBeLessThan(8000);
    expect(nextDelay(() => 0.5)).toBeGreaterThanOrEqual(3000);
  });
});
