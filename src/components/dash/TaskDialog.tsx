import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useGroups, useSubjects, useTaskMutations, useTasks, type Task, type TaskInput } from "@/lib/data";
import { cn } from "@/lib/utils";

export type TaskDraft = Partial<Task>;

const EMPTY: TaskInput = { title: "", description: "", subject_id: null, priority: "medium", due_date: null, due_time: null, status: "todo", recurrence: "none", kind: "task", estimate_minutes: null, group_id: null, parent_id: null };

export function TaskDialog({ open, onOpenChange, initial }: { open: boolean; onOpenChange: (o: boolean) => void; initial?: TaskDraft | null | undefined }) {
  const { data: subjects = [] } = useSubjects();
  const { data: groups = [] } = useGroups();
  const { save, remove } = useTaskMutations();
  const [t, setT] = useState<TaskInput & { id?: string }>(EMPTY);

  useEffect(() => {
    if (open) setT({ ...EMPTY, ...(initial ?? {}) } as TaskInput & { id?: string });
  }, [open, initial]);

  const set = <K extends keyof TaskInput>(k: K, v: TaskInput[K]) => setT((p) => ({ ...p, [k]: v }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!t.title.trim()) return;
    const { id, title, description, subject_id, priority, due_date, due_time, status, recurrence, source_uid, kind, estimate_minutes, group_id, parent_id } = t;
    save.mutate(
      {
        ...(id ? { id } : {}), title: title.trim(), description: description || null, subject_id: subject_id ?? null,
        priority: priority ?? "medium", due_date: due_date || null, due_time: due_time || null, status: status ?? "todo",
        recurrence: recurrence ?? "none", source_uid: source_uid ?? null, kind: kind ?? "task",
        estimate_minutes: estimate_minutes || null, group_id: group_id ?? null, parent_id: parent_id ?? null,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>{t.id ? "Editar tarea" : t.parent_id ? "Nueva subtarea" : "Nueva tarea"}</DialogTitle></DialogHeader>
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
              <Label>Tipo</Label>
              <Select value={t.kind ?? "task"} onValueChange={(v) => set("kind", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="task">Tarea</SelectItem>
                  <SelectItem value="deliverable">Entrega</SelectItem>
                  <SelectItem value="exam">Examen</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
              <Label htmlFor="t-date">Fecha</Label>
              <Input id="t-date" type="date" value={t.due_date ?? ""} onChange={(e) => set("due_date", e.target.value || null)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-time">Hora</Label>
              <Input id="t-time" type="time" value={t.due_time?.slice(0, 5) ?? ""} onChange={(e) => set("due_time", e.target.value || null)} />
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
              <Label htmlFor="t-est">Tiempo estimado (min)</Label>
              <Input id="t-est" type="number" min={5} max={6000} step={5} value={t.estimate_minutes ?? ""} onChange={(e) => set("estimate_minutes", e.target.value ? Number(e.target.value) : null)} />
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
            {groups.length > 0 && !t.parent_id && (
              <div className="col-span-2 space-y-1.5">
                <Label>Compartir con grupo</Label>
                <Select value={t.group_id ?? "none"} onValueChange={(v) => set("group_id", v === "none" ? null : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Solo yo</SelectItem>
                    {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          {t.id && !t.parent_id && <Subtasks parent={t as Task} />}
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

function Subtasks({ parent }: { parent: Task }) {
  const { data: tasks = [] } = useTasks();
  const { save, toggle, remove } = useTaskMutations();
  const [title, setTitle] = useState("");
  const subs = tasks.filter((x) => x.parent_id === parent.id);
  const add = () => {
    if (!title.trim()) return;
    save.mutate(
      { title: title.trim(), parent_id: parent.id, subject_id: parent.subject_id, group_id: parent.group_id, priority: parent.priority, status: "todo", recurrence: "none", kind: "task" },
      { onSuccess: () => setTitle("") },
    );
  };
  return (
    <div className="space-y-1.5 rounded-md border p-3">
      <Label>Subtareas {subs.length > 0 && <span className="text-muted-foreground">({subs.filter((s) => s.status === "done").length}/{subs.length})</span>}</Label>
      <ul className="space-y-1">
        {subs.map((s) => (
          <li key={s.id} className="group flex items-center gap-2">
            <Checkbox checked={s.status === "done"} onCheckedChange={() => toggle.mutate(s)} aria-label="Completar subtarea" />
            <span className={cn("flex-1 truncate text-sm", s.status === "done" && "text-muted-foreground line-through")}>{s.title}</span>
            <button type="button" onClick={() => remove.mutate(s.id)} className="text-muted-foreground opacity-0 group-hover:opacity-100" aria-label="Eliminar subtarea"><Trash2 className="h-3.5 w-3.5" /></button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Input className="h-8" placeholder="Divide la tarea en pasos…" maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }} />
        <Button type="button" size="sm" variant="outline" className="h-8" onClick={add}><Plus className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}
