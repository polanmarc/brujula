import { addDays, differenceInCalendarDays, format, parseISO, startOfDay } from "date-fns";

export type PlannedStudy = { date: string; title: string };

/**
 * Spreads exam topics over the days between `start` and the exam, keeping the last
 * `reviewDays` before the exam for general review. Several topics share a day when
 * there are more topics than days.
 */
export function buildStudyPlan(opts: {
  topics: string[];
  start: Date;
  exam: Date;
  reviewDays?: number;
  label?: string;
}): PlannedStudy[] {
  const topics = opts.topics.map((t) => t.trim()).filter(Boolean);
  const start = startOfDay(opts.start);
  const totalDays = differenceInCalendarDays(startOfDay(opts.exam), start); // days before the exam
  if (totalDays <= 0) return [];
  const reviewDays = Math.min(opts.reviewDays ?? 1, Math.max(0, totalDays - 1));
  const studyDays = totalDays - reviewDays;
  const prefix = opts.label ? `${opts.label}: ` : "";
  const out: PlannedStudy[] = [];
  if (topics.length) {
    const perDay = Math.ceil(topics.length / studyDays);
    const daysUsed = Math.ceil(topics.length / perDay);
    // spread used days evenly across the window
    for (let d = 0; d < daysUsed; d++) {
      const dayIndex = Math.floor((d * studyDays) / daysUsed);
      const date = format(addDays(start, dayIndex), "yyyy-MM-dd");
      for (const t of topics.slice(d * perDay, (d + 1) * perDay)) out.push({ date, title: `${prefix}${t}` });
    }
  }
  for (let r = 0; r < reviewDays; r++) {
    out.push({ date: format(addDays(start, studyDays + r), "yyyy-MM-dd"), title: `${prefix}Repaso general` });
  }
  return out;
}

/** Consecutive days with study, counting back from today (or yesterday if today has none yet). */
export function studyStreak(days: string[], today = new Date()): number {
  const set = new Set(days);
  let cursor = startOfDay(today);
  if (!set.has(format(cursor, "yyyy-MM-dd"))) cursor = addDays(cursor, -1);
  let n = 0;
  while (set.has(format(cursor, "yyyy-MM-dd"))) {
    n++;
    cursor = addDays(cursor, -1);
  }
  return n;
}

export function minutesLabel(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
}

export const dayKey = (iso: string) => format(parseISO(iso), "yyyy-MM-dd");
