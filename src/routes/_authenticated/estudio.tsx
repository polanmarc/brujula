import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { addDays, eachDayOfInterval, format, parseISO, startOfDay, startOfWeek, subWeeks } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarCheck, Flame, Loader2, Pause, Play, SkipForward, Sparkles, Square, Target } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { AgendaRow, Empty, ErrorBox, PageHeader, Panel } from "@/components/dash/common";
import { useAiAvailable } from "@/components/dash/SyllabusImport";
import { planWeek } from "@/lib/ai.functions";
import { daysLeft, isActionable, useProfile, useStudySessions, useSubjects, useTaskMutations, useTasks, type AgendaItem } from "@/lib/data";
import { buildStudyPlan, dayKey, minutesLabel, studyStreak } from "@/lib/study";
import { useAgenda } from "@/lib/useAgenda";
import { clock, useTimer } from "@/lib/useTimer";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/estudio")({
  head: () => ({ meta: [{ title: "Estudio · Brújula" }, { name: "description", content: "Pomodoro, horas de estudio, exámenes y revisión semanal." }] }),
  component: StudyPage,
});

function StudyPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Estudio" description="Concéntrate, mide tus horas y prepara los exámenes." />
      <div className="grid gap-4 lg:grid-cols-5">
        <TimerCard />
        <StatsCard />
      </div>
      <ExamMode />
      <WeeklyReview />
      <AiWeekPlan />
    </div>
  );
}

function TimerCard() {
  const { state, seconds, configure, start, stop, skip } = useTimer();
  const { data: subjects = [] } = useSubjects();
  const running = state.phase !== "idle";
  const total = (state.phase === "break" ? state.breakMin : state.focusMin) * 60;
  return (
    <Panel title="Temporizador" className="lg:col-span-2">
      <div className="space-y-4">
        <ToggleGroup type="single" size="sm" value={state.mode} disabled={running} onValueChange={(v) => v && configure({ mode: v as "pomodoro" | "free" })} className="w-full">
          <ToggleGroupItem value="pomodoro" className="flex-1">Pomodoro</ToggleGroupItem>
          <ToggleGroupItem value="free" className="flex-1">Cronómetro</ToggleGroupItem>
        </ToggleGroup>
        <div className="text-center">
          <p className={cn("text-xs font-medium uppercase tracking-wide", state.phase === "break" ? "text-success" : "text-muted-foreground")}>
            {state.phase === "idle" ? "Listo" : state.phase === "break" ? "Descanso" : "Concentración"}
            {state.mode === "pomodoro" && running ? ` · bloque ${state.cycles + (state.phase === "focus" ? 1 : 0)}` : ""}
          </p>
          <p className="my-2 text-6xl font-semibold tabular-nums tracking-tight">
            {state.phase === "idle" ? (state.mode === "free" ? "00:00" : clock(state.focusMin * 60)) : clock(seconds)}
          </p>
          {state.mode === "pomodoro" && running && <Progress value={100 - (seconds / total) * 100} className="h-1" />}
        </div>
        <Select value={state.subjectId ?? "none"} onValueChange={(v) => configure({ subjectId: v === "none" ? null : v })} disabled={running}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sin asignatura</SelectItem>
            {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {state.mode === "pomodoro" && !running && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label htmlFor="focus" className="text-xs">Concentración (min)</Label><Input id="focus" type="number" min={5} max={120} value={state.focusMin} onChange={(e) => configure({ focusMin: Math.max(5, Math.min(120, Number(e.target.value) || 25)) })} /></div>
            <div className="space-y-1"><Label htmlFor="break" className="text-xs">Descanso (min)</Label><Input id="break" type="number" min={1} max={60} value={state.breakMin} onChange={(e) => configure({ breakMin: Math.max(1, Math.min(60, Number(e.target.value) || 5)) })} /></div>
          </div>
        )}
        <div className="flex gap-2">
          {!running ? (
            <Button className="flex-1" onClick={start}><Play className="h-4 w-4" /> Empezar</Button>
          ) : (
            <>
              <Button className="flex-1" variant="outline" onClick={() => stop(true)}>
                {state.mode === "free" ? <Square className="h-4 w-4" /> : <Pause className="h-4 w-4" />} {state.mode === "free" ? "Parar y guardar" : "Terminar"}
              </Button>
              {state.mode === "pomodoro" && <Button variant="ghost" onClick={skip} aria-label="Saltar fase"><SkipForward className="h-4 w-4" /></Button>}
            </>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Cada bloque completado se guarda en tus estadísticas. Cada 4 bloques, descanso largo.</p>
      </div>
    </Panel>
  );
}

const chartConfig = { minutes: { label: "Minutos", color: "var(--primary)" } } satisfies ChartConfig;

function StatsCard() {
  const { data: sessions = [] } = useStudySessions();
  const { data: subjects = [] } = useSubjects();
  const { data: profile } = useProfile();
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const week = sessions.filter((s) => new Date(s.started_at) >= weekStart);
  const weekMin = week.reduce((n, s) => n + s.minutes, 0);
  const goal = profile?.weekly_goal_minutes ?? 600;
  const streak = useMemo(() => studyStreak(sessions.map((s) => dayKey(s.started_at))), [sessions]);

  const daily = useMemo(() => {
    const byDay = new Map<string, number>();
    for (const s of sessions) byDay.set(dayKey(s.started_at), (byDay.get(dayKey(s.started_at)) ?? 0) + s.minutes);
    return eachDayOfInterval({ start: addDays(startOfDay(now), -13), end: startOfDay(now) }).map((d) => ({
      day: format(d, "EEEEEE d", { locale: es }),
      minutes: byDay.get(format(d, "yyyy-MM-dd")) ?? 0,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions]);

  const bySubject = subjects
    .map((s) => ({ s, min: week.filter((x) => x.subject_id === s.id).reduce((n, x) => n + x.minutes, 0) }))
    .filter((x) => x.min > 0)
    .sort((a, b) => b.min - a.min);
  const maxSubj = bySubject[0]?.min ?? 1;

  return (
    <Panel title="Tus horas de estudio" className="lg:col-span-3">
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div><p className="text-xs text-muted-foreground">Esta semana</p><p className="text-2xl font-semibold tabular-nums">{minutesLabel(weekMin)}</p></div>
        <div><p className="flex items-center gap-1 text-xs text-muted-foreground"><Target className="h-3 w-3" /> Objetivo</p><p className="text-2xl font-semibold tabular-nums">{goal ? Math.round((weekMin / goal) * 100) : 0}%</p></div>
        <div><p className="flex items-center gap-1 text-xs text-muted-foreground"><Flame className="h-3 w-3 text-warning" /> Racha</p><p className="text-2xl font-semibold tabular-nums">{streak} d</p></div>
      </div>
      <Progress value={goal ? Math.min(100, (weekMin / goal) * 100) : 0} className="mb-4 h-1.5" />
      {sessions.length === 0 ? (
        <Empty title="Aún no hay sesiones">Usa el temporizador para empezar a registrar tus horas.</Empty>
      ) : (
        <>
          <p className="mb-1 text-xs text-muted-foreground">Minutos por día · últimos 14 días</p>
          <ChartContainer config={chartConfig} className="h-40 w-full">
            <BarChart data={daily} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid vertical={false} strokeOpacity={0.4} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} fontSize={10} interval={1} />
              <YAxis tickLine={false} axisLine={false} fontSize={10} width={40} allowDecimals={false} />
              <ChartTooltip cursor={{ fillOpacity: 0.15 }} content={<ChartTooltipContent />} />
              <Bar dataKey="minutes" fill="var(--color-minutes)" radius={[4, 4, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ChartContainer>
          {bySubject.length > 0 && (
            <div className="mt-4 space-y-1.5">
              <p className="text-xs text-muted-foreground">Esta semana por asignatura</p>
              {bySubject.map(({ s, min }) => (
                <div key={s.id} className="flex items-center gap-2 text-xs">
                  <span className="w-28 shrink-0 truncate">{s.name}</span>
                  <div className="h-2 flex-1 rounded-full bg-muted"><div className="h-2 rounded-full" style={{ width: `${(min / maxSubj) * 100}%`, backgroundColor: s.color }} /></div>
                  <span className="w-16 shrink-0 text-right tabular-nums text-muted-foreground">{minutesLabel(min)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

function ExamMode() {
  const { items } = useAgenda();
  const [planFor, setPlanFor] = useState<AgendaItem | null>(null);
  const exams = items.filter((i) => i.category === "exam" && !i.done && i.date >= startOfDay(new Date())).slice(0, 6);
  return (
    <Panel title="Modo exámenes">
      {exams.length === 0 ? (
        <Empty title="Sin exámenes a la vista">Crea una tarea de tipo «Examen» o sincroniza tu calendario. Los eventos con «examen» o «parcial» en el título se detectan solos.</Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {exams.map((e) => {
            const d = daysLeft(e.date);
            return (
              <div key={e.key} className="rounded-lg border p-3">
                <p className="truncate text-xs text-muted-foreground">{e.subject?.name ?? "Examen"}</p>
                <p className="truncate text-sm font-medium">{e.title}</p>
                <p className={cn("my-1 text-2xl font-semibold tabular-nums", d <= 3 ? "text-destructive" : d <= 7 ? "text-warning" : "")}>
                  {d === 0 ? "Hoy" : d === 1 ? "Mañana" : `${d} días`}
                </p>
                <p className="text-xs text-muted-foreground">{format(e.date, "EEEE d 'de' MMMM", { locale: es })}</p>
                <Button size="sm" variant="outline" className="mt-2 w-full" disabled={d < 1} onClick={() => setPlanFor(e)}>
                  <CalendarCheck className="h-4 w-4" /> Crear plan de estudio
                </Button>
              </div>
            );
          })}
        </div>
      )}
      <StudyPlanDialog exam={planFor} onClose={() => setPlanFor(null)} />
    </Panel>
  );
}

function StudyPlanDialog({ exam, onClose }: { exam: AgendaItem | null; onClose: () => void }) {
  const { saveMany } = useTaskMutations();
  const [topics, setTopics] = useState("");
  const [review, setReview] = useState(1);
  const plan = useMemo(
    () => (exam ? buildStudyPlan({ topics: topics.split("\n"), start: new Date(), exam: exam.date, reviewDays: review, label: exam.subject?.name ?? exam.title }) : []),
    [exam, topics, review],
  );
  const create = () => {
    if (!exam || !plan.length) return;
    saveMany.mutate(
      plan.map((p) => ({ title: p.title.slice(0, 200), due_date: p.date, subject_id: exam.subject?.id ?? null, priority: "high", status: "todo", recurrence: "none", kind: "task", estimate_minutes: 60 })),
      { onSuccess: () => { toast.success(`${plan.length} sesiones de estudio añadidas a tus tareas`); setTopics(""); onClose(); } },
    );
  };
  return (
    <Dialog open={!!exam} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Plan de estudio · {exam?.title}</DialogTitle>
          <DialogDescription>Escribe un tema por línea. Lo repartimos entre hoy y el examen, dejando días de repaso.</DialogDescription>
        </DialogHeader>
        <Textarea rows={6} placeholder={"Tema 1: Introducción\nTema 2: …"} value={topics} onChange={(e) => setTopics(e.target.value)} />
        <div className="flex items-center gap-2">
          <Label htmlFor="review" className="text-sm">Días de repaso al final</Label>
          <Input id="review" type="number" min={0} max={7} className="h-8 w-20" value={review} onChange={(e) => setReview(Math.max(0, Math.min(7, Number(e.target.value) || 0)))} />
        </div>
        {plan.length > 0 && (
          <ul className="max-h-48 space-y-0.5 overflow-auto rounded-md border p-2 text-sm">
            {plan.map((p, i) => (
              <li key={i} className="flex justify-between gap-2"><span className="truncate">{p.title}</span><span className="shrink-0 text-xs capitalize text-muted-foreground">{format(parseISO(p.date), "EEE d MMM", { locale: es })}</span></li>
            ))}
          </ul>
        )}
        <DialogFooter><Button disabled={!plan.length || saveMany.isPending} onClick={create}>Añadir {plan.length || ""} tareas</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WeeklyReview() {
  const { data: tasks = [] } = useTasks();
  const { data: sessions = [] } = useStudySessions();
  const { items } = useAgenda();
  const now = new Date();
  const thisWeek = startOfWeek(now, { weekStartsOn: 1 });
  // on Sunday/Monday review the week that just ended; otherwise the current one
  const reviewStart = now.getDay() === 1 ? subWeeks(thisWeek, 1) : thisWeek;
  const reviewEnd = addDays(reviewStart, 7);
  const prevStart = subWeeks(reviewStart, 1);
  const inRange = (iso: string, a: Date, b: Date) => { const d = new Date(iso); return d >= a && d < b; };
  const completed = tasks.filter((t) => t.status === "done" && !t.parent_id && inRange(t.updated_at, reviewStart, reviewEnd));
  const minutes = sessions.filter((s) => inRange(s.started_at, reviewStart, reviewEnd)).reduce((n, s) => n + s.minutes, 0);
  const prevMinutes = sessions.filter((s) => inRange(s.started_at, prevStart, reviewStart)).reduce((n, s) => n + s.minutes, 0);
  const nextStart = now.getDay() === 1 ? thisWeek : addDays(thisWeek, 7);
  const next = items.filter((i) => isActionable(i) && !i.done && i.date >= nextStart && i.date < addDays(nextStart, 7));
  const overdue = items.filter((i) => i.kind === "task" && !i.done && i.date < startOfDay(now));
  const diff = minutes - prevMinutes;

  return (
    <section id="revision" className="scroll-mt-20">
      <Panel title={`Revisión semanal · ${format(reviewStart, "d MMM", { locale: es })} – ${format(addDays(reviewEnd, -1), "d MMM", { locale: es })}`}>
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="rounded-md bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Tareas completadas</p><p className="text-2xl font-semibold tabular-nums">{completed.length}</p></div>
          <div className="rounded-md bg-muted/40 p-3">
            <p className="text-xs text-muted-foreground">Horas de estudio</p>
            <p className="text-2xl font-semibold tabular-nums">{minutesLabel(minutes)}</p>
            <p className={cn("text-xs", diff >= 0 ? "text-success" : "text-destructive")}>{diff >= 0 ? "+" : "−"}{minutesLabel(Math.abs(diff))} vs semana anterior</p>
          </div>
          <div className="rounded-md bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Pendientes vencidas</p><p className={cn("text-2xl font-semibold tabular-nums", overdue.length && "text-destructive")}>{overdue.length}</p></div>
          <div className="rounded-md bg-muted/40 p-3"><p className="text-xs text-muted-foreground">La semana que viene</p><p className="text-2xl font-semibold tabular-nums">{next.length}</p></div>
        </div>
        {next.length > 0 && (
          <div className="mt-4">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Lo que viene</p>
            {next.slice(0, 6).map((i) => <AgendaRow key={i.key} item={i} />)}
          </div>
        )}
      </Panel>
    </section>
  );
}

function AiWeekPlan() {
  const ai = useAiAvailable();
  const fn = useServerFn(planWeek);
  const [hours, setHours] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [plan, setPlan] = useState<Awaited<ReturnType<typeof planWeek>> | null>(null);
  if (!ai) return null;
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      setPlan(await fn({ data: { today: format(new Date(), "yyyy-MM-dd"), tz: Intl.DateTimeFormat().resolvedOptions().timeZone, hoursPerDay: hours } }));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel title="Planifica tu semana con IA" action={<Sparkles className="h-4 w-4 text-primary" />}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="hours" className="text-xs">Horas de estudio al día</Label>
          <Input id="hours" type="number" min={0.5} max={12} step={0.5} className="h-9 w-24" value={hours} onChange={(e) => setHours(Number(e.target.value) || 3)} />
        </div>
        <Button onClick={run} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {plan ? "Rehacer plan" : "Generar plan"}</Button>
        <p className="text-xs text-muted-foreground">Usa tus tareas, entregas, exámenes y horario de clases.</p>
      </div>
      {error ? <div className="mt-3"><ErrorBox error={error} /></div> : null}
      {plan && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {plan.days.map((d) => (
              <div key={d.date} className="rounded-md border p-3">
                <p className="text-sm font-medium capitalize">{/^\d{4}-\d{2}-\d{2}$/.test(d.date) ? format(parseISO(d.date), "EEEE d", { locale: es }) : d.date}</p>
                <p className="mb-2 text-xs text-muted-foreground">{d.focus}</p>
                <ul className="space-y-1 text-sm">
                  {d.blocks.map((b, i) => <li key={i} className="flex gap-2"><span className="w-24 shrink-0 tabular-nums text-muted-foreground">{b.start}–{b.end}</span><span>{b.activity}</span></li>)}
                </ul>
              </div>
            ))}
          </div>
          {plan.tips.length > 0 && <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">{plan.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>}
        </div>
      )}
    </Panel>
  );
}
