import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { format, getISODay, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { AlertTriangle, CalendarClock, Check, Clock, Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Empty, Loading, PageHeader, Panel } from "@/components/dash/common";
import { supabase } from "@/integrations/supabase/client";
import { qk, useAttendance, useClassSessions, useCrud, useProfile, useSubjects, type ClassSession, type Subject } from "@/lib/data";
import { absenceLimit, WEEKDAYS } from "@/lib/timetable";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/horario")({
  head: () => ({ meta: [{ title: "Horario · Brújula" }, { name: "description", content: "Horario semanal de clases y control de asistencia." }] }),
  component: TimetablePage,
});

const HOUR_PX = 48;
const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

function TimetablePage() {
  const { data: subjects = [], isLoading } = useSubjects();
  const { data: sessions = [] } = useClassSessions();
  const [edit, setEdit] = useState<Partial<ClassSession> | null>(null);
  const subj = (id: string) => subjects.find((s) => s.id === id);

  const days = sessions.some((s) => s.weekday >= 6) ? [1, 2, 3, 4, 5, 6, 7] : [1, 2, 3, 4, 5];
  const startHour = sessions.length ? Math.min(8, Math.floor(Math.min(...sessions.map((s) => minutes(s.start_time))) / 60)) : 8;
  const endHour = sessions.length ? Math.max(15, Math.ceil(Math.max(...sessions.map((s) => minutes(s.end_time))) / 60)) : 15;
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const today = getISODay(new Date());

  return (
    <div className="space-y-6">
      <PageHeader
        title="Horario"
        description="Tus clases semanales y la asistencia por asignatura."
        actions={<Button size="sm" disabled={!subjects.length} onClick={() => setEdit({ weekday: today <= 5 ? today : 1, start_time: "09:00", end_time: "11:00" })}><Plus className="h-4 w-4" /> Añadir clase</Button>}
      />
      {isLoading ? <Loading /> : !subjects.length ? (
        <Panel><Empty icon={CalendarClock} title="Primero crea tus asignaturas">Hazlo en <Link to="/universidad" className="underline">Asignaturas</Link>.</Empty></Panel>
      ) : (
        <>
          <Panel className="[&>div]:p-0">
            {sessions.length === 0 ? (
              <Empty icon={Clock} title="Horario vacío">Añade tus clases para ver «Ahora / Siguiente» en el inicio y controlar faltas.</Empty>
            ) : (
              <>
                {/* desktop grid */}
                <div className="hidden overflow-x-auto md:block">
                  <div className="grid min-w-[640px]" style={{ gridTemplateColumns: `3rem repeat(${days.length}, 1fr)` }}>
                    <div />
                    {days.map((d) => (
                      <div key={d} className={cn("border-b border-l px-2 py-1.5 text-xs font-medium", d === today && "text-primary")}>{WEEKDAYS[d - 1]}</div>
                    ))}
                    <div className="relative" style={{ height: hours.length * HOUR_PX }}>
                      {hours.map((h, i) => <span key={h} className="absolute right-1 text-[10px] text-muted-foreground" style={{ top: i * HOUR_PX - 6 }}>{h}:00</span>)}
                    </div>
                    {days.map((d) => (
                      <div key={d} className={cn("relative border-l", d === today && "bg-primary/5")} style={{ height: hours.length * HOUR_PX }}>
                        {hours.map((h, i) => <div key={h} className="absolute inset-x-0 border-t border-dashed border-border/60" style={{ top: i * HOUR_PX }} />)}
                        {sessions.filter((s) => s.weekday === d).map((s) => {
                          const sub = subj(s.subject_id);
                          const top = ((minutes(s.start_time) - startHour * 60) / 60) * HOUR_PX;
                          const height = ((minutes(s.end_time) - minutes(s.start_time)) / 60) * HOUR_PX;
                          return (
                            <button
                              key={s.id}
                              onClick={() => setEdit(s)}
                              className="absolute inset-x-1 overflow-hidden rounded-md border-l-4 bg-card p-1.5 text-left text-xs shadow-sm hover:brightness-95"
                              style={{ top, height, borderLeftColor: sub?.color, backgroundColor: sub ? `${sub.color}1a` : undefined }}
                            >
                              <p className="truncate font-medium">{sub?.name}</p>
                              <p className="truncate text-muted-foreground">{s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}{s.room ? ` · ${s.room}` : ""}</p>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
                {/* mobile list */}
                <div className="divide-y md:hidden">
                  {days.filter((d) => sessions.some((s) => s.weekday === d)).map((d) => (
                    <div key={d} className="p-3">
                      <p className={cn("mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground", d === today && "text-primary")}>{WEEKDAYS[d - 1]}</p>
                      {sessions.filter((s) => s.weekday === d).map((s) => (
                        <button key={s.id} onClick={() => setEdit(s)} className="flex w-full items-center gap-2 py-1.5 text-left text-sm">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: subj(s.subject_id)?.color }} />
                          <span className="w-24 shrink-0 tabular-nums text-muted-foreground">{s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}</span>
                          <span className="truncate">{subj(s.subject_id)?.name}</span>
                          {s.room && <span className="ml-auto text-xs text-muted-foreground">{s.room}</span>}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}
          </Panel>
          <AttendancePanel subjects={subjects} sessions={sessions} />
        </>
      )}
      <SessionDialog draft={edit} subjects={subjects} onClose={() => setEdit(null)} />
    </div>
  );
}

function AttendancePanel({ subjects, sessions }: { subjects: Subject[]; sessions: ClassSession[] }) {
  const qc = useQueryClient();
  const { data: records = [] } = useAttendance();
  const { data: profile } = useProfile();
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const wd = getISODay(parseISO(date));
  const daySubjects = [...new Set(sessions.filter((s) => s.weekday === wd).map((s) => s.subject_id))];
  const mark = useMutation({
    mutationFn: async ({ subjectId, status }: { subjectId: string; status: string | null }) => {
      const res = status
        ? await supabase.from("attendance").upsert({ subject_id: subjectId, date, status }, { onConflict: "user_id,subject_id,date" })
        : await supabase.from("attendance").delete().eq("subject_id", subjectId).eq("date", date);
      if (res.error) throw new Error(res.error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.attendance }),
    onError: (e: Error) => toast.error(e.message),
  });
  const pct = profile?.absence_limit_pct ?? 20;
  const withSessions = subjects.filter((s) => sessions.some((x) => x.subject_id === s.id) || s.absence_limit !== null);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Pasar lista" action={<Input type="date" className="h-7 w-36 text-xs" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />}>
        {daySubjects.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No tienes clases el {format(parseISO(date), "EEEE d", { locale: es })}.</p>
        ) : daySubjects.map((id) => {
          const s = subjects.find((x) => x.id === id);
          const rec = records.find((r) => r.subject_id === id && r.date === date);
          const btn = (status: string, label: string, Icon: typeof Check, cls: string) => (
            <Button
              size="sm"
              variant={rec?.status === status ? "default" : "outline"}
              className={cn("h-7 gap-1 px-2 text-xs", rec?.status === status && cls)}
              onClick={() => mark.mutate({ subjectId: id, status: rec?.status === status ? null : status })}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </Button>
          );
          return (
            <div key={id} className="flex flex-wrap items-center gap-2 py-1.5">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s?.color }} />
              <span className="min-w-0 flex-1 truncate text-sm">{s?.name}</span>
              {btn("present", "Asistí", Check, "bg-success hover:bg-success/90")}
              {btn("late", "Tarde", Clock, "bg-warning hover:bg-warning/90")}
              {btn("absent", "Falté", X, "bg-destructive hover:bg-destructive/90")}
            </div>
          );
        })}
      </Panel>
      <Panel title="Faltas por asignatura">
        {withSessions.length === 0 ? <p className="text-sm text-muted-foreground">Añade clases al horario para calcular el límite de faltas.</p> : (
          <div className="space-y-3">
            {withSessions.map((s) => {
              const absences = records.filter((r) => r.subject_id === s.id && r.status === "absent").length;
              const lates = records.filter((r) => r.subject_id === s.id && r.status === "late").length;
              const limit = absenceLimit(sessions, s.id, s.absence_limit, pct);
              const ratio = limit ? absences / limit : absences ? 1 : 0;
              return (
                <div key={s.id}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-1.5 truncate"><span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />{s.name}</span>
                    <span className={cn("shrink-0 tabular-nums", ratio >= 1 ? "text-destructive" : ratio >= 0.75 ? "text-warning" : "text-muted-foreground")}>
                      {ratio >= 0.75 && <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />}
                      {absences}/{limit} faltas{lates ? ` · ${lates} retrasos` : ""}
                    </span>
                  </div>
                  <Progress value={Math.min(100, ratio * 100)} className={cn("h-1.5", ratio >= 1 ? "[&>div]:bg-destructive" : ratio >= 0.75 ? "[&>div]:bg-warning" : "")} />
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground">Límite automático: {pct}% de las sesiones de un cuatrimestre de 15 semanas. Ajusta cada asignatura en su ficha o el % en Ajustes.</p>
          </div>
        )}
      </Panel>
    </div>
  );
}

function SessionDialog({ draft, subjects, onClose }: { draft: Partial<ClassSession> | null; subjects: Subject[]; onClose: () => void }) {
  const { save, remove } = useCrud("class_sessions", qk.sessions);
  const [d, setD] = useState<Partial<ClassSession>>({});
  const [last, setLast] = useState<typeof draft>(null);
  if (draft !== last) {
    setLast(draft);
    if (draft) setD({ ...(subjects[0] ? { subject_id: subjects[0].id } : {}), room: "", ...draft });
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!d.subject_id || !d.weekday || !d.start_time || !d.end_time) return;
    if (d.end_time <= d.start_time) {
      toast.error("La hora de fin debe ser posterior al inicio");
      return;
    }
    save.mutate(
      { ...(d.id ? { id: d.id } : {}), subject_id: d.subject_id, weekday: d.weekday, start_time: d.start_time, end_time: d.end_time, room: d.room?.trim() || null },
      { onSuccess: onClose },
    );
  };
  return (
    <Dialog open={!!draft} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{d.id ? "Editar clase" : "Nueva clase"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Asignatura</Label>
            <Select value={d.subject_id ?? ""} onValueChange={(v) => setD((p) => ({ ...p, subject_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Elige asignatura" /></SelectTrigger>
              <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3 space-y-1.5 sm:col-span-1">
              <Label>Día</Label>
              <Select value={String(d.weekday ?? 1)} onValueChange={(v) => setD((p) => ({ ...p, weekday: Number(v) }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{WEEKDAYS.map((w, i) => <SelectItem key={w} value={String(i + 1)}>{w}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label htmlFor="c-start">Inicio</Label><Input id="c-start" type="time" required value={d.start_time?.slice(0, 5) ?? ""} onChange={(e) => setD((p) => ({ ...p, start_time: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label htmlFor="c-end">Fin</Label><Input id="c-end" type="time" required value={d.end_time?.slice(0, 5) ?? ""} onChange={(e) => setD((p) => ({ ...p, end_time: e.target.value }))} /></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="c-room">Aula</Label><Input id="c-room" maxLength={40} value={d.room ?? ""} onChange={(e) => setD((p) => ({ ...p, room: e.target.value }))} /></div>
          <DialogFooter className="gap-2 sm:justify-between">
            {d.id ? <Button type="button" variant="ghost" className="text-destructive" onClick={() => remove.mutate(d.id!, { onSuccess: onClose })}>Eliminar</Button> : <span />}
            <Button type="submit" disabled={save.isPending}>Guardar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
