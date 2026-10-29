import { describe, expect, it } from "vitest";
import { absenceLimit, currentAndNext, expandSessions } from "./timetable";

const sessions = [
  { id: "a", subject_id: "redes", weekday: 1, start_time: "09:00:00", end_time: "11:00:00", room: "203" },
  { id: "b", subject_id: "bd", weekday: 1, start_time: "12:00:00", end_time: "14:00:00", room: null },
  { id: "c", subject_id: "redes", weekday: 3, start_time: "09:00:00", end_time: "11:00:00", room: null },
];

describe("expandSessions", () => {
  it("creates one occurrence per matching weekday", () => {
    const occ = expandSessions(sessions, new Date(2026, 10, 2), new Date(2026, 10, 8)); // Mon–Sun
    expect(occ.map((o) => o.session.id)).toEqual(["a", "b", "c"]);
    expect(occ[0]!.start.getHours()).toBe(9);
  });
});

describe("currentAndNext", () => {
  it("finds the class in progress and the next one", () => {
    const { current, next } = currentAndNext(sessions, new Date(2026, 10, 2, 10, 0));
    expect(current?.session.id).toBe("a");
    expect(next?.session.id).toBe("b");
  });
  it("looks ahead to another day", () => {
    const { current, next } = currentAndNext(sessions, new Date(2026, 10, 2, 15, 0));
    expect(current).toBeNull();
    expect(next?.session.id).toBe("c");
  });
});

describe("absenceLimit", () => {
  it("uses the explicit limit when set", () => expect(absenceLimit(sessions, "redes", 4, 20)).toBe(4));
  it("derives it from weekly sessions over a 15-week term", () => expect(absenceLimit(sessions, "redes", null, 20)).toBe(6));
});
