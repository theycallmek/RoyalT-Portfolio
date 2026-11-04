import { describe, expect, it } from "vitest";
import makerworldData from "../../src/data/makerworld.json";
import { makerworldSchema, postSchema } from "../../src/lib/schemas";

describe("postSchema", () => {
  const valid = { title: "Hi", date: "2026-11-01", summary: "s" };
  it("defaults tags and draft, coerces date", () => {
    const r = postSchema.parse(valid);
    expect(r.date).toBeInstanceOf(Date);
    expect(r.tags).toEqual([]);
    expect(r.draft).toBe(false);
  });
  it("accepts an optional external url and rejects a bad one", () => {
    expect(
      postSchema.parse({ ...valid, url: "https://example.com/a" }).url,
    ).toBe("https://example.com/a");
    expect(postSchema.parse(valid).url).toBeUndefined();
    expect(() => postSchema.parse({ ...valid, url: "not a url" })).toThrow();
  });
  it("accepts an optional local image filename (webp) and rejects paths", () => {
    expect(
      postSchema.parse({ ...valid, image: "probable-planet.webp" }).image,
    ).toBe("probable-planet.webp");
    expect(() =>
      postSchema.parse({ ...valid, image: "../secret.webp" }),
    ).toThrow();
    expect(() => postSchema.parse({ ...valid, image: "x.png" })).toThrow();
  });
  it("accepts an optional excerpt and rejects an empty one", () => {
    expect(
      postSchema.parse({ ...valid, excerpt: "First paragraph." }).excerpt,
    ).toBe("First paragraph.");
    expect(() => postSchema.parse({ ...valid, excerpt: "" })).toThrow();
  });
  it("rejects missing summary", () => {
    expect(() =>
      postSchema.parse({ title: "x", date: "2026-11-01" }),
    ).toThrow();
  });
});

describe("makerworldSchema", () => {
  const valid = {
    updated: "2026-11-01",
    profileUrl: "https://makerworld.com/en/@RoyalT",
    models: 2,
    downloads: 10,
    likes: 3,
    items: [
      {
        title: "Thing",
        url: "https://makerworld.com/en/models/1",
        downloads: 5,
        likes: 1,
        prints: 2,
        published: "2023-11-04T20:03:27Z",
      },
    ],
  };
  it("accepts valid data", () => {
    expect(makerworldSchema.parse(valid).models).toBe(2);
  });
  it("rejects a bad date and negative counts", () => {
    expect(() =>
      makerworldSchema.parse({ ...valid, updated: "yesterday" }),
    ).toThrow();
    expect(() => makerworldSchema.parse({ ...valid, downloads: -1 })).toThrow();
    const item = { ...valid.items[0], published: "last week" };
    expect(() => makerworldSchema.parse({ ...valid, items: [item] })).toThrow();
  });
  it("accepts the committed data file", () => {
    expect(() => makerworldSchema.parse(makerworldData)).not.toThrow();
  });
});
