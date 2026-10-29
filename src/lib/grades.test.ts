import { describe, expect, it } from "vitest";
import { gradeSummary, neededFor, overallAverage } from "./grades";

describe("gradeSummary", () => {
  it("weights graded items and reports what remains", () => {
    const s = gradeSummary([
      { weight: 30, grade: 8, max_grade: 10 },
      { weight: 20, grade: 15, max_grade: 20 }, // 7.5 on a 0-10 scale
      { weight: 50, grade: null, max_grade: 10 },
    ]);
    expect(s.gradedWeight).toBe(50);
    expect(s.earned).toBe(3.9); // 8*0.3 + 7.5*0.2
    expect(s.currentAvg).toBe(7.8);
    expect(s.remainingWeight).toBe(50);
    expect(s.final).toBeNull();
  });
  it("gives the final grade once everything is graded", () => {
    const s = gradeSummary([{ weight: 40, grade: 6, max_grade: 10 }, { weight: 60, grade: 4, max_grade: 10 }]);
    expect(s.final).toBe(4.8);
  });
  it("handles subjects without grades", () => {
    expect(gradeSummary([]).currentAvg).toBeNull();
  });
});

describe("neededFor", () => {
  const half = gradeSummary([{ weight: 50, grade: 4, max_grade: 10 }, { weight: 50, grade: null, max_grade: 10 }]);
  it("computes the average needed on the rest", () => {
    expect(neededFor(half, 5)).toEqual({ status: "needed", needed: 6 });
  });
  it("flags impossible goals", () => {
    expect(neededFor(half, 9.5).status).toBe("impossible");
  });
  it("flags already secured goals", () => {
    const strong = gradeSummary([{ weight: 70, grade: 9, max_grade: 10 }, { weight: 30, grade: null, max_grade: 10 }]);
    expect(neededFor(strong, 5)).toEqual({ status: "secured" });
  });
  it("reports pass/fail when nothing remains", () => {
    const done = gradeSummary([{ weight: 100, grade: 4.9, max_grade: 10 }]);
    expect(neededFor(done, 5)).toEqual({ status: "done", reached: false });
  });
});

describe("overallAverage", () => {
  it("weights by credits and skips ungraded subjects", () => {
    expect(overallAverage([{ avg: 8, credits: 6 }, { avg: 5, credits: 3 }, { avg: null, credits: 6 }])).toBe(7);
  });
});
