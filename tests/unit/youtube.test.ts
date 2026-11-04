import { describe, expect, it } from "vitest";
import {
  aggregateYouTube,
  chunk,
  collectPages,
  youtubeError,
} from "../../server/youtube.ts";

const channel = {
  snippet: { title: "Royal T" },
  statistics: {
    viewCount: "135427",
    subscriberCount: "195",
    hiddenSubscriberCount: false,
    videoCount: "48",
  },
};
const video = (id: string, publishedAt: string, thumb = true) => ({
  id,
  snippet: {
    title: `Video ${id}`,
    publishedAt,
    thumbnails: thumb
      ? { medium: { url: `https://i.ytimg.com/vi/${id}/custom.jpg` } }
      : {},
  },
  statistics: { viewCount: "12", likeCount: "3", commentCount: "1" } as {
    viewCount?: string;
    likeCount?: string;
    commentCount?: string;
  },
});
const vids = ["a", "b", "c", "d", "e", "f", "g"].map((id, i) =>
  video(id, `2026-10-0${i + 1}T00:00:00Z`),
);

describe("aggregateYouTube", () => {
  const s = aggregateYouTube(channel, vids);
  it("converts channel stats to numbers", () => {
    expect(s).toMatchObject({
      title: "Royal T",
      subscribers: 195,
      views: 135427,
      videoCount: 48,
    });
  });
  it("keeps every video, newest first, with watch urls and numeric stats", () => {
    expect(s.videos.map((v) => v.id)).toEqual([
      "g",
      "f",
      "e",
      "d",
      "c",
      "b",
      "a",
    ]);
    expect(s.videos[0]).toEqual({
      id: "g",
      title: "Video g",
      publishedAt: "2026-10-07T00:00:00Z",
      views: 12,
      likes: 3,
      comments: 1,
      thumbnail: "https://i.ytimg.com/vi/g/custom.jpg",
      url: "https://www.youtube.com/watch?v=g",
    });
  });
  it("reports hidden or absent likes and comments as 0", () => {
    const v = video("h", "2026-01-01T00:00:00Z");
    v.statistics = { viewCount: "5" };
    expect(aggregateYouTube(channel, [v]).videos[0]).toMatchObject({
      views: 5,
      likes: 0,
      comments: 0,
    });
  });
  it("reports hidden subscriber counts as null", () => {
    const hidden = {
      ...channel,
      statistics: {
        viewCount: "1",
        hiddenSubscriberCount: true,
        videoCount: "2",
      },
    };
    expect(aggregateYouTube(hidden, []).subscribers).toBeNull();
  });
  it("falls back to the standard thumbnail url", () => {
    expect(
      aggregateYouTube(channel, [video("x", "2026-01-01T00:00:00Z", false)])
        .videos[0].thumbnail,
    ).toBe("https://i.ytimg.com/vi/x/mqdefault.jpg");
  });
});

describe("collectPages", () => {
  // fake API: 3 pages of 2 items, tokens "p1", "p2"
  const pages: Record<string, { items: number[]; nextPageToken?: string }> = {
    "": { items: [1, 2], nextPageToken: "p1" },
    p1: { items: [3, 4], nextPageToken: "p2" },
    p2: { items: [5, 6] },
  };
  it("follows nextPageToken until the last page", async () => {
    const seen: (string | undefined)[] = [];
    const all = await collectPages(async (t) => {
      seen.push(t);
      return pages[t ?? ""];
    }, 500);
    expect(all).toEqual([1, 2, 3, 4, 5, 6]);
    expect(seen).toEqual([undefined, "p1", "p2"]);
  });
  it("stops at the cap without fetching further pages", async () => {
    let calls = 0;
    const all = await collectPages(async (t) => {
      calls++;
      return pages[t ?? ""];
    }, 3);
    expect(all).toEqual([1, 2, 3]);
    expect(calls).toBe(2);
  });
  it("handles a page without items", async () => {
    expect(await collectPages(async () => ({}), 500)).toEqual([]);
  });
});

describe("chunk", () => {
  it("splits ids into batches of at most n", () => {
    const ids = Array.from({ length: 120 }, (_, i) => `v${i}`);
    expect(chunk(ids, 50).map((c) => c.length)).toEqual([50, 50, 20]);
    expect(chunk(ids, 50).flat()).toEqual(ids);
    expect(chunk([], 50)).toEqual([]);
  });
});

describe("youtubeError", () => {
  it("builds a message from status and reason only", () => {
    const body = {
      error: {
        message:
          "key AIzaSECRET invalid at https://www.googleapis.com/youtube/v3/channels?key=AIzaSECRET",
        errors: [{ reason: "quotaExceeded" }],
      },
    };
    const msg = youtubeError(403, body);
    expect(msg).toBe("YouTube HTTP 403 (quotaExceeded)");
    expect(msg).not.toMatch(/AIza|http/);
  });
  it("omits the reason when the body is not the expected shape", () => {
    expect(youtubeError(500, "oops")).toBe("YouTube HTTP 500");
    expect(youtubeError(502, null)).toBe("YouTube HTTP 502");
  });
});
