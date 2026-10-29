// Pure agenda logic shared by the browser and server code (no Supabase client here).
import { addDays, addMonths, addWeeks, differenceInCalendarDays, format, parseISO } from "date-fns";
import type { Database } from "@/integrations/supabase/types";
import { expandSessions } from "./timetable";

type Tables = Database["public"]["Tables"];
export type Task = Tables["tasks"]["Row"];
export type Subject = Tables["subjects"]["Row"];
export type CalEvent = Tables["calendar_events"]["Row"];
export type ClassSession = Tables["class_sessions"]["Row"];

export function nextOccurrence(date: string, recurrence: string): string | null {
  const d = parseISO(date);
  const n = recurrence === "daily" ? addDays(d, 1) : recurrence === "weekly" ? addWeeks(d, 1) : recurrence === "monthly" ? addMonths(d, 1) : null;
  return n ? format(n, "yyyy-MM-dd") : null;
}

// ---------- Agenda: tasks + calendar events + timetable merged without duplicates ----------
export type AgendaCategory = "task" | "deadline" | "exam" | "class" | "event";

export type AgendaItem = {
  key: string;
  kind: "task" | "event" | "class";
  category: AgendaCategory;
  title: string;
  date: Date;
  end?: Date;
  allDay: boolean;
  subject: Subject | null;
  done: boolean;
  url: string | null;
  description: string | null;
  task?: Task;
  event?: CalEvent;
  session?: ClassSession;
};

export const CATEGORY_LABEL: Record<AgendaCategory, string> = {
  task: "Tarea",
  deadline: "Entrega",
  exam: "Examen",
  class: "Clase",
  event: "Evento",
};

const TASK_CATEGORY: Record<string, AgendaCategory> = { task: "task", deliverable: "deadline", exam: "exam" };
const EVENT_CATEGORY: Record<string, AgendaCategory> = { deadline: "deadline", exam: "exam", class: "class", event: "event" };

export function buildAgenda(
  tasks: Task[],
  events: CalEvent[],
  subjects: Subject[],
  sessions: ClassSession[] = [],
  now = new Date(),
): AgendaItem[] {
  const byId = new Map(subjects.map((s) => [s.id, s]));
  const byName = new Map(subjects.map((s) => [s.name, s]));
  const linked = new Set(tasks.map((t) => t.source_uid).filter(Boolean));
  const items: AgendaItem[] = [];
  for (const t of tasks) {
    if (!t.due_date) continue;
    const date = parseISO(t.due_time ? `${t.due_date}T${t.due_time}` : t.due_date);
    items.push({
      key: "t" + t.id, kind: "task", category: TASK_CATEGORY[t.kind] ?? "task", title: t.title, date, allDay: !t.due_time,
      subject: t.subject_id ? byId.get(t.subject_id) ?? null : null, done: t.status === "done",
      url: null, description: t.description, task: t,
    });
  }
  for (const e of events) {
    if (linked.has(e.uid)) continue;
    items.push({
      key: "e" + e.id, kind: "event", category: EVENT_CATEGORY[e.kind] ?? "deadline", title: e.title,
      date: new Date(e.starts_at), ...(e.ends_at ? { end: new Date(e.ends_at) } : {}), allDay: false,
      subject: e.course ? byName.get(e.course) ?? null : null, done: false,
      url: e.url, description: e.description, event: e,
    });
  }
  if (sessions.length) {
    for (const o of expandSessions(sessions, addDays(now, -14), addDays(now, 120))) {
      const subject = byId.get(o.session.subject_id) ?? null;
      items.push({
        key: `c${o.session.id}-${format(o.start, "yyyyMMdd")}`, kind: "class", category: "class",
        title: subject?.name ?? "Clase", date: o.start, end: o.end, allDay: false, subject, done: false,
        url: null, description: o.session.room ? `Aula ${o.session.room}` : null, session: o.session,
      });
    }
  }
  return items.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Items that need action (no classes or generic events). */
export const isActionable = (i: AgendaItem) => i.category !== "class" && i.category !== "event";

export function daysLeft(d: Date, now = new Date()) {
  return differenceInCalendarDays(d, now);
}

export function dueLabel(d: Date, now = new Date()) {
  const n = daysLeft(d, now);
  if (n < 0) return { text: `Vencida hace ${-n} d`, tone: "overdue" as const };
  if (n === 0) return { text: "Hoy", tone: "soon" as const };
  if (n === 1) return { text: "Mañana", tone: "soon" as const };
  if (n <= 3) return { text: `En ${n} días`, tone: "soon" as const };
  return { text: `En ${n} días`, tone: "normal" as const };
}
