import { describe, expect, it } from "vitest";
import {
  allowedImageUrl,
  coverFile,
  extractMakerWorld,
  staleFiles,
} from "../../scripts/makerworld-import.ts";

const design = (
  id: number,
  title: string,
  downloads: number,
  likes: number,
  publishTime = `2023-11-${String(id).padStart(2, "0")}T00:00:00Z`,
) => ({
  id,
  slug: title.toLowerCase().replace(/\s+/g, "-"),
  title,
  coverUrl: `https://makerworld.bblmw.com/cover-${id}.png`,
  downloadCount: downloads,
  likeCount: likes,
  printCount: id * 10,
  publishTime,
});

const page = (pageProps: unknown) =>
  `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(
    {
      props: { pageProps },
    },
  )}</script></body></html>`;

const props = {
  userInfo: { handle: "RoyalT", downloadCount: 13046, likeCount: 1749 },
  uploadCount: { designCnt: 8 },
  designs: [
    design(1, "Small", 9, 4),
    design(2, "Big", 1015, 570),
    design(3, "Mid", 382, 520),
    design(4, "A", 66, 30),
    design(5, "B", 58, 33),
    design(6, "C", 345, 123),
    design(7, "D", 959, 342),
  ],
};

describe("extractMakerWorld", () => {
  const data = extractMakerWorld(page(props), "2026-11-02");

  it("uses the profile totals", () => {
    expect(data).toMatchObject({
      updated: "2026-11-02",
      profileUrl: "https://makerworld.com/en/@RoyalT",
      models: 8,
      downloads: 13046,
      likes: 1749,
    });
  });

  it("keeps all models by downloads (ties newest first) with links, covers, prints and dates", () => {
    expect(data.items.map((m) => m.title)).toEqual([
      "Big",
      "D",
      "Mid",
      "C",
      "A",
      "B",
      "Small",
    ]);
    expect(data.items[0]).toEqual({
      title: "Big",
      url: "https://makerworld.com/en/models/2-big",
      imageUrl: "https://makerworld.bblmw.com/cover-2.png",
      downloads: 1015,
      likes: 570,
      prints: 20,
      published: "2023-11-02T00:00:00Z",
    });
  });

  it("breaks download ties by newest and caps the list at 60", () => {
    const many = Array.from({ length: 70 }, (_, i) =>
      design(
        i + 1,
        `M${i}`,
        5,
        1,
        `2024-01-01T00:00:${String(i % 60).padStart(2, "0")}Z`,
      ),
    );
    const items = extractMakerWorld(
      page({ ...props, designs: many }),
      "2026-11-02",
    ).items;
    expect(items).toHaveLength(60);
    expect(items[0].published > items[1].published).toBe(true);
  });

  it("falls back to the designs list length when the upload count is missing", () => {
    const { uploadCount: _, ...rest } = props;
    expect(extractMakerWorld(page(rest), "2026-11-02").models).toBe(7);
  });

  it("explains clearly when the page has no embedded data (e.g. a Cloudflare check page)", () => {
    expect(() =>
      extractMakerWorld("<html>Just a moment...</html>", "2026-11-02"),
    ).toThrow(/__NEXT_DATA__/);
  });

  it("explains which field is missing when MakerWorld changes its format", () => {
    expect(() =>
      extractMakerWorld(page({ designs: [] }), "2026-11-02"),
    ).toThrow(/userInfo/);
  });
});

describe("cover download helpers", () => {
  it("only allows https URLs on the MakerWorld image host", () => {
    expect(
      allowedImageUrl("https://makerworld.bblmw.com/makerworld/model/x.png"),
    ).toBe(true);
    for (const url of [
      "http://makerworld.bblmw.com/x.png",
      "https://evil.example/x.png",
      "https://makerworld.bblmw.com.evil.example/x.png",
      "https://user@evil.example/x.png",
      "file:///C:/Windows/win.ini",
      "not a url",
    ]) {
      expect(allowedImageUrl(url), url).toBe(false);
    }
  });

  it("names the cover after the model id", () => {
    expect(
      coverFile("https://makerworld.com/en/models/57136-cable-channel"),
    ).toBe("57136.webp");
    expect(coverFile("https://makerworld.com/en/@RoyalT")).toBeUndefined();
  });

  it("selects files no longer referenced, ignoring non-webp files", () => {
    expect(
      staleFiles(["1.webp", "2.webp", "3.webp", ".gitkeep"], ["2.webp"]),
    ).toEqual(["1.webp", "3.webp"]);
  });
});
