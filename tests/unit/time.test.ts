import { describe, expect, it } from "vitest";
import { ago } from "../../src/lib/time";

const now = new Date("2026-11-01T12:00:00Z");
describe("ago", () => {
  it("formats seconds, minutes, hours, days", () => {
    expect(ago("2026-11-01T11:59:40Z", now)).toBe("just now");
    expect(ago("2026-11-01T11:55:00Z", now)).toBe("5m ago");
    expect(ago("2026-11-01T09:00:00Z", now)).toBe("3h ago");
    expect(ago("2026-10-29T12:00:00Z", now)).toBe("3d ago");
  });
});
