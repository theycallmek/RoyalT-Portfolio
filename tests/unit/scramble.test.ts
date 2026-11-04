import { describe, expect, it } from "vitest";
import { scrambleFrame } from "../../src/lib/scramble";

const rand = () => 0; // always picks first glyph

describe("scrambleFrame", () => {
  it("returns all glyphs at progress 0 but keeps spaces", () => {
    const out = scrambleFrame("ab cd", 0, rand);
    expect(out).toHaveLength(5);
    expect(out[2]).toBe(" ");
    expect(out).not.toContain("a");
  });

  it("resolves a prefix proportional to progress", () => {
    const out = scrambleFrame("abcd", 0.5, rand);
    expect(out.slice(0, 2)).toBe("ab");
    expect(out.slice(2)).not.toContain("c");
  });

  it("returns the target at progress 1", () => {
    expect(scrambleFrame("hello world", 1, rand)).toBe("hello world");
  });

  it("clamps out-of-range progress", () => {
    expect(scrambleFrame("hi", 5, rand)).toBe("hi");
    expect(scrambleFrame("hi", -1, rand)).toHaveLength(2);
  });
});

describe("scrambleFrame with a starting word", () => {
  it("shows the starting word at the beginning", () => {
    expect(scrambleFrame("RoyalT", 0, rand, "Taylor")).toBe("Taylor");
    expect(scrambleFrame("RoyalT", 0.1, rand, "Taylor")).toBe("Taylor");
  });

  it("scrambles after the hold, then resolves to the target", () => {
    const mid = scrambleFrame("RoyalT", 0.3, rand, "Taylor");
    expect(mid).toHaveLength(6);
    expect(mid).not.toBe("Taylor");
    expect(mid).not.toBe("RoyalT");
    expect(scrambleFrame("RoyalT", 1, rand, "Taylor")).toBe("RoyalT");
  });

  it("ignores a starting word of a different length", () => {
    expect(scrambleFrame("RoyalT", 0, rand, "Tay")).not.toBe("Tay");
  });
});
