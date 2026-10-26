import { createFileRoute } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CheckSquare, Plus, Repeat, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DueBadge, Empty, ErrorBox, Loading, PageHeader, Panel, SubjectDot } from "@/components/dash/common";
import { CalendarView } from "@/components/dash/CalendarView";
import { TaskDialog } from "@/components/dash/TaskDialog";
import { buildAgenda, useSubjects, useTaskMutations, useTasks, type Task } from "@/lib/data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tareas")({
  head: () => ({ meta: [{ title: "Tareas · Panel personal" }, { name: "description", content: "Gestor de tareas." }] }),
  component: TasksPage,
});

const PRIO: Record<string, { label: string; cls: string }> = {
  high: { label: "Alta", cls: "text-destructive" },
  medium: { label: "Media", cls: "text-warning" },
  low: { label: "Baja", cls: "text-muted-foreground" },
};

function TasksPage() {
  const tasks = useTasks();
  const { data: subjects = [] } = useSubjects();
  const { toggle } = useTaskMutations();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("open");
  const [subject, setSubject] = useState("all");
  const [prio, setPrio] = useState("all");
  const [edit, setEdit] = useState<Task | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const all = tasks.data ?? [];
  const filtered = useMemo(() => all.filter((t) => {
    if (status === "open" && t.status === "done") return false;
    if (status === "done" && t.status !== "done") return false;
    if (subject !== "all" && (subject === "none" ? t.subject_id : t.subject_id !== subject)) return false;
    if (prio !== "all" && t.priority !== prio) return false;
    if (q && !`${t.title} ${t.description ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [all, q, status, subject, prio]);

  const done = all.filter((t) => t.status === "done").length;
  const subj = (id: string | null) => subjects.find((s) => s.id === id) ?? null;

  return (
    <div>
      <PageHeader title="Tareas" description={all.length ? `${done} de ${all.length} completadas` : undefined} actions={<Button size="sm" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> Nueva tarea</Button>} />
      {all.length > 0 && <Progress value={(done / all.length) * 100} className="mb-5 h-1.5" />}

      <Tabs defaultValue="list">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <TabsList><TabsTrigger value="list">Lista</TabsTrigger><TabsTrigger value="cal">Calendario</TabsTrigger></TabsList>
          <div className="relative ml-auto w-full sm:w-56">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar…" className="h-9 pl-8" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="open">Pendientes</SelectItem><SelectItem value="done">Hechas</SelectItem><SelectItem value="all">Todas</SelectItem></SelectContent>
          </Select>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              <SelectItem value="none">Personal</SelectItem>
              {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={prio} onValueChange={setPrio}>
            <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Prioridad</SelectItem><SelectItem value="high">Alta</SelectItem><SelectItem value="medium">Media</SelectItem><SelectItem value="low">Baja</SelectItem></SelectContent>
          </Select>
        </div>

        <TabsContent value="list">
          <Panel>
            {tasks.error ? <ErrorBox error={tasks.error} /> : tasks.isLoading ? <Loading /> : filtered.length === 0 ? (
              <Empty icon={CheckSquare} title={all.length ? "Ninguna tarea coincide" : "Aún no tienes tareas"}>{all.length ? "Prueba con otros filtros." : "Crea tu primera tarea con el botón de arriba."}</Empty>
            ) : (
              <ul className="divide-y">
                {filtered.map((t) => {
                  const date = t.due_date ? parseISO(t.due_time ? `${t.due_date}T${t.due_time}` : t.due_date) : null;
                  return (
                    <li key={t.id} className="flex items-center gap-3 py-2.5">
                      <Checkbox checked={t.status === "done"} onCheckedChange={() => toggle.mutate(t)} aria-label="Completar" />
                      <button className="min-w-0 flex-1 text-left" onClick={() => setEdit(t)}>
                        <div className={cn("flex items-center gap-1.5 truncate text-sm", t.status === "done" && "text-muted-foreground line-through")}>
                          {t.title}
                          {t.recurrence !== "none" && <Repeat className="h-3 w-3 text-muted-foreground" />}
                          {t.status === "in_progress" && <span className="rounded bg-accent px-1.5 text-[10px] text-accent-foreground">En curso</span>}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <SubjectDot subject={subj(t.subject_id)} />
                          {subj(t.subject_id)?.name ?? "Personal"}
                          <span className={PRIO[t.priority]?.cls}>· {PRIO[t.priority]?.label}</span>
                          {date && <span>· {format(date, t.due_time ? "d MMM, HH:mm" : "d MMM", { locale: es })}</span>}
                        </div>
                      </button>
                      {date && <DueBadge date={date} done={t.status === "done"} />}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </TabsContent>
        <TabsContent value="cal">
          <Panel><CalendarView items={buildAgenda(filtered, [], subjects)} onSelect={(i) => i.task && setEdit(i.task)} /></Panel>
        </TabsContent>
      </Tabs>

      <TaskDialog open={newOpen || !!edit} onOpenChange={(o) => { if (!o) { setNewOpen(false); setEdit(null); } }} initial={edit} />
    </div>
  );
}
