import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, addMonths, addWeeks, differenceInCalendarDays, format, parseISO } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type TaskInput = Database["public"]["Tables"]["tasks"]["Insert"];
export type Subject = Database["public"]["Tables"]["subjects"]["Row"];
export type CalEvent = Database["public"]["Tables"]["calendar_events"]["Row"];
export type Note = Database["public"]["Tables"]["notes"]["Row"];
export type QuickLink = Database["public"]["Tables"]["quick_links"]["Row"];

function must<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

export const qk = {
  tasks: ["tasks"] as const,
  subjects: ["subjects"] as const,
  events: ["events"] as const,
  notes: ["notes"] as const,
  links: ["links"] as const,
};

export const useTasks = () =>
  useQuery({ queryKey: qk.tasks, queryFn: async () => must(await supabase.from("tasks").select("*").order("due_date", { ascending: true, nullsFirst: false })) });
export const useSubjects = () =>
  useQuery({ queryKey: qk.subjects, queryFn: async () => must(await supabase.from("subjects").select("*").order("name")) });
export const useEvents = () =>
  useQuery({ queryKey: qk.events, queryFn: async () => must(await supabase.from("calendar_events").select("*").order("starts_at")) });
export const useNotes = () =>
  useQuery({ queryKey: qk.notes, queryFn: async () => must(await supabase.from("notes").select("*").order("updated_at", { ascending: false })) });
export const useLinks = () =>
  useQuery({ queryKey: qk.links, queryFn: async () => must(await supabase.from("quick_links").select("*").order("created_at")) });

function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: readonly (readonly string[])[]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
}

const onError = (e: Error) => toast.error(e.message);

export function nextOccurrence(date: string, recurrence: string): string | null {
  const d = parseISO(date);
  const n = recurrence === "daily" ? addDays(d, 1) : recurrence === "weekly" ? addWeeks(d, 1) : recurrence === "monthly" ? addMonths(d, 1) : null;
  return n ? format(n, "yyyy-MM-dd") : null;
}

export function useTaskMutations() {
  const inv = useInvalidate();
  const save = useMutation({
    mutationFn: async (t: TaskInput & { id?: string }) => {
      const { id, ...rest } = t;
      if (id) must(await supabase.from("tasks").update({ ...rest, updated_at: new Date().toISOString() }).eq("id", id));
      else must(await supabase.from("tasks").insert(rest));
    },
    onSuccess: () => inv(qk.tasks),
    onError,
  });
  const toggle = useMutation({
    mutationFn: async (t: Task) => {
      const done = t.status !== "done";
      must(await supabase.from("tasks").update({ status: done ? "done" : "todo", updated_at: new Date().toISOString() }).eq("id", t.id));
      if (done && t.recurrence !== "none" && t.due_date) {
        const next = nextOccurrence(t.due_date, t.recurrence);
        if (next) {
          must(await supabase.from("tasks").insert({
            title: t.title, description: t.description, subject_id: t.subject_id, priority: t.priority,
            due_date: next, due_time: t.due_time, recurrence: t.recurrence, status: "todo",
          }));
          // stop the completed one from recurring again
          must(await supabase.from("tasks").update({ recurrence: "none" }).eq("id", t.id));
        }
      }
    },
    onSuccess: () => inv(qk.tasks),
    onError,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { must(await supabase.from("tasks").delete().eq("id", id)); },
    onSuccess: () => { inv(qk.tasks); toast.success("Tarea eliminada"); },
    onError,
  });
  return { save, toggle, remove };
}

export function useSubjectMutations() {
  const inv = useInvalidate();
  const save = useMutation({
    mutationFn: async (s: { id?: string; name: string; color: string; moodle_url?: string | null }) => {
      const { id, ...rest } = s;
      if (id) must(await supabase.from("subjects").update(rest).eq("id", id));
      else must(await supabase.from("subjects").insert(rest));
    },
    onSuccess: () => inv(qk.subjects),
    onError,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { must(await supabase.from("subjects").delete().eq("id", id)); },
    onSuccess: () => inv(qk.subjects, qk.tasks),
    onError,
  });
  return { save, remove };
}

export function useNoteMutations() {
  const inv = useInvalidate();
  const save = useMutation({
    mutationFn: async (n: { id?: string; content: string }) => {
      if (n.id) must(await supabase.from("notes").update({ content: n.content, updated_at: new Date().toISOString() }).eq("id", n.id));
      else must(await supabase.from("notes").insert({ content: n.content }));
    },
    onSuccess: () => inv(qk.notes),
    onError,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { must(await supabase.from("notes").delete().eq("id", id)); },
    onSuccess: () => inv(qk.notes),
    onError,
  });
  return { save, remove };
}

export function useLinkMutations() {
  const inv = useInvalidate();
  const add = useMutation({
    mutationFn: async (l: { label: string; url: string }) => { must(await supabase.from("quick_links").insert(l)); },
    onSuccess: () => inv(qk.links),
    onError,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { must(await supabase.from("quick_links").delete().eq("id", id)); },
    onSuccess: () => inv(qk.links),
    onError,
  });
  return { add, remove };
}

// ---------- Agenda: tasks + Moodle events merged without duplicates ----------
export type AgendaItem = {
  key: string;
  kind: "task" | "event";
  title: string;
  date: Date;
  allDay: boolean;
  subject: Subject | null;
  done: boolean;
  url: string | null;
  description: string | null;
  task?: Task;
  event?: CalEvent;
};

export function buildAgenda(tasks: Task[], events: CalEvent[], subjects: Subject[]): AgendaItem[] {
  const byId = new Map(subjects.map((s) => [s.id, s]));
  const byName = new Map(subjects.map((s) => [s.name, s]));
  const linked = new Set(tasks.map((t) => t.source_uid).filter(Boolean));
  const items: AgendaItem[] = [];
  for (const t of tasks) {
    if (!t.due_date) continue;
    const date = parseISO(t.due_time ? `${t.due_date}T${t.due_time}` : t.due_date);
    items.push({
      key: "t" + t.id, kind: "task", title: t.title, date, allDay: !t.due_time,
      subject: t.subject_id ? byId.get(t.subject_id) ?? null : null, done: t.status === "done",
      url: null, description: t.description, task: t,
    });
  }
  for (const e of events) {
    if (linked.has(e.uid)) continue;
    items.push({
      key: "e" + e.id, kind: "event", title: e.title, date: new Date(e.starts_at), allDay: false,
      subject: e.course ? byName.get(e.course) ?? null : null, done: false,
      url: e.url, description: e.description, event: e,
    });
  }
  return items.sort((a, b) => a.date.getTime() - b.date.getTime());
}

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
