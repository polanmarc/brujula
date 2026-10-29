import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSubjectMutations, type Subject } from "@/lib/data";

type Draft = {
  id?: string;
  name: string;
  color: string;
  teacher: string;
  room: string;
  credits: string;
  absence_limit: string;
  pass_grade: string;
  target_grade: string;
  moodle_url: string;
};

const toDraft = (s?: Subject | null): Draft => ({
  ...(s?.id ? { id: s.id } : {}),
  name: s?.name ?? "",
  color: s?.color ?? "#3b82f6",
  teacher: s?.teacher ?? "",
  room: s?.room ?? "",
  credits: s?.credits?.toString() ?? "",
  absence_limit: s?.absence_limit?.toString() ?? "",
  pass_grade: s?.pass_grade?.toString() ?? "5",
  target_grade: s?.target_grade?.toString() ?? "",
  moodle_url: s?.moodle_url ?? "",
});

const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(",", ".")));

export function SubjectDialog({ subject, open, onOpenChange }: { subject?: Subject | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { save, remove } = useSubjectMutations();
  const [d, setD] = useState<Draft>(toDraft(subject));
  useEffect(() => {
    if (open) setD(toDraft(subject));
  }, [open, subject]);
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) => setD((p) => ({ ...p, [k]: e.target.value }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!d.name.trim()) return;
    let url = d.moodle_url.trim();
    if (url && !/^https?:\/\//.test(url)) url = "https://" + url;
    save.mutate(
      {
        ...(d.id ? { id: d.id } : {}),
        name: d.name.trim(),
        color: d.color,
        teacher: d.teacher.trim() || null,
        room: d.room.trim() || null,
        credits: num(d.credits),
        absence_limit: num(d.absence_limit),
        pass_grade: num(d.pass_grade) ?? 5,
        target_grade: num(d.target_grade),
        moodle_url: url || null,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{d.id ? "Editar asignatura" : "Nueva asignatura"}</DialogTitle>
          <DialogDescription>Los datos de evaluación se usan en Calificaciones y Horario.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="s-name">Nombre</Label>
              <Input id="s-name" required maxLength={120} value={d.name} onChange={set("name")} />
            </div>
            <input type="color" aria-label="Color" value={d.color} onChange={set("color")} className="h-9 w-12 cursor-pointer rounded border bg-transparent p-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label htmlFor="s-teacher">Profesor/a</Label><Input id="s-teacher" maxLength={120} value={d.teacher} onChange={set("teacher")} /></div>
            <div className="space-y-1.5"><Label htmlFor="s-room">Aula</Label><Input id="s-room" maxLength={40} value={d.room} onChange={set("room")} /></div>
            <div className="space-y-1.5"><Label htmlFor="s-credits">Créditos</Label><Input id="s-credits" inputMode="decimal" value={d.credits} onChange={set("credits")} /></div>
            <div className="space-y-1.5"><Label htmlFor="s-abs">Faltas permitidas</Label><Input id="s-abs" type="number" min={0} placeholder="Automático" value={d.absence_limit} onChange={set("absence_limit")} /></div>
            <div className="space-y-1.5"><Label htmlFor="s-pass">Nota para aprobar</Label><Input id="s-pass" inputMode="decimal" value={d.pass_grade} onChange={set("pass_grade")} /></div>
            <div className="space-y-1.5"><Label htmlFor="s-target">Nota objetivo</Label><Input id="s-target" inputMode="decimal" placeholder="p. ej. 7" value={d.target_grade} onChange={set("target_grade")} /></div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-url">Enlace al aula virtual</Label>
            <Input id="s-url" maxLength={500} placeholder="https://…" value={d.moodle_url} onChange={set("moodle_url")} />
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {d.id ? (
              <Button type="button" variant="ghost" className="text-destructive" onClick={() => confirm(`¿Eliminar ${d.name}? Se borrarán sus notas de evaluación y horario.`) && remove.mutate(d.id!, { onSuccess: () => onOpenChange(false) })}>Eliminar</Button>
            ) : <span />}
            <Button type="submit" disabled={save.isPending}>Guardar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
