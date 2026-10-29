import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { FileUp, Loader2, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { aiStatus, extractSyllabus } from "@/lib/ai.functions";
import { qk, useCrud, useTaskMutations, type Subject } from "@/lib/data";
import { ErrorBox } from "./common";

type Result = Awaited<ReturnType<typeof extractSyllabus>>;

const fileToBase64 = (f: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(f);
  });

export function useAiAvailable() {
  const fn = useServerFn(aiStatus);
  return useQuery({ queryKey: ["ai", "status"], queryFn: () => fn(), staleTime: Infinity }).data?.available ?? false;
}

/** Upload a course guide → AI extracts evaluation weights and dates → review → apply. */
export function SyllabusImport({ subject, open, onOpenChange }: { subject: Subject; open: boolean; onOpenChange: (o: boolean) => void }) {
  const extract = useServerFn(extractSyllabus);
  const grades = useCrud("grade_items", qk.grades);
  const subjects = useCrud("subjects", qk.subjects);
  const { saveMany } = useTaskMutations();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [res, setRes] = useState<Result | null>(null);
  const [pickEval, setPickEval] = useState(true);
  const [pickDates, setPickDates] = useState<Set<number>>(new Set());

  const run = async (input: { pdfBase64?: string; text?: string }) => {
    setBusy(true);
    setError(null);
    try {
      const r = await extract({ data: { ...input, today: format(new Date(), "yyyy-MM-dd"), tz: Intl.DateTimeFormat().resolvedOptions().timeZone } });
      setRes(r);
      setPickDates(new Set(r.deadlines.map((_, i) => i)));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!res) return;
    try {
      if (pickEval) {
        for (const ev of res.evaluation) {
          await grades.save.mutateAsync({ subject_id: subject.id, name: ev.name.slice(0, 120), weight: Math.max(0, Math.min(100, ev.weight)) });
        }
      }
      const dated = res.deadlines.filter((d, i) => pickDates.has(i) && /^\d{4}-\d{2}-\d{2}$/.test(d.date));
      if (dated.length) {
        await saveMany.mutateAsync(
          dated.map((d) => ({
            title: d.title.slice(0, 200), subject_id: subject.id, due_date: d.date,
            due_time: d.time && /^\d{2}:\d{2}$/.test(d.time) ? d.time : null,
            kind: d.kind, priority: d.kind === "exam" ? "high" : "medium", status: "todo", recurrence: "none",
          })),
        );
      }
      if (res.teacher && !subject.teacher) await subjects.save.mutateAsync({ id: subject.id, name: subject.name, teacher: res.teacher.slice(0, 120) });
      toast.success("Guía docente importada");
      onOpenChange(false);
      setRes(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setRes(null); setError(null); } }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Importar guía docente · {subject.name}</DialogTitle>
          <DialogDescription>La IA lee la guía y propone criterios de evaluación y fechas. Revisa antes de aplicar.</DialogDescription>
        </DialogHeader>
        {!res ? (
          <div className="space-y-3">
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                if (f.size > 10 * 1024 * 1024) {
                  toast.error("El PDF supera 10 MB");
                  return;
                }
                run({ pdfBase64: await fileToBase64(f) });
              }}
            />
            <Button variant="outline" className="w-full" disabled={busy} onClick={() => fileRef.current?.click()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileUp className="h-4 w-4" />} Subir PDF de la guía
            </Button>
            <p className="text-center text-xs text-muted-foreground">o pega el texto</p>
            <Textarea rows={6} maxLength={200000} placeholder="Evaluación: examen final 50%, prácticas 30%…" value={text} onChange={(e) => setText(e.target.value)} />
            <Button className="w-full" disabled={busy || text.trim().length < 20} onClick={() => run({ text })}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Analizar texto
            </Button>
            {error ? <ErrorBox error={error} /> : null}
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            {res.teacher && <p><span className="text-muted-foreground">Profesorado:</span> {res.teacher}</p>}
            <div>
              <label className="mb-1 flex items-center gap-2 font-medium"><Checkbox checked={pickEval} onCheckedChange={(v) => setPickEval(!!v)} /> Criterios de evaluación</label>
              {res.evaluation.length ? (
                <ul className="ml-6 list-disc text-muted-foreground">{res.evaluation.map((e, i) => <li key={i}>{e.name} — {e.weight}%</li>)}</ul>
              ) : <p className="ml-6 text-muted-foreground">No se encontraron.</p>}
            </div>
            <div>
              <p className="mb-1 font-medium">Fechas</p>
              {res.deadlines.length ? res.deadlines.map((d, i) => (
                <label key={i} className="flex items-center gap-2 py-0.5">
                  <Checkbox checked={pickDates.has(i)} onCheckedChange={(v) => setPickDates((s) => { const n = new Set(s); if (v) n.add(i); else n.delete(i); return n; })} />
                  <span>{d.title}</span><span className="ml-auto text-xs text-muted-foreground">{d.date}{d.time ? ` ${d.time}` : ""}</span>
                </label>
              )) : <p className="text-muted-foreground">No se encontraron fechas.</p>}
            </div>
            {res.minimum_rules.length > 0 && (
              <div className="rounded-md bg-warning/10 p-2 text-xs">
                <p className="font-medium">Requisitos</p>
                <ul className="ml-4 list-disc">{res.minimum_rules.map((r, i) => <li key={i}>{r}</li>)}</ul>
              </div>
            )}
            <DialogFooter className="gap-2">
              <Button variant="ghost" onClick={() => setRes(null)}>Volver</Button>
              <Button onClick={apply} disabled={grades.save.isPending || saveMany.isPending}>Aplicar</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
