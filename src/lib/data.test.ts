import { describe, expect, it } from "vitest";
import { buildAgenda, dueLabel, nextOccurrence } from "./data";

describe("recurrence", () => {
  it("weekly task moves 7 days", () => expect(nextOccurrence("2026-10-25", "weekly")).toBe("2026-11-01"));
  it("monthly task moves one month", () => expect(nextOccurrence("2026-01-31", "monthly")).toBe("2026-02-28"));
  it("non-recurring returns null", () => expect(nextOccurrence("2026-10-25", "none")).toBeNull());
});

describe("agenda", () => {
  it("hides a Moodle event already turned into a task", () => {
    const task: any = { id: "1", title: "P1", due_date: "2026-11-01", due_time: null, status: "todo", subject_id: null, description: null, source_uid: "u1" };
    const ev: any = { id: "e", uid: "u1", title: "P1", starts_at: "2026-11-01T10:00:00Z", course: null, url: null, description: null };
    expect(buildAgenda([task], [ev], [])).toHaveLength(1);
  });
  it("flags overdue deliveries", () => {
    expect(dueLabel(new Date(2026, 9, 20), new Date(2026, 9, 25)).tone).toBe("overdue");
  });
});
