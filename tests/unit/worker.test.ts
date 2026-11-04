import { describe, expect, it } from "vitest";
import type { StatsResponse } from "../../server/types.ts";
import {
  authorized,
  freshen,
  MAX_BODY,
  parsePush,
} from "../../worker/stats.ts";

const at = "2026-11-04T20:00:00.000Z";
const snapshot = (): StatsResponse =>
  ({
    github: { data: null, fetchedAt: null, error: "x" },
    youtube: { data: null, fetchedAt: null, error: "x" },
    homelab: {
      data: {
        nodes: [
          { id: "web", online: true, reportedAt: "2026-11-04T20:00:00.000Z" },
        ],
      },
      fetchedAt: at,
      error: null,
    },
    now: at,
  }) as unknown as StatsResponse;

describe("authorized", () => {
  it("accepts only the exact bearer token", async () => {
    expect(await authorized("Bearer s3cret", "s3cret")).toBe(true);
    expect(await authorized("Bearer s3cret!", "s3cret")).toBe(false);
    expect(await authorized("s3cret", "s3cret")).toBe(false);
    expect(await authorized(null, "s3cret")).toBe(false);
  });
  it("rejects everything when no secret is configured", async () => {
    expect(await authorized("Bearer ", undefined)).toBe(false);
    expect(await authorized("Bearer ", "")).toBe(false);
  });
});

describe("parsePush", () => {
  it("accepts a stats snapshot", () => {
    expect(parsePush(JSON.stringify(snapshot()))).not.toBeNull();
  });
  it("rejects non-JSON, wrong shapes and oversized bodies", () => {
    expect(parsePush("nope")).toBeNull();
    expect(parsePush("[]")).toBeNull();
    expect(
      parsePush(JSON.stringify({ ...snapshot(), now: "soon" })),
    ).toBeNull();
    expect(
      parsePush(JSON.stringify({ ...snapshot(), github: "x" })),
    ).toBeNull();
    expect(parsePush(" ".repeat(MAX_BODY + 1))).toBeNull();
  });
});

describe("freshen", () => {
  const stored = JSON.stringify(snapshot());
  it("keeps online state while pushes are recent", () => {
    const s = freshen(stored, Date.parse(at) + 2 * 60_000);
    expect(s.homelab.data?.nodes[0].online).toBe(true);
    expect(s.now).toBe("2026-11-04T20:02:00.000Z");
  });
  it("marks machines offline once pushes stop for 3 minutes, keeping their last values", () => {
    const s = freshen(stored, Date.parse(at) + 3 * 60_000);
    expect(s.homelab.data?.nodes[0]).toMatchObject({
      online: false,
      reportedAt: at,
    });
  });
});
