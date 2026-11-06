import { describe, expect, it } from "vitest";
import { classifyEvent, isThrottled, localDueParts, mapLimit, rescheduledEvents, staleEventIds, SYNC_THROTTLE_MS, taskFromEvent } from "./calendar-sync";

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

describe("staleEventIds", () => {
  const now = Date.UTC(2026, 10, 5, 12, 0, 0);
  const at = (days: number) => new Date(now + days * 86_400_000).toISOString();
  const stored = [
    { id: "a", uid: "kept@moodle", starts_at: at(3) },
    { id: "b", uid: "deleted@moodle", starts_at: at(3) },
    { id: "c", uid: "old@moodle", starts_at: at(-10) },
  ];
  it("returns future events missing from the feed", () => {
    expect(staleEventIds(stored, ["kept@moodle"], now)).toEqual(["b"]);
  });
  it("keeps past events even if the feed dropped them", () => {
    expect(staleEventIds(stored, ["kept@moodle", "deleted@moodle"], now)).toEqual([]);
  });
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

describe("localDueParts", () => {
  it("converts UTC to Madrid local time (winter, UTC+1)", () =>
    expect(localDueParts("2026-11-20T22:59:00.000Z")).toEqual({ due_date: "2026-11-20", due_time: "23:59" }));
  it("rolls over the day near midnight (summer, UTC+2)", () =>
    expect(localDueParts("2026-06-10T22:30:00.000Z")).toEqual({ due_date: "2026-06-11", due_time: "00:30" }));
});

describe("taskFromEvent", () => {
  const ev = { uid: "u1@moodle", title: "Entrega práctica 2", description: "PDF", starts_at: "2026-11-20T22:59:00.000Z" };
  it("builds a high-priority deliverable linked to the event", () =>
    expect(taskFromEvent(ev, "user", "subj")).toMatchObject({
      user_id: "user", title: "Entrega práctica 2", subject_id: "subj", due_date: "2026-11-20", due_time: "23:59",
      priority: "high", kind: "deliverable", status: "todo", source_uid: "u1@moodle",
    }));
  it("marks exams by title", () => expect(taskFromEvent({ ...ev, title: "Examen parcial" }, "user", null).kind).toBe("exam"));
});

describe("rescheduledEvents", () => {
  it("reports an event moved to another day with its old and new local due", () =>
    expect(
      rescheduledEvents([{ uid: "a", starts_at: "2026-11-10T22:59:00Z" }], [{ uid: "a", starts_at: "2026-11-20T22:59:00Z" }]),
    ).toEqual([
      { uid: "a", from: { due_date: "2026-11-10", due_time: "23:59" }, to: { due_date: "2026-11-20", due_time: "23:59" } },
    ]));
  it("ignores unchanged and new events", () =>
    expect(
      rescheduledEvents(
        [{ uid: "a", starts_at: "2026-11-10T22:59:00.000Z" }],
        [{ uid: "a", starts_at: "2026-11-10T22:59:00Z" }, { uid: "b", starts_at: "2026-11-12T10:00:00Z" }],
      ),
    ).toEqual([]));
});
