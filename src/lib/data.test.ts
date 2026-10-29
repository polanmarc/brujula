import { describe, expect, it } from "vitest";
import { buildAgenda, dueLabel, isActionable, nextOccurrence, type CalEvent, type ClassSession, type Subject, type Task } from "./agenda";

describe("recurrence", () => {
  it("weekly task moves 7 days", () => expect(nextOccurrence("2026-10-25", "weekly")).toBe("2026-11-01"));
  it("monthly task moves one month", () => expect(nextOccurrence("2026-01-31", "monthly")).toBe("2026-02-28"));
  it("non-recurring returns null", () => expect(nextOccurrence("2026-10-25", "none")).toBeNull());
});

describe("agenda", () => {
  const task = { id: "1", title: "P1", due_date: "2026-11-01", due_time: null, status: "todo", subject_id: null, description: null, source_uid: "u1", kind: "deliverable" } as unknown as Task;
  const ev = { id: "e", uid: "u1", title: "P1", starts_at: "2026-11-01T10:00:00Z", course: null, url: null, description: null, kind: "deadline" } as unknown as CalEvent;

  it("hides a calendar event already turned into a task", () => {
    expect(buildAgenda([task], [ev], [])).toHaveLength(1);
  });
  it("categorises tasks and events", () => {
    const exam = { ...ev, id: "x", uid: "u2", kind: "exam" };
    const items = buildAgenda([task], [exam], []);
    expect(items.map((i) => i.category).sort()).toEqual(["deadline", "exam"]);
  });
  it("adds weekly classes, which are not actionable", () => {
    const sessions = [{ id: "s", subject_id: "sub", weekday: 1, start_time: "09:00:00", end_time: "10:00:00", room: null }] as ClassSession[];
    const subjects = [{ id: "sub", name: "Redes", color: "#000" }] as Subject[];
    const items = buildAgenda([], [], subjects, sessions, new Date(2026, 10, 4));
    expect(items.length).toBeGreaterThan(10);
    expect(items[0]!.title).toBe("Redes");
    expect(items.some(isActionable)).toBe(false);
  });
  it("flags overdue deliveries", () => {
    expect(dueLabel(new Date(2026, 9, 20), new Date(2026, 9, 25)).tone).toBe("overdue");
  });
});
