import { describe, expect, it } from "vitest";
import { buildStudyPlan, minutesLabel, studyStreak } from "./study";

describe("buildStudyPlan", () => {
  const start = new Date(2026, 10, 2); // Mon 2 Nov
  const exam = new Date(2026, 10, 9, 9); // Mon 9 Nov
  it("spreads topics before the exam and keeps review days", () => {
    const plan = buildStudyPlan({ topics: ["T1", "T2", "T3"], start, exam, reviewDays: 1 });
    expect(plan.map((p) => p.title)).toEqual(["T1", "T2", "T3", "Repaso general"]);
    expect(plan.at(-1)!.date).toBe("2026-11-08");
    expect(plan.every((p) => p.date < "2026-11-09")).toBe(true);
    expect(new Set(plan.slice(0, 3).map((p) => p.date)).size).toBe(3);
  });
  it("groups topics when there are more topics than days", () => {
    const plan = buildStudyPlan({ topics: ["a", "b", "c", "d", "e"], start, exam: new Date(2026, 10, 4), reviewDays: 0 });
    expect(plan).toHaveLength(5);
    expect(new Set(plan.map((p) => p.date)).size).toBe(2);
  });
  it("returns nothing when the exam is today or past", () => {
    expect(buildStudyPlan({ topics: ["a"], start, exam: start })).toEqual([]);
  });
  it("prefixes titles with the label", () => {
    expect(buildStudyPlan({ topics: ["Tema 1"], start, exam, reviewDays: 0, label: "Redes" })[0]!.title).toBe("Redes: Tema 1");
  });
});

describe("studyStreak", () => {
  const today = new Date(2026, 9, 29, 18);
  it("counts consecutive days ending today", () => {
    expect(studyStreak(["2026-10-29", "2026-10-28", "2026-10-27", "2026-10-25"], today)).toBe(3);
  });
  it("keeps yesterday's streak alive if today has no study yet", () => {
    expect(studyStreak(["2026-10-28", "2026-10-27"], today)).toBe(2);
  });
  it("is zero after a missed day", () => {
    expect(studyStreak(["2026-10-26"], today)).toBe(0);
  });
});

describe("minutesLabel", () => {
  it("formats hours and minutes", () => {
    expect(minutesLabel(45)).toBe("45 min");
    expect(minutesLabel(120)).toBe("2 h");
    expect(minutesLabel(135)).toBe("2 h 15 min");
  });
});
