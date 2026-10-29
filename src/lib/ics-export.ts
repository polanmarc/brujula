// Builds a read-only iCalendar feed (tasks with dates, calendar events and the weekly timetable)
// so students can subscribe from Google Calendar, Apple Calendar or Outlook.
import { format } from "date-fns";
import type { CalEvent, ClassSession, Subject, Task } from "./agenda";

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const utc = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
// floating local time: calendar apps show it in the subscriber's timezone (the server runs in UTC)
const local = (date: string, time: string) => `${date.replace(/-/g, "")}T${time.slice(0, 5).replace(":", "")}00`;
const BYDAY = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

/** Fold lines longer than 75 octets (RFC 5545 §3.1). */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = " " + rest.slice(74);
  }
  out.push(rest);
  return out.join("\r\n");
}

export function buildIcsFeed(opts: {
  tasks: Task[];
  events: CalEvent[];
  sessions: ClassSession[];
  subjects: Subject[];
  now?: Date;
}): string {
  const stamp = utc(opts.now ?? new Date());
  const subj = new Map(opts.subjects.map((s) => [s.id, s.name]));
  const linked = new Set(opts.tasks.map((t) => t.source_uid).filter(Boolean));
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Brujula//Panel estudiante//ES", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Brújula", "X-PUBLISHED-TTL:PT1H"];

  for (const t of opts.tasks) {
    if (!t.due_date || t.status === "done") continue;
    lines.push("BEGIN:VEVENT", `UID:task-${t.id}@brujula`, `DTSTAMP:${stamp}`);
    if (t.due_time) {
      lines.push(`DTSTART:${local(t.due_date, t.due_time)}`, "DURATION:PT30M");
    } else {
      lines.push(`DTSTART;VALUE=DATE:${t.due_date.replace(/-/g, "")}`);
    }
    const label = t.kind === "exam" ? "Examen" : t.kind === "deliverable" ? "Entrega" : "Tarea";
    lines.push(`SUMMARY:${esc(`${label}: ${t.title}`)}`);
    const desc = [t.subject_id ? subj.get(t.subject_id) : null, t.description].filter(Boolean).join("\n");
    if (desc) lines.push(`DESCRIPTION:${esc(desc)}`);
    lines.push("END:VEVENT");
  }

  for (const e of opts.events) {
    if (linked.has(e.uid) || e.kind === "class") continue;
    const start = new Date(e.starts_at);
    lines.push("BEGIN:VEVENT", `UID:${esc(e.uid)}`, `DTSTAMP:${stamp}`, `DTSTART:${utc(start)}`);
    if (e.ends_at) lines.push(`DTEND:${utc(new Date(e.ends_at))}`);
    lines.push(`SUMMARY:${esc(e.title)}`);
    if (e.course) lines.push(`CATEGORIES:${esc(e.course)}`);
    if (e.url) lines.push(`URL:${e.url}`);
    lines.push("END:VEVENT");
  }

  // weekly classes: anchor on the next occurrence and repeat for ~20 weeks
  const now = opts.now ?? new Date();
  for (const s of opts.sessions) {
    const anchor = new Date(now);
    const diff = (s.weekday - (((anchor.getDay() + 6) % 7) + 1) + 7) % 7;
    anchor.setDate(anchor.getDate() + diff);
    const day = format(anchor, "yyyy-MM-dd");
    lines.push(
      "BEGIN:VEVENT",
      `UID:class-${s.id}@brujula`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${local(day, s.start_time)}`,
      `DTEND:${local(day, s.end_time)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[s.weekday - 1]};COUNT=20`,
      `SUMMARY:${esc(subj.get(s.subject_id) ?? "Clase")}`,
    );
    if (s.room) lines.push(`LOCATION:${esc(s.room)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** Handles GET /api/ics/<token>.ics */
export async function handleIcsFeed(request: Request): Promise<Response> {
  const token = new URL(request.url).pathname.match(/^\/api\/ics\/([a-f0-9]{32,80})\.ics$/)?.[1];
  if (!token) return new Response("Not found", { status: 404 });
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: profile } = await supabaseAdmin.from("profiles").select("user_id").eq("feed_token", token).maybeSingle();
  if (!profile) return new Response("Not found", { status: 404 });
  const uid = profile.user_id;
  const [tasks, events, sessions, subjects] = await Promise.all([
    supabaseAdmin.from("tasks").select("*").eq("user_id", uid),
    supabaseAdmin.from("calendar_events").select("*").eq("user_id", uid),
    supabaseAdmin.from("class_sessions").select("*").eq("user_id", uid),
    supabaseAdmin.from("subjects").select("*").eq("user_id", uid),
  ]);
  const body = buildIcsFeed({ tasks: tasks.data ?? [], events: events.data ?? [], sessions: sessions.data ?? [], subjects: subjects.data ?? [] });
  return new Response(body, {
    headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "private, max-age=900" },
  });
}
