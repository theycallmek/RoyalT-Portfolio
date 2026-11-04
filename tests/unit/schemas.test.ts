import { describe, expect, it } from "vitest";
import { linkSchema } from "../../src/lib/schemas";

describe("linkSchema", () => {
  it("requires a valid url and category", () => {
    expect(
      linkSchema.parse({
        title: "Printables",
        url: "https://printables.com",
        category: "3d-printing",
      }).order,
    ).toBe(0);
    expect(() =>
      linkSchema.parse({ title: "x", url: "x", category: "3d-printing" }),
    ).toThrow();
    expect(() =>
      linkSchema.parse({ title: "x", url: "https://a.b", category: "bogus" }),
    ).toThrow();
  });
});
