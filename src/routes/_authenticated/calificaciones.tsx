import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, GraduationCap, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Empty, Loading, PageHeader, Panel } from "@/components/dash/common";
import { qk, useCrud, useGradeItems, useSubjects, type GradeItem, type Subject } from "@/lib/data";
import { gradeSummary, neededFor, overallAverage, type GradeSummary, type Needed } from "@/lib/grades";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/calificaciones")({
  head: () => ({ meta: [{ title: "Calificaciones · Brújula" }, { name: "description", content: "Notas, media ponderada y qué necesitas para aprobar." }] }),
  component: GradesPage,
});

const fmt = (n: number | null | undefined) => (n === null || n === undefined ? "–" : n.toLocaleString("es-ES", { maximumFractionDigits: 2 }));

function GradesPage() {
  const { data: subjects = [], isLoading } = useSubjects();
  const { data: items = [] } = useGradeItems();
  const rows = subjects.map((s) => {
    const list = items.filter((i) => i.subject_id === s.id);
    return { subject: s, list, summary: gradeSummary(list) };
  });
  const overall = overallAverage(rows.map((r) => ({ avg: r.summary.final ?? r.summary.currentAvg, credits: r.subject.credits })));
  const atRisk = rows.filter((r) => {
    const n = neededFor(r.summary, Number(r.subject.pass_grade));
    return n.status === "impossible" || (n.status === "needed" && n.needed >= 8) || (n.status === "done" && !n.reached);
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Calificaciones" description="Añade los criterios de evaluación y tus notas; calculamos la media y lo que te falta." />
      {isLoading ? <Loading /> : subjects.length === 0 ? (
        <Panel><Empty icon={GraduationCap} title="Sin asignaturas">Crea tus asignaturas en <Link to="/universidad" className="underline">Asignaturas</Link>.</Empty></Panel>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">Media global {subjects.some((s) => s.credits) ? "(ponderada por créditos)" : ""}</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">{fmt(overall)}</p>
            </div>
            <div className="rounded-lg border bg-card p-4">
              <p className="text-xs text-muted-foreground">Asignaturas con notas</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">{rows.filter((r) => r.summary.gradedWeight > 0).length}/{subjects.length}</p>
            </div>
            <div className={cn("rounded-lg border p-4", atRisk.length ? "border-destructive/40 bg-destructive/5" : "bg-card")}>
              <p className="text-xs text-muted-foreground">En riesgo</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums">{atRisk.length}</p>
              {atRisk.length > 0 && <p className="truncate text-xs text-destructive">{atRisk.map((r) => r.subject.name).join(", ")}</p>}
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {rows.map((r) => <SubjectGrades key={r.subject.id} subject={r.subject} items={r.list} summary={r.summary} />)}
          </div>
        </>
      )}
    </div>
  );
}

function NeededLine({ label, need }: { label: string; need: Needed }) {
  const text =
    need.status === "secured" ? "Asegurado" :
    need.status === "impossible" ? `Imposible (harían falta ${fmt(need.needed)})` :
    need.status === "done" ? (need.reached ? "Conseguido" : "No alcanzado") :
    `Necesitas ${fmt(need.needed)} de media en lo que queda`;
  const tone =
    need.status === "secured" || (need.status === "done" && need.reached) ? "text-success" :
    need.status === "impossible" || (need.status === "done" && !need.reached) ? "text-destructive" :
    need.status === "needed" && need.needed >= 8 ? "text-warning" : "text-foreground";
  return (
    <p className="flex justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-right font-medium", tone)}>{text}</span>
    </p>
  );
}

function SubjectGrades({ subject, items, summary }: { subject: Subject; items: GradeItem[]; summary: GradeSummary }) {
  const { save } = useCrud("grade_items", qk.grades);
  const [name, setName] = useState("");
  const [weight, setWeight] = useState("");
  const pass = Number(subject.pass_grade);
  const target = subject.target_grade !== null ? Number(subject.target_grade) : null;

  return (
    <Panel
      title={subject.name}
      action={<span className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: subject.color }} />{subject.credits ? `${subject.credits} ECTS` : ""}</span>}
    >
      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        <div><p className="text-xs text-muted-foreground">Media actual</p><p className="text-xl font-semibold tabular-nums">{fmt(summary.currentAvg)}</p></div>
        <div><p className="text-xs text-muted-foreground">Puntos asegurados</p><p className="text-xl font-semibold tabular-nums">{fmt(summary.earned)}</p></div>
        <div><p className="text-xs text-muted-foreground">Evaluado</p><p className="text-xl font-semibold tabular-nums">{fmt(summary.gradedWeight)}%</p></div>
      </div>
      <Progress value={Math.min(100, summary.gradedWeight)} className="mb-3 h-1.5" />
      {items.length > 0 && Math.abs(summary.totalWeight - 100) > 0.01 && (
        <p className="mb-2 flex items-center gap-1.5 text-xs text-warning"><AlertTriangle className="h-3.5 w-3.5" /> Los pesos suman {fmt(summary.totalWeight)}% (deberían sumar 100%).</p>
      )}
      {items.length > 0 && (
        <div className="mb-3 space-y-1">
          <div className="grid grid-cols-[1fr_4.5rem_4.5rem_4.5rem_1.75rem] gap-1.5 px-1 text-[11px] text-muted-foreground">
            <span>Criterio</span><span>Peso %</span><span>Nota</span><span>Sobre</span><span />
          </div>
          {items.map((i) => <GradeRow key={i.id} item={i} />)}
        </div>
      )}
      <form
        className="flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          const w = Number(weight.replace(",", "."));
          if (!name.trim() || !(w >= 0 && w <= 100)) return;
          save.mutate({ subject_id: subject.id, name: name.trim(), weight: w }, { onSuccess: () => { setName(""); setWeight(""); } });
        }}
      >
        <Input className="h-8" placeholder="Nuevo criterio (p. ej. Examen final)" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
        <Input className="h-8 w-20" placeholder="%" inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} />
        <Button size="sm" variant="outline" className="h-8" type="submit" aria-label="Añadir criterio"><Plus className="h-4 w-4" /></Button>
      </form>
      {items.length > 0 && (
        <div className="mt-3 space-y-1 border-t pt-3">
          <NeededLine label={`Para aprobar (${fmt(pass)})`} need={neededFor(summary, pass)} />
          {target !== null && <NeededLine label={`Para tu objetivo (${fmt(target)})`} need={neededFor(summary, target)} />}
          {summary.final !== null && <p className="flex justify-between text-sm"><span className="text-muted-foreground">Nota final</span><span className="font-semibold">{fmt(summary.final)}</span></p>}
        </div>
      )}
    </Panel>
  );
}

function GradeRow({ item }: { item: GradeItem }) {
  const { save, remove } = useCrud("grade_items", qk.grades);
  const [d, setD] = useState({ name: item.name, weight: String(item.weight), grade: item.grade?.toString() ?? "", max: String(item.max_grade) });
  useEffect(() => setD({ name: item.name, weight: String(item.weight), grade: item.grade?.toString() ?? "", max: String(item.max_grade) }), [item]);
  const commit = () => {
    const weight = Number(d.weight.replace(",", "."));
    const grade = d.grade.trim() === "" ? null : Number(d.grade.replace(",", "."));
    const max = Number(d.max.replace(",", ".")) || 10;
    if (!d.name.trim() || !(weight >= 0 && weight <= 100) || (grade !== null && !(grade >= 0 && grade <= max))) return;
    if (d.name === item.name && weight === Number(item.weight) && grade === (item.grade === null ? null : Number(item.grade)) && max === Number(item.max_grade)) return;
    save.mutate({ id: item.id, subject_id: item.subject_id, name: d.name.trim(), weight, grade, max_grade: max });
  };
  const field = (k: keyof typeof d) => ({
    value: d[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setD((p) => ({ ...p, [k]: e.target.value })),
    onBlur: commit,
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => e.key === "Enter" && (e.target as HTMLInputElement).blur(),
  });
  return (
    <div className="grid grid-cols-[1fr_4.5rem_4.5rem_4.5rem_1.75rem] items-center gap-1.5">
      <Input className="h-8" maxLength={120} {...field("name")} />
      <Input className="h-8" inputMode="decimal" {...field("weight")} />
      <Input className="h-8" inputMode="decimal" placeholder="—" {...field("grade")} />
      <Input className="h-8" inputMode="decimal" {...field("max")} />
      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => remove.mutate(item.id)} aria-label="Eliminar criterio"><Trash2 className="h-3.5 w-3.5" /></Button>
    </div>
  );
}
