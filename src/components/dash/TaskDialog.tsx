import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useSubjects, useTaskMutations, type Task, type TaskInput } from "@/lib/data";

export type TaskDraft = Partial<Task>;

const EMPTY: TaskInput = { title: "", description: "", subject_id: null, priority: "medium", due_date: null, due_time: null, status: "todo", recurrence: "none" };

export function TaskDialog({ open, onOpenChange, initial }: { open: boolean; onOpenChange: (o: boolean) => void; initial?: TaskDraft | null | undefined }) {
  const { data: subjects = [] } = useSubjects();
  const { save, remove } = useTaskMutations();
  const [t, setT] = useState<TaskInput & { id?: string }>(EMPTY);

  useEffect(() => {
    if (open) setT({ ...EMPTY, ...(initial ?? {}) } as TaskInput & { id?: string });
  }, [open, initial]);

  const set = <K extends keyof TaskInput>(k: K, v: TaskInput[K]) => setT((p) => ({ ...p, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!t.title.trim()) return;
    const { id, title, description, subject_id, priority, due_date, due_time, status, recurrence, source_uid } = t;
    save.mutate(
      { ...(id ? { id } : {}), title: title.trim(), description: description || null, subject_id: subject_id ?? null, priority: priority ?? "medium", due_date: due_date || null, due_time: due_time || null, status: status ?? "todo", recurrence: recurrence ?? "none", source_uid: source_uid ?? null },
      { onSuccess: () => onOpenChange(false) },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{t.id ? "Editar tarea" : "Nueva tarea"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="t-title">Título</Label>
            <Input id="t-title" autoFocus required maxLength={200} value={t.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="t-desc">Descripción</Label>
            <Textarea id="t-desc" rows={3} maxLength={5000} value={t.description ?? ""} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Asignatura / categoría</Label>
              <Select value={t.subject_id ?? "none"} onValueChange={(v) => set("subject_id", v === "none" ? null : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Personal</SelectItem>
                  {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridad</Label>
              <Select value={t.priority ?? "medium"} onValueChange={(v) => set("priority", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baja</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-date">Fecha</Label>
              <Input id="t-date" type="date" value={t.due_date ?? ""} onChange={(e) => set("due_date", e.target.value || null)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-time">Hora</Label>
              <Input id="t-time" type="time" value={t.due_time?.slice(0, 5) ?? ""} onChange={(e) => set("due_time", e.target.value || null)} />
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={t.status ?? "todo"} onValueChange={(v) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">Pendiente</SelectItem>
                  <SelectItem value="in_progress">En curso</SelectItem>
                  <SelectItem value="done">Hecha</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Repetir</Label>
              <Select value={t.recurrence ?? "none"} onValueChange={(v) => set("recurrence", v)} disabled={!t.due_date}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No se repite</SelectItem>
                  <SelectItem value="daily">Cada día</SelectItem>
                  <SelectItem value="weekly">Cada semana</SelectItem>
                  <SelectItem value="monthly">Cada mes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {t.id ? (
              <Button type="button" variant="ghost" className="text-destructive" onClick={() => remove.mutate(t.id!, { onSuccess: () => onOpenChange(false) })}>Eliminar</Button>
            ) : <span />}
            <Button type="submit" disabled={save.isPending}>{t.id ? "Guardar" : "Crear tarea"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
