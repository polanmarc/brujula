// Weighted grade math on a 0–10 scale. Weights are percentages of the final grade.
export type GradeItemLite = { weight: number; grade: number | null; max_grade: number };

export type GradeSummary = {
  totalWeight: number;
  gradedWeight: number;
  /** Points already secured towards the final grade (0–10). */
  earned: number;
  /** Average over what has been graded so far, or null if nothing is graded. */
  currentAvg: number | null;
  /** Final grade once everything is graded (totalWeight ≈ 100). */
  final: number | null;
  remainingWeight: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function gradeSummary(items: GradeItemLite[]): GradeSummary {
  const totalWeight = items.reduce((s, i) => s + Number(i.weight), 0);
  const graded = items.filter((i) => i.grade !== null && i.grade !== undefined);
  const gradedWeight = graded.reduce((s, i) => s + Number(i.weight), 0);
  const earned = graded.reduce((s, i) => s + (Number(i.grade) / Number(i.max_grade)) * 10 * (Number(i.weight) / 100), 0);
  const remainingWeight = Math.max(0, 100 - gradedWeight);
  return {
    totalWeight: round2(totalWeight),
    gradedWeight: round2(gradedWeight),
    earned: round2(earned),
    currentAvg: gradedWeight > 0 ? round2((earned * 100) / gradedWeight) : null,
    final: remainingWeight === 0 ? round2(earned) : null,
    remainingWeight: round2(remainingWeight),
  };
}

export type Needed =
  | { status: "secured" }
  | { status: "impossible"; needed: number }
  | { status: "needed"; needed: number }
  | { status: "done"; reached: boolean };

/** Average needed (0–10) on the remaining weight to reach `goal`. */
export function neededFor(summary: GradeSummary, goal: number): Needed {
  if (summary.remainingWeight <= 0) return { status: "done", reached: summary.earned >= goal };
  const needed = round2(((goal - summary.earned) * 100) / summary.remainingWeight);
  if (needed <= 0) return { status: "secured" };
  if (needed > 10) return { status: "impossible", needed };
  return { status: "needed", needed };
}

/** Credit-weighted average across subjects (subjects without grades or credits count as 1 credit). */
export function overallAverage(rows: { avg: number | null; credits: number | null }[]): number | null {
  const valid = rows.filter((r) => r.avg !== null);
  if (!valid.length) return null;
  const totalCredits = valid.reduce((s, r) => s + (r.credits || 1), 0);
  return round2(valid.reduce((s, r) => s + r.avg! * (r.credits || 1), 0) / totalCredits);
}
