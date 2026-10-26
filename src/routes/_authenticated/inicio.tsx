import { createFileRoute, Link } from "@tanstack/react-router";
import { format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { Mail, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { AgendaRow, Empty, ErrorBox, Loading, Panel, SubjectDot } from "@/components/dash/common";
import { CalendarView } from "@/components/dash/CalendarView";
import { EventDialog } from "@/components/dash/EventDialog";
import { TaskDialog } from "@/components/dash/TaskDialog";
import { useSubjects, useTaskMutations, useTasks } from "@/lib/data";
import { useAgenda, useAgendaSelection, useGmailStatus } from "@/lib/useAgenda";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({ meta: [{ title: "Inicio · Panel personal" }, { name: "description", content: "Resumen del día." }] }),
  component: Home,
});

function greeting() {
  const h = new Date().getHours();
  return h < 13 ? "Buenos días" : h < 21 ? "Buenas tardes" : "Buenas noches";
}

function Home() {
  const { user } = Route.useRouteContext();
  const { items, isLoading, error } = useAgenda();
  const tasks = useTasks();
  const { data: subjects = [] } = useSubjects();
  const { toggle } = useTaskMutations();
  const gmail = useGmailStatus();
  const sel = useAgendaSelection();
  const [newOpen, setNewOpen] = useState(false);

  const now = new Date();
  const pending = (tasks.data ?? []).filter((t) => t.status !== "done");
  const today = (tasks.data ?? []).filter((t) => t.due_date && isSameDay(new Date(t.due_date + "T00:00"), now));
  const todayDone = today.filter((t) => t.status === "done").length;
  const upcoming = items.filter((i) => !i.done && i.date >= new Date(now.getTime() - 7 * 864e5)).slice(0, 8);
  const subj = (id: string | null) => subjects.find((s) => s.id === id) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm capitalize text-muted-foreground">{format(now, "EEEE, d 'de' MMMM", { locale: es })}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{greeting()}{user.email ? `, ${user.email.split("@")[0]}` : ""}</h1>
        </div>
        <Button size="sm" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> Nueva tarea</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Tareas pendientes" value={tasks.isLoading ? "–" : String(pending.length)} to="/tareas" />
        <Stat label="Entregas próximos 7 días" value={isLoading ? "–" : String(items.filter((i) => !i.done && i.date >= now && i.date.getTime() - now.getTime() < 7 * 864e5).length)} to="/universidad" />
        <Link to="/gmail" className="rounded-lg border bg-card p-4 transition-colors hover:bg-muted/40">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Mail className="h-3.5 w-3.5" /> Correos sin leer</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {gmail.isLoading ? "–" : gmail.data?.connected ? gmail.data.unread : <span className="text-sm font-normal text-muted-foreground">Gmail no conectado</span>}
          </p>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Panel title="Tareas de hoy" className="lg:col-span-2" action={today.length ? <span className="text-xs text-muted-foreground">{Math.round((todayDone / today.length) * 100)}%</span> : null}>
          {tasks.isLoading ? <Loading /> : today.length === 0 ? (
            <Empty title="Nada para hoy">Añade una tarea con fecha de hoy para verla aquí.</Empty>
          ) : (
            <>
              <Progress value={(todayDone / today.length) * 100} className="mb-3 h-1.5" />
              <ul className="space-y-1">
                {today.map((t) => (
                  <li key={t.id} className="flex items-center gap-2.5 rounded-md px-1 py-1.5 hover:bg-muted/60">
                    <Checkbox checked={t.status === "done"} onCheckedChange={() => toggle.mutate(t)} aria-label="Completar" />
                    <SubjectDot subject={subj(t.subject_id)} />
                    <button className={`flex-1 truncate text-left text-sm ${t.status === "done" ? "text-muted-foreground line-through" : ""}`} onClick={() => sel.setTask(t)}>{t.title}</button>
                    {t.due_time && <span className="text-xs text-muted-foreground">{t.due_time.slice(0, 5)}</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </Panel>

        <Panel title="Próximas entregas" className="lg:col-span-3" action={<Link to="/calendario" className="text-xs text-muted-foreground hover:text-foreground">Ver calendario</Link>}>
          {error ? <ErrorBox error={error} /> : isLoading ? <Loading /> : upcoming.length === 0 ? (
            <Empty title="Sin entregas próximas">Conecta tu calendario de Moodle en <Link to="/ajustes" className="underline">Ajustes</Link> o crea tareas con fecha.</Empty>
          ) : upcoming.map((i) => <AgendaRow key={i.key} item={i} onClick={() => sel.select(i)} />)}
        </Panel>
      </div>

      <Panel title="Esta semana">
        <CalendarView items={items} onSelect={sel.select} initialMode="week" compact />
      </Panel>

      <TaskDialog open={newOpen || !!sel.task} onOpenChange={(o) => { if (!o) { setNewOpen(false); sel.setTask(null); } }} initial={sel.task} />
      <EventDialog item={sel.event} onClose={() => sel.setEvent(null)} />
    </div>
  );
}

function Stat({ label, value, to }: { label: string; value: string; to: "/tareas" | "/universidad" }) {
  return (
    <Link to={to} className="rounded-lg border bg-card p-4 transition-colors hover:bg-muted/40">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </Link>
  );
}
