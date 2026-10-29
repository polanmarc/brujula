import { describe, expect, it } from "vitest";
import { buildIcsFeed } from "./ics-export";
import { parseIcs } from "./ics";

const base = { description: null, created_at: "", updated_at: "", user_id: "u", priority: "medium", recurrence: "none", source_uid: null, subject_id: null, estimate_minutes: null, group_id: null, parent_id: null };

describe("buildIcsFeed", () => {
  const feed = buildIcsFeed({
    tasks: [
      { ...base, id: "t1", title: "Entrega P1, final", due_date: "2026-11-10", due_time: "23:59:00", status: "todo", kind: "deliverable" },
      { ...base, id: "t2", title: "Hecha", due_date: "2026-11-10", due_time: null, status: "done", kind: "task" },
      { ...base, id: "t3", title: "Leer tema", due_date: "2026-11-11", due_time: null, status: "todo", kind: "task", source_uid: "dup" },
    ],
    events: [
      { id: "e1", uid: "dup", title: "Duplicado", description: null, course: null, starts_at: "2026-11-11T10:00:00Z", ends_at: null, url: null, source: "ics", source_id: null, kind: "deadline", updated_at: "", user_id: "u" },
      { id: "e2", uid: "x@moodle", title: "Examen", description: null, course: "Redes", starts_at: "2026-11-12T08:00:00Z", ends_at: null, url: null, source: "ics", source_id: null, kind: "exam", updated_at: "", user_id: "u" },
    ],
    sessions: [{ id: "s1", user_id: "u", subject_id: "sub", weekday: 2, start_time: "09:00:00", end_time: "11:00:00", room: "A1" }],
    subjects: [{ id: "sub", name: "Redes", color: "#000", created_at: "", user_id: "u", moodle_url: null, teacher: null, room: null, credits: null, absence_limit: null, pass_grade: 5, target_grade: null }],
    now: new Date(2026, 10, 2),
  });

  it("is a valid calendar our own parser can read back", () => {
    const events = parseIcs(feed);
    expect(events.map((e) => e.title)).toEqual(["Entrega: Entrega P1, final", "Tarea: Leer tema", "Examen", "Redes"]);
  });
  it("skips done tasks and events already turned into tasks", () => {
    expect(feed).not.toContain("Hecha");
    expect(feed).not.toContain("Duplicado");
  });
  it("uses floating local time for tasks and weekly rules for classes", () => {
    expect(feed).toContain("DTSTART:20261110T235900");
    expect(feed).toContain("RRULE:FREQ=WEEKLY;BYDAY=TU;COUNT=20");
    expect(feed).toContain("LOCATION:A1");
  });
  it("uses CRLF line endings", () => {
    expect(feed.split("\r\n").length).toBeGreaterThan(10);
  });
});
