import { describe, expect, it } from "vitest";
import { applyResult, emptySource } from "../../server/cache.ts";

describe("applyResult", () => {
  const now = "2026-11-01T00:00:00Z";
  it("stores new data and clears the error on success", () => {
    const s = applyResult(
      { ...emptySource<number>(), error: "old" },
      { ok: true, data: 1 },
      now,
    );
    expect(s).toEqual({ data: 1, fetchedAt: now, error: null });
  });
  it("keeps last good data and fetchedAt on failure", () => {
    const prev = { data: 1, fetchedAt: "2026-10-31T00:00:00Z", error: null };
    const s = applyResult(prev, { ok: false, error: "HTTP 403" }, now);
    expect(s).toEqual({
      data: 1,
      fetchedAt: "2026-10-31T00:00:00Z",
      error: "HTTP 403",
    });
  });
});
