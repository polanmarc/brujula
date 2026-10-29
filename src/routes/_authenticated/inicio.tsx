import { createFileRoute, Link } from "@tanstack/react-router";
import { format, isSameDay, startOfDay, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, Clock, Flame, Mail, Plus, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { AgendaRow, Empty, ErrorBox, Loading, Panel, SubjectDot } from "@/components/dash/common";
import { CalendarView } from "@/components/dash/CalendarView";
import { EventDialog } from "@/components/dash/EventDialog";
import { TaskDialog } from "@/components/dash/TaskDialog";
import {
  daysLeft,
  isActionable,
  useClassSessions,
  useProfile,
  useProfileMutation,
  useStudySessions,
  useSubjects,
  useTaskMutations,
  useTasks,
} from "@/lib/data";
import { dayKey, minutesLabel, studyStreak } from "@/lib/study";
import { currentAndNext } from "@/lib/timetable";
import { useAgenda, useAgendaSelection, useGmailStatus } from "@/lib/useAgenda";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/inicio")({
  head: () => ({ meta: [{ title: "Inicio · Brújula" }, { name: "description", content: "Resumen del día." }] }),
  component: Home,
});

const WIDGETS = [
  { id: "stats", label: "Resumen" },
  { id: "now", label: "Clase actual y siguiente" },
  { id: "overdue", label: "Vencidas" },
  { id: "today", label: "Tareas de hoy" },
  { id: "upcoming", label: "Próximas entregas y exámenes" },
  { id: "exams", label: "Cuenta atrás de exámenes" },
  { id: "week", label: "Esta semana" },
] as const;
type WidgetId = (typeof WIDGETS)[number]["id"];

function greeting() {
  const h = new Date().getHours();
  return h < 13 ? "Buenos días" : h < 21 ? "Buenas tardes" : "Buenas noches";
}

function Home() {
  const { user } = Route.useRouteContext();
  const { data: profile } = useProfile();
  const { items, isLoading, error } = useAgenda({ withClasses: true });
  const tasks = useTasks();
  const { data: subjects = [] } = useSubjects();
  const { data: sessions = [] } = useClassSessions();
  const { data: study = [] } = useStudySessions();
  const { toggle } = useTaskMutations();
  const gmail = useGmailStatus();
  const sel = useAgendaSelection();
  const [newOpen, setNewOpen] = useState(false);

  const hidden = new Set(profile?.hidden_widgets ?? []);
  const show = (id: WidgetId) => !hidden.has(id);

  const now = new Date();
  const todayStart = startOfDay(now);
  const topLevel = (tasks.data ?? []).filter((t) => !t.parent_id);
  const pending = topLevel.filter((t) => t.status !== "done");
  const today = topLevel.filter((t) => t.due_date && isSameDay(new Date(t.due_date + "T00:00"), now));
  const todayDone = today.filter((t) => t.status === "done").length;
  const actionable = items.filter((i) => isActionable(i) && !i.done);
  const overdue = actionable.filter((i) => i.kind === "task" && i.date < todayStart);
  const upcoming = actionable.filter((i) => i.date >= todayStart && daysLeft(i.date, now) <= 14 && !(i.kind === "task" && i.category === "task" && isSameDay(i.date, now))).slice(0, 8);
  const exams = actionable.filter((i) => i.category === "exam" && i.date >= todayStart).slice(0, 3);
  const deliveries7 = actionable.filter((i) => (i.category === "deadline" || i.category === "exam") && i.date >= now && daysLeft(i.date, now) <= 7).length;
  const subj = (id: string | null) => subjects.find((s) => s.id === id) ?? null;

  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekMinutes = study.filter((s) => new Date(s.started_at) >= weekStart).reduce((n, s) => n + s.minutes, 0);
  const streak = useMemo(() => studyStreak(study.map((s) => dayKey(s.started_at))), [study]);
  const goal = profile?.weekly_goal_minutes ?? 600;
  const name = profile?.display_name || user.email?.split("@")[0] || "";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm capitalize text-muted-foreground">{format(now, "EEEE, d 'de' MMMM", { locale: es })}</p>
          <h1 className="text-2xl font-semibold tracking-tight">{greeting()}{name ? `, ${name}` : ""}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Customize hidden={hidden} />
          <Button size="sm" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> Nueva tarea</Button>
        </div>
      </div>

      {(now.getDay() === 0 || now.getDay() === 1) && (
        <Link to="/estudio" hash="revision" className="block rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm hover:bg-primary/10">
          <span className="font-medium">Revisión semanal disponible.</span>{" "}
          <span className="text-muted-foreground">Mira lo que completaste, tus horas de estudio y lo que viene.</span>
        </Link>
      )}

      {show("stats") && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Tareas pendientes" value={tasks.isLoading ? "–" : String(pending.length)} to="/tareas" />
          <Stat label="Entregas y exámenes · 7 días" value={isLoading ? "–" : String(deliveries7)} to="/calendario" />
          <Link to="/estudio" className="rounded-lg border bg-card p-4 transition-colors hover:bg-muted/40">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Flame className="h-3.5 w-3.5 text-warning" /> Estudio esta semana</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{minutesLabel(weekMinutes)}</p>
            <Progress value={goal ? Math.min(100, (weekMinutes / goal) * 100) : 0} className="mt-2 h-1" />
            <p className="mt-1 text-[11px] text-muted-foreground">Racha: {streak} {streak === 1 ? "día" : "días"}</p>
          </Link>
          <Link to="/gmail" className="rounded-lg border bg-card p-4 transition-colors hover:bg-muted/40">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Mail className="h-3.5 w-3.5" /> Correos sin leer</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {gmail.isLoading ? "–" : gmail.data?.connected ? gmail.data.unread : <span className="text-sm font-normal text-muted-foreground">Sin conectar</span>}
            </p>
          </Link>
        </div>
      )}

      {show("now") && sessions.length > 0 && <NowNext sessions={sessions} subjects={subjects} />}

      {show("overdue") && overdue.length > 0 && (
        <Panel title="Vencidas" className="border-destructive/40" action={<AlertTriangle className="h-4 w-4 text-destructive" />}>
          {overdue.slice(0, 6).map((i) => <AgendaRow key={i.key} item={i} onClick={() => sel.select(i)} />)}
          {overdue.length > 6 && <Link to="/tareas" className="mt-1 block px-2 text-xs text-muted-foreground hover:text-foreground">Ver las {overdue.length}</Link>}
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        {show("today") && (
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
        )}

        {show("upcoming") && (
          <Panel title="Próximas entregas y exámenes" className={show("today") ? "lg:col-span-3" : "lg:col-span-5"} action={<Link to="/calendario" className="text-xs text-muted-foreground hover:text-foreground">Ver calendario</Link>}>
            {error ? <ErrorBox error={error} /> : isLoading ? <Loading /> : upcoming.length === 0 ? (
              <Empty title="Sin entregas próximas">Conecta el calendario de tu campus virtual en <Link to="/ajustes" className="underline">Ajustes</Link> o crea tareas con fecha.</Empty>
            ) : upcoming.map((i) => <AgendaRow key={i.key} item={i} onClick={() => sel.select(i)} />)}
          </Panel>
        )}
      </div>

      {show("exams") && exams.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {exams.map((e) => {
            const d = daysLeft(e.date, now);
            return (
              <button key={e.key} onClick={() => sel.select(e)} className="rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/40">
                <p className="truncate text-xs text-muted-foreground">{e.subject?.name ?? "Examen"}</p>
                <p className="truncate text-sm font-medium">{e.title}</p>
                <p className={cn("mt-2 text-3xl font-semibold tabular-nums", d <= 3 ? "text-destructive" : d <= 7 ? "text-warning" : "")}>
                  {d === 0 ? "Hoy" : d === 1 ? "Mañana" : `${d} días`}
                </p>
                <p className="text-xs text-muted-foreground">{format(e.date, "EEEE d MMM", { locale: es })}</p>
              </button>
            );
          })}
        </div>
      )}

      {show("week") && (
        <Panel title="Esta semana">
          <CalendarView items={items} onSelect={sel.select} initialMode="week" compact />
        </Panel>
      )}

      <TaskDialog open={newOpen || !!sel.task} onOpenChange={(o) => { if (!o) { setNewOpen(false); sel.setTask(null); } }} initial={sel.task} />
      <EventDialog item={sel.event} onClose={() => sel.setEvent(null)} />
    </div>
  );
}

function NowNext({ sessions, subjects }: { sessions: Parameters<typeof currentAndNext>[0]; subjects: { id: string; name: string; color: string }[] }) {
  const { current, next } = currentAndNext(sessions);
  const name = (id: string) => subjects.find((s) => s.id === id);
  const row = (label: string, o: NonNullable<typeof current>, highlight: boolean) => {
    const s = name(o.session.subject_id);
    return (
      <div className={cn("flex min-w-0 flex-1 items-center gap-3 rounded-lg border p-3", highlight ? "border-success/40 bg-success/5" : "bg-card")}>
        <Clock className={cn("h-4 w-4 shrink-0", highlight ? "text-success" : "text-muted-foreground")} />
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="flex items-center gap-1.5 truncate text-sm font-medium">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s?.color }} />
            {s?.name ?? "Clase"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {isSameDay(o.start, new Date()) ? "" : format(o.start, "EEEE ", { locale: es })}
            {format(o.start, "HH:mm")}–{format(o.end, "HH:mm")}{o.session.room ? ` · Aula ${o.session.room}` : ""}
          </p>
        </div>
      </div>
    );
  };
  if (!current && !next) return null;
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      {current && row("Ahora", current, true)}
      {next && row(isSameDay(next.start, new Date()) ? "Siguiente" : "Próxima clase", next, false)}
    </div>
  );
}

function Customize({ hidden }: { hidden: Set<string> }) {
  const update = useProfileMutation();
  const setVisible = (id: string, visible: boolean) => {
    const next = new Set(hidden);
    if (visible) next.delete(id);
    else next.add(id);
    update.mutate({ hidden_widgets: [...next] });
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline"><SlidersHorizontal className="h-4 w-4" /> Personalizar</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 space-y-2">
        <p className="text-sm font-medium">Widgets del inicio</p>
        {WIDGETS.map((w) => (
          <div key={w.id} className="flex items-center justify-between gap-2">
            <Label htmlFor={`w-${w.id}`} className="text-sm font-normal">{w.label}</Label>
            <Switch id={`w-${w.id}`} checked={!hidden.has(w.id)} onCheckedChange={(v) => setVisible(w.id, v)} />
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function Stat({ label, value, to }: { label: string; value: string; to: "/tareas" | "/calendario" }) {
  return (
    <Link to={to} className="rounded-lg border bg-card p-4 transition-colors hover:bg-muted/40">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </Link>
  );
}
