import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { buildAgenda, useClassSessions, useEvents, useSubjects, useTasks, type AgendaItem } from "./data";
import { gmailStatus } from "./gmail.functions";

export function useAgenda({ withClasses = false }: { withClasses?: boolean } = {}) {
  const tasks = useTasks();
  const events = useEvents();
  const subjects = useSubjects();
  const sessions = useClassSessions();
  const items = useMemo(
    () => buildAgenda(tasks.data ?? [], events.data ?? [], subjects.data ?? [], withClasses ? sessions.data ?? [] : []),
    [tasks.data, events.data, subjects.data, sessions.data, withClasses],
  );
  return { items, isLoading: tasks.isLoading || events.isLoading || subjects.isLoading, error: tasks.error ?? events.error ?? subjects.error };
}

export function useGmailStatus() {
  const fn = useServerFn(gmailStatus);
  return useQuery({ queryKey: ["gmail", "status"], queryFn: () => fn(), refetchInterval: 120_000, retry: false });
}

/** Opens TaskDialog for tasks and EventDialog for calendar events and classes. */
export function useAgendaSelection() {
  const [task, setTask] = useState<AgendaItem["task"] | null>(null);
  const [event, setEvent] = useState<AgendaItem | null>(null);
  const select = (i: AgendaItem) => (i.kind === "task" ? setTask(i.task ?? null) : setEvent(i));
  return { task, setTask, event, setEvent, select };
}
