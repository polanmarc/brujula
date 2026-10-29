import { addDays, eachDayOfInterval, format, getISODay, parseISO } from "date-fns";

export type SessionLite = { id: string; subject_id: string; weekday: number; start_time: string; end_time: string; room: string | null };

export const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const at = (day: Date, time: string) => parseISO(`${format(day, "yyyy-MM-dd")}T${time.slice(0, 5)}`);

/** Concrete occurrences of weekly sessions between two dates (inclusive). */
export function expandSessions<S extends SessionLite>(sessions: S[], from: Date, to: Date): { session: S; start: Date; end: Date }[] {
  const out: { session: S; start: Date; end: Date }[] = [];
  for (const day of eachDayOfInterval({ start: from, end: to })) {
    const wd = getISODay(day);
    for (const s of sessions) {
      if (s.weekday === wd) out.push({ session: s, start: at(day, s.start_time), end: at(day, s.end_time) });
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** The class happening now and the next one within the coming week. */
export function currentAndNext<S extends SessionLite>(sessions: S[], now = new Date()) {
  const list = expandSessions(sessions, now, addDays(now, 7));
  const current = list.find((o) => o.start <= now && o.end > now) ?? null;
  const next = list.find((o) => o.start > now) ?? null;
  return { current, next };
}

/** Allowed absences: explicit per-subject limit, else a % of the expected sessions in a 15-week term. */
export function absenceLimit(sessions: SessionLite[], subjectId: string, explicit: number | null, pct: number): number {
  if (explicit !== null && explicit !== undefined) return explicit;
  const perWeek = sessions.filter((s) => s.subject_id === subjectId).length;
  return Math.floor((perWeek * 15 * pct) / 100);
}
