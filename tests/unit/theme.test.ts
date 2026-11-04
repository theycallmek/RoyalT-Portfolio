import { describe, expect, it } from "vitest";
import { ACCENTS, resolveAccent, resolveMode } from "../../src/lib/theme";

describe("resolveMode", () => {
  it("prefers the saved choice", () => {
    expect(resolveMode("light", "dark")).toBe("light");
  });
  it("falls back to the system preference", () => {
    expect(resolveMode(null, "light")).toBe("light");
  });
  it("defaults to dark", () => {
    expect(resolveMode(null, null)).toBe("dark");
    expect(resolveMode("bogus", null)).toBe("dark");
  });
});

describe("resolveAccent", () => {
  it("accepts known accents and defaults to green", () => {
    expect(ACCENTS).toEqual(["green", "orange", "blue", "pink"]);
    expect(resolveAccent("blue")).toBe("blue");
    expect(resolveAccent(null)).toBe("green");
    expect(resolveAccent("red")).toBe("green");
  });
});
