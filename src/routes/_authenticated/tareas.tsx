import { createFileRoute } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CheckSquare, ChevronLeft, ChevronRight, ListTree, Plus, Repeat, Search, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CategoryBadge,
  DueBadge,
  Empty,
  ErrorBox,
  Loading,
  PageHeader,
  Panel,
  SubjectDot,
} from "@/components/dash/common";
import { CalendarView } from "@/components/dash/CalendarView";
import { TaskDialog } from "@/components/dash/TaskDialog";
import { buildAgenda, useSubjects, useTaskMutations, useTasks, type AgendaCategory, type Subject, type Task } from "@/lib/data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/tareas")({
  head: () => ({
    meta: [
      { title: "Tareas · Brújula" },
      { name: "description", content: "Gestor de tareas." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { new?: boolean } =>
    search["new"] === true || search["new"] === "true" ? { new: true } : {},
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
  const { toggle, setStatus: moveTask } = useTaskMutations();
  const navigate = Route.useNavigate();
  const { new: openNew } = Route.useSearch();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("open");
  const [subject, setSubject] = useState("all");
  const [prio, setPrio] = useState("all");
  const [edit, setEdit] = useState<Task | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  // Opened via the command palette (/tareas?new=true): show the dialog, then drop the param.
  useEffect(() => {
    if (openNew) {
      setNewOpen(true);
      navigate({ search: {}, replace: true });
    }
  }, [openNew, navigate]);

  const everything = useMemo(() => tasks.data ?? [], [tasks.data]);
  // subtasks live inside their parent task
  const all = useMemo(() => everything.filter((t) => !t.parent_id), [everything]);
  const subCount = useMemo(() => {
    const m = new Map<string, { done: number; total: number }>();
    for (const t of everything) {
      if (!t.parent_id) continue;
      const c = m.get(t.parent_id) ?? { done: 0, total: 0 };
      c.total++;
      if (t.status === "done") c.done++;
      m.set(t.parent_id, c);
    }
    return m;
  }, [everything]);
  const filtered = useMemo(
    () =>
      all.filter((t) => {
        if (status === "open" && t.status === "done") return false;
        if (status === "done" && t.status !== "done") return false;
        if (subject !== "all" && (subject === "none" ? t.subject_id : t.subject_id !== subject))
          return false;
        if (prio !== "all" && t.priority !== prio) return false;
        if (q && !`${t.title} ${t.description ?? ""}`.toLowerCase().includes(q.toLowerCase()))
          return false;
        return true;
      }),
    [all, q, status, subject, prio],
  );

  const done = all.filter((t) => t.status === "done").length;
  const subj = (id: string | null) => subjects.find((s) => s.id === id) ?? null;

  return (
    <div>
      <PageHeader
        title="Tareas"
        description={all.length ? `${done} de ${all.length} completadas` : undefined}
        actions={
          <Button size="sm" onClick={() => setNewOpen(true)}>
            <Plus className="h-4 w-4" /> Nueva tarea
          </Button>
        }
      />
      {all.length > 0 && <Progress value={(done / all.length) * 100} className="mb-5 h-1.5" />}

      <Tabs defaultValue="list">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <TabsList>
            <TabsTrigger value="list">Lista</TabsTrigger>
            <TabsTrigger value="board">Tablero</TabsTrigger>
            <TabsTrigger value="cal">Calendario</TabsTrigger>
          </TabsList>
          <div className="relative ml-auto w-full sm:w-56">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar…"
              className="h-9 pl-8"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-9 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Pendientes</SelectItem>
              <SelectItem value="done">Hechas</SelectItem>
              <SelectItem value="all">Todas</SelectItem>
            </SelectContent>
          </Select>
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger className="h-9 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              <SelectItem value="none">Personal</SelectItem>
              {subjects.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={prio} onValueChange={setPrio}>
            <SelectTrigger className="h-9 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Prioridad</SelectItem>
              <SelectItem value="high">Alta</SelectItem>
              <SelectItem value="medium">Media</SelectItem>
              <SelectItem value="low">Baja</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <TabsContent value="list">
          <Panel>
            {tasks.error ? (
              <ErrorBox error={tasks.error} />
            ) : tasks.isLoading ? (
              <Loading />
            ) : filtered.length === 0 ? (
              <Empty
                icon={CheckSquare}
                title={all.length ? "Ninguna tarea coincide" : "Aún no tienes tareas"}
              >
                {all.length
                  ? "Prueba con otros filtros."
                  : "Crea tu primera tarea con el botón de arriba."}
              </Empty>
            ) : (
              <ul className="divide-y">
                {filtered.map((t) => {
                  const date = t.due_date
                    ? parseISO(t.due_time ? `${t.due_date}T${t.due_time}` : t.due_date)
                    : null;
                  return (
                    <li key={t.id} className="flex items-center gap-3 py-2.5">
                      <Checkbox
                        checked={t.status === "done"}
                        onCheckedChange={() => toggle.mutate(t)}
                        aria-label="Completar"
                      />
                      <button className="min-w-0 flex-1 text-left" onClick={() => setEdit(t)}>
                        <div
                          className={cn(
                            "flex items-center gap-1.5 truncate text-sm",
                            t.status === "done" && "text-muted-foreground line-through",
                          )}
                        >
                          {t.title}
                          {t.recurrence !== "none" && (
                            <Repeat className="h-3 w-3 text-muted-foreground" />
                          )}
                          {t.kind !== "task" && <CategoryBadge category={KIND_CATEGORY[t.kind] ?? "task"} />}
                          {t.group_id && <Users className="h-3 w-3 text-muted-foreground" aria-label="Compartida" />}
                          {subCount.get(t.id) && (
                            <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground">
                              <ListTree className="h-3 w-3" />
                              {subCount.get(t.id)!.done}/{subCount.get(t.id)!.total}
                            </span>
                          )}
                          {t.status === "in_progress" && (
                            <span className="rounded bg-accent px-1.5 text-[10px] text-accent-foreground">
                              En curso
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <SubjectDot subject={subj(t.subject_id)} />
                          {subj(t.subject_id)?.name ?? "Personal"}
                          <span className={PRIO[t.priority]?.cls}>· {PRIO[t.priority]?.label}</span>
                          {!!t.estimate_minutes && <span>· {t.estimate_minutes} min</span>}
                          {date && (
                            <span>
                              ·{" "}
                              {format(date, t.due_time ? "d MMM, HH:mm" : "d MMM", { locale: es })}
                            </span>
                          )}
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
        <TabsContent value="board">
          <Board
            tasks={filtered.filter((t) => status !== "open" || t.status !== "done")}
            allForDone={status === "open" ? all.filter((t) => t.status === "done").slice(0, 20) : []}
            subj={subj}
            onOpen={setEdit}
            onMove={(t, next) => moveTask.mutate({ id: t.id, status: next })}
          />
        </TabsContent>
        <TabsContent value="cal">
          <Panel>
            <CalendarView
              items={buildAgenda(filtered, [], subjects)}
              onSelect={(i) => i.task && setEdit(i.task)}
            />
          </Panel>
        </TabsContent>
      </Tabs>

      <TaskDialog
        open={newOpen || !!edit}
        onOpenChange={(o) => {
          if (!o) {
            setNewOpen(false);
            setEdit(null);
          }
        }}
        initial={edit}
      />
    </div>
  );
}

const KIND_CATEGORY: Record<string, AgendaCategory> = { task: "task", deliverable: "deadline", exam: "exam" };

const COLUMNS = [
  { id: "todo", label: "Pendiente" },
  { id: "in_progress", label: "En curso" },
  { id: "done", label: "Hecha" },
] as const;

function Board({
  tasks,
  allForDone,
  subj,
  onOpen,
  onMove,
}: {
  tasks: Task[];
  allForDone: Task[];
  subj: (id: string | null) => Subject | null;
  onOpen: (t: Task) => void;
  onMove: (t: Task, status: string) => void;
}) {
  const [over, setOver] = useState<string | null>(null);
  const list = [...tasks, ...allForDone];
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {COLUMNS.map((col, ci) => {
        const items = list.filter((t) => (t.status === col.id) || (col.id === "todo" && !COLUMNS.some((c) => c.id === t.status)));
        return (
          <div
            key={col.id}
            onDragOver={(e) => { e.preventDefault(); setOver(col.id); }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const t = list.find((x) => x.id === e.dataTransfer.getData("text/plain"));
              if (t && t.status !== col.id) onMove(t, col.id);
            }}
            className={cn("min-h-40 rounded-lg border bg-muted/30 p-2 transition-colors", over === col.id && "border-primary bg-primary/5")}
          >
            <p className="mb-2 flex items-center justify-between px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {col.label} <span>{items.length}</span>
            </p>
            <div className="space-y-2">
              {items.map((t) => (
                <div
                  key={t.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                  className="cursor-grab rounded-md border bg-card p-2.5 text-sm shadow-sm active:cursor-grabbing"
                >
                  <button className="w-full text-left" onClick={() => onOpen(t)}>
                    <p className={cn("line-clamp-2", t.status === "done" && "text-muted-foreground line-through")}>{t.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <SubjectDot subject={subj(t.subject_id)} />
                      {subj(t.subject_id)?.name ?? "Personal"}
                      {t.due_date && <DueBadge date={parseISO(t.due_date)} done={t.status === "done"} />}
                    </div>
                  </button>
                  {/* touch devices can't drag: arrows move between columns */}
                  <div className="mt-1.5 flex justify-end gap-1 md:hidden">
                    {ci > 0 && <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Mover a la izquierda" onClick={() => onMove(t, COLUMNS[ci - 1]!.id)}><ChevronLeft className="h-3.5 w-3.5" /></Button>}
                    {ci < COLUMNS.length - 1 && <Button size="icon" variant="ghost" className="h-6 w-6" aria-label="Mover a la derecha" onClick={() => onMove(t, COLUMNS[ci + 1]!.id)}><ChevronRight className="h-3.5 w-3.5" /></Button>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
