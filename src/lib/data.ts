import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { Task } from "./agenda";
import { nextOccurrence } from "./agenda";

export * from "./agenda";

type Tables = Database["public"]["Tables"];
type TableName = keyof Tables;
export type TaskInput = Tables["tasks"]["Insert"];
export type Note = Tables["notes"]["Row"];
export type QuickLink = Tables["quick_links"]["Row"];
export type Profile = Tables["profiles"]["Row"];
export type CalendarSource = Omit<Tables["calendar_sources"]["Row"], "ics_url">;
export type GradeItem = Tables["grade_items"]["Row"];
export type Attendance = Tables["attendance"]["Row"];
export type StudySession = Tables["study_sessions"]["Row"];
export type Transaction = Tables["transactions"]["Row"];
export type StudyGroup = Tables["study_groups"]["Row"];
export type GroupMember = Tables["group_members"]["Row"];

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
  profile: ["profile"] as const,
  sources: ["sources"] as const,
  grades: ["grades"] as const,
  sessions: ["sessions"] as const,
  attendance: ["attendance"] as const,
  study: ["study"] as const,
  transactions: ["transactions"] as const,
  groups: ["groups"] as const,
  members: ["members"] as const,
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
export const useProfile = () =>
  useQuery({ queryKey: qk.profile, queryFn: async (): Promise<Profile | null> => must<Profile | null>(await supabase.from("profiles").select("*").maybeSingle()) });
// ics_url is not readable by the browser: always list explicit columns
export const useCalendarSources = () =>
  useQuery({
    queryKey: qk.sources,
    queryFn: async (): Promise<CalendarSource[]> =>
      must(await supabase.from("calendar_sources").select("id, user_id, name, color, kind, last_sync, last_error, created_at").order("created_at")),
  });
export const useGradeItems = () =>
  useQuery({ queryKey: qk.grades, queryFn: async () => must(await supabase.from("grade_items").select("*").order("created_at")) });
export const useClassSessions = () =>
  useQuery({ queryKey: qk.sessions, queryFn: async () => must(await supabase.from("class_sessions").select("*").order("weekday").order("start_time")) });
export const useAttendance = () =>
  useQuery({ queryKey: qk.attendance, queryFn: async () => must(await supabase.from("attendance").select("*").order("date", { ascending: false })) });
export const useStudySessions = () =>
  useQuery({ queryKey: qk.study, queryFn: async () => must(await supabase.from("study_sessions").select("*").order("started_at", { ascending: false }).limit(2000)) });
export const useTransactions = () =>
  useQuery({ queryKey: qk.transactions, queryFn: async () => must(await supabase.from("transactions").select("*").order("date", { ascending: false })) });
export const useGroups = () =>
  useQuery({ queryKey: qk.groups, queryFn: async () => must(await supabase.from("study_groups").select("*").order("created_at")) });
export const useGroupMembers = () =>
  useQuery({ queryKey: qk.members, queryFn: async () => must(await supabase.from("group_members").select("*").order("joined_at")) });

function useInvalidate() {
  const qc = useQueryClient();
  return (...keys: readonly (readonly string[])[]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: k }));
}

const onError = (e: Error) => toast.error(e.message);

/** Insert-or-update and delete for simple per-user tables. */
export function useCrud<N extends TableName>(table: N, key: readonly string[], also: readonly (readonly string[])[] = []) {
  const inv = useInvalidate();
  // supabase-js generics don't narrow over a generic table name; rows are validated by the DB
  const from = () => supabase.from(table) as unknown as {
    insert: (v: unknown) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
    update: (v: unknown) => { eq: (c: string, v: string) => PromiseLike<{ data: unknown; error: { message: string } | null }> };
    delete: () => { eq: (c: string, v: string) => PromiseLike<{ data: unknown; error: { message: string } | null }> };
  };
  const save = useMutation({
    mutationFn: async (row: Tables[N]["Insert"] & { id?: string }) => {
      const { id, ...rest } = row as { id?: string } & Record<string, unknown>;
      if (id) must(await from().update(rest).eq("id", id));
      else must(await from().insert(rest));
    },
    onSuccess: () => inv(key, ...also),
    onError,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { must(await from().delete().eq("id", id)); },
    onSuccess: () => inv(key, ...also),
    onError,
  });
  return { save, remove };
}

export function useProfileMutation() {
  const inv = useInvalidate();
  return useMutation({
    mutationFn: async (patch: Tables["profiles"]["Update"]) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Sesión caducada");
      must(await supabase.from("profiles").upsert({ ...patch, user_id: auth.user.id, updated_at: new Date().toISOString() }));
    },
    onSuccess: () => inv(qk.profile),
    onError,
  });
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
  const saveMany = useMutation({
    mutationFn: async (rows: TaskInput[]) => { must(await supabase.from("tasks").insert(rows)); },
    onSuccess: () => inv(qk.tasks),
    onError,
  });
  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      must(await supabase.from("tasks").update({ status, updated_at: new Date().toISOString() }).eq("id", id));
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
            kind: t.kind, estimate_minutes: t.estimate_minutes, group_id: t.group_id,
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
  return { save, saveMany, setStatus, toggle, remove };
}

export function useSubjectMutations() {
  const { save, remove } = useCrud("subjects", qk.subjects, [qk.tasks, qk.grades, qk.sessions]);
  return { save, remove };
}

export function useNoteMutations() {
  const inv = useInvalidate();
  const save = useMutation({
    mutationFn: async (n: { id?: string; content?: string; title?: string; subject_id?: string | null }) => {
      const { id, ...rest } = n;
      if (id) must(await supabase.from("notes").update({ ...rest, updated_at: new Date().toISOString() }).eq("id", id));
      else must(await supabase.from("notes").insert({ content: "", ...rest }));
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

