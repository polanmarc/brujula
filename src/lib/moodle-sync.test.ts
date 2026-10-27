import { describe, expect, it } from "vitest";
import { isThrottled, SYNC_THROTTLE_MS } from "./moodle-sync";

describe("isThrottled", () => {
  const now = Date.UTC(2026, 9, 27, 12, 0, 0);
  it("never throttles when there is no previous sync", () => {
    expect(isThrottled(null, now)).toBe(false);
    expect(isThrottled(undefined, now)).toBe(false);
  });
  it("throttles a sync within the window", () => {
    const recent = new Date(now - SYNC_THROTTLE_MS + 60_000).toISOString();
    expect(isThrottled(recent, now)).toBe(true);
  });
  it("allows a sync once the window has passed", () => {
    const old = new Date(now - SYNC_THROTTLE_MS - 1).toISOString();
    expect(isThrottled(old, now)).toBe(false);
  });
});
