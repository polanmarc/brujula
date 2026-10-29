import { describe, expect, it } from "vitest";
import { classifyEvent, isThrottled, mapLimit, SYNC_THROTTLE_MS } from "./calendar-sync";

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

describe("classifyEvent", () => {
  it("timetable feeds are classes", () => expect(classifyEvent("Examen final", "classes")).toBe("class"));
  it("detects exams by title", () => expect(classifyEvent("Examen parcial de Redes", "deadlines")).toBe("exam"));
  it("defaults to deadlines", () => expect(classifyEvent("Entrega práctica 2", "deadlines")).toBe("deadline"));
  it("other feeds are generic events", () => expect(classifyEvent("Charla", "other")).toBe("event"));
});

describe("mapLimit", () => {
  it("keeps order and never exceeds the limit", async () => {
    let running = 0;
    let peak = 0;
    const out = await mapLimit([1, 2, 3, 4, 5], 2, async (n) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      return n * 2;
    });
    expect(out).toEqual([2, 4, 6, 8, 10]);
    expect(peak).toBeLessThanOrEqual(2);
  });
});
