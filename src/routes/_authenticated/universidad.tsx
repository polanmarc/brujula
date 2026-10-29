import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Eye, ExternalLink, Link2, Pencil, Plus, Sparkles, StickyNote, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AgendaRow, Empty, Loading, PageHeader, Panel } from "@/components/dash/common";
import { EventDialog } from "@/components/dash/EventDialog";
import { SubjectDialog } from "@/components/dash/SubjectDialog";
import { SyllabusImport, useAiAvailable } from "@/components/dash/SyllabusImport";
import { TaskDialog } from "@/components/dash/TaskDialog";
import { isActionable, useLinkMutations, useLinks, useNoteMutations, useNotes, useSubjects, type Note, type Subject } from "@/lib/data";
import { useAgenda, useAgendaSelection } from "@/lib/useAgenda";

export const Route = createFileRoute("/_authenticated/universidad")({
  head: () => ({ meta: [{ title: "Asignaturas · Brújula" }, { name: "description", content: "Asignaturas, entregas, apuntes y enlaces." }] }),
  component: UniPage,
});

function UniPage() {
  const { data: subjects = [], isLoading } = useSubjects();
  const { items } = useAgenda();
  const sel = useAgendaSelection();
  const now = Date.now() - 864e5;
  const upcoming = items.filter((i) => isActionable(i) && !i.done && i.date.getTime() >= now);
  const groups = [...subjects.map((s) => ({ key: s.id, subject: s as Subject | null, list: upcoming.filter((i) => i.subject?.id === s.id) })),
    { key: "none", subject: null, list: upcoming.filter((i) => !i.subject) }].filter((g) => g.list.length);

  return (
    <div className="space-y-6">
      <PageHeader title="Asignaturas" description="Asignaturas, entregas, apuntes y enlaces." />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel title="Próximas entregas por asignatura">
            {groups.length === 0 ? <Empty icon={BookOpen} title="Sin entregas próximas">Conecta tus calendarios en <Link to="/ajustes" className="underline">Ajustes</Link>.</Empty> : (
              <div className="space-y-4">
                {groups.map((g) => (
                  <div key={g.key}>
                    <p className="mb-1 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <span className="h-2 w-2 rounded-full bg-muted-foreground/40" style={g.subject ? { backgroundColor: g.subject.color } : undefined} />
                      {g.subject?.name ?? "Sin asignatura"}
                    </p>
                    {g.list.map((i) => <AgendaRow key={i.key} item={i} onClick={() => sel.select(i)} />)}
                  </div>
                ))}
              </div>
            )}
          </Panel>
          <Notes subjects={subjects} />
        </div>
        <div className="space-y-4">
          <Panel title="Asignaturas">{isLoading ? <Loading /> : <Subjects subjects={subjects} />}</Panel>
          <Links />
        </div>
      </div>
      <TaskDialog open={!!sel.task} onOpenChange={(o) => !o && sel.setTask(null)} initial={sel.task} />
      <EventDialog item={sel.event} onClose={() => sel.setEvent(null)} />
    </div>
  );
}

function Subjects({ subjects }: { subjects: Subject[] }) {
  const [edit, setEdit] = useState<Subject | null>(null);
  const [creating, setCreating] = useState(false);
  const [importFor, setImportFor] = useState<Subject | null>(null);
  const ai = useAiAvailable();
  return (
    <div className="space-y-1">
      {subjects.map((s) => (
        <div key={s.id} className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/60">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
          <button className="min-w-0 flex-1 text-left" onClick={() => setEdit(s)}>
            <p className="truncate text-sm">{s.name}</p>
            {(s.teacher || s.room || s.credits) && (
              <p className="truncate text-xs text-muted-foreground">{[s.teacher, s.room && `Aula ${s.room}`, s.credits && `${s.credits} ECTS`].filter(Boolean).join(" · ")}</p>
            )}
          </button>
          {s.moodle_url && <a href={s.moodle_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground" aria-label="Aula virtual"><ExternalLink className="h-3.5 w-3.5" /></a>}
          {ai && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => setImportFor(s)} aria-label="Importar guía docente con IA" title="Importar guía docente con IA">
              <Sparkles className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ))}
      {subjects.length === 0 && <p className="text-xs text-muted-foreground">Se crean automáticamente al sincronizar tu calendario, o añádelas aquí.</p>}
      <Button size="sm" variant="outline" className="mt-2 w-full" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Nueva asignatura</Button>
      <SubjectDialog subject={edit} open={creating || !!edit} onOpenChange={(o) => { if (!o) { setEdit(null); setCreating(false); } }} />
      {importFor && <SyllabusImport subject={importFor} open={!!importFor} onOpenChange={(o) => !o && setImportFor(null)} />}
    </div>
  );
}

function NoteEditor({ note, subjects }: { note: Note; subjects: Subject[] }) {
  const { save, remove } = useNoteMutations();
  const [v, setV] = useState(note.content);
  const [title, setTitle] = useState(note.title);
  const [preview, setPreview] = useState(note.content.length > 0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const debounced = (patch: { content?: string; title?: string }) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => save.mutate({ id: note.id, ...patch }), 700);
  };
  const subject = subjects.find((s) => s.id === note.subject_id);
  return (
    <div className="group flex flex-col rounded-md border bg-background" style={subject ? { borderTopColor: subject.color, borderTopWidth: 3 } : undefined}>
      <div className="flex items-center gap-1 border-b px-2 py-1">
        <Input
          value={title}
          maxLength={120}
          placeholder="Título"
          className="h-7 border-0 px-1 text-sm font-medium shadow-none focus-visible:ring-0"
          onChange={(e) => { setTitle(e.target.value); debounced({ title: e.target.value }); }}
        />
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => setPreview((p) => !p)} aria-label={preview ? "Editar" : "Vista previa"}>
          {preview ? <Pencil className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100" onClick={() => remove.mutate(note.id)} aria-label="Eliminar nota"><Trash2 className="h-3 w-3" /></Button>
      </div>
      {preview ? (
        <button className="prose-note min-h-24 cursor-text px-3 py-2 text-left text-sm" onClick={() => setPreview(false)}>
          {v.trim() ? <ReactMarkdown>{v}</ReactMarkdown> : <span className="text-muted-foreground">Nota vacía</span>}
        </button>
      ) : (
        <Textarea
          rows={5}
          autoFocus={!note.content}
          value={v}
          maxLength={20000}
          placeholder="Escribe en Markdown: **negrita**, - listas, # títulos…"
          className="resize-y rounded-none border-0 shadow-none focus-visible:ring-0"
          onBlur={() => v.trim() && setPreview(true)}
          onChange={(e) => { setV(e.target.value); debounced({ content: e.target.value }); }}
        />
      )}
      <div className="border-t px-2 py-1">
        <Select value={note.subject_id ?? "none"} onValueChange={(val) => save.mutate({ id: note.id, subject_id: val === "none" ? null : val })}>
          <SelectTrigger className="h-7 border-0 text-xs shadow-none"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sin asignatura</SelectItem>
            {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function Notes({ subjects }: { subjects: Subject[] }) {
  const { data: notes = [], isLoading } = useNotes();
  const { save } = useNoteMutations();
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const shown = notes.filter((n) =>
    (filter === "all" || (filter === "none" ? !n.subject_id : n.subject_id === filter)) &&
    (!q || `${n.title} ${n.content}`.toLowerCase().includes(q.toLowerCase())),
  );
  return (
    <Panel title="Apuntes y notas" action={<Button variant="ghost" size="sm" className="h-7" onClick={() => save.mutate({ content: "", subject_id: filter !== "all" && filter !== "none" ? filter : null })}><Plus className="h-3.5 w-3.5" /> Nota</Button>}>
      {notes.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          <Input placeholder="Buscar en notas…" className="h-8 w-full sm:w-48" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-8 w-full sm:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las asignaturas</SelectItem>
              <SelectItem value="none">Sin asignatura</SelectItem>
              {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      {isLoading ? <Loading /> : shown.length === 0 ? <Empty icon={StickyNote} title={notes.length ? "Ninguna nota coincide" : "Sin notas"}>Las notas se guardan automáticamente y admiten Markdown.</Empty> : (
        <div className="grid gap-3 sm:grid-cols-2">{shown.map((n) => <NoteEditor key={n.id} note={n} subjects={subjects} />)}</div>
      )}
    </Panel>
  );
}

function Links() {
  const { data: links = [] } = useLinks();
  const { add, remove } = useLinkMutations();
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  return (
    <Panel title="Enlaces rápidos">
      {links.length === 0 && <p className="mb-2 text-xs text-muted-foreground">Guarda aquí tu campus virtual, secretaría, biblioteca…</p>}
      <ul className="space-y-1">
        {links.map((l) => (
          <li key={l.id} className="group flex items-center gap-2">
            <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
            <a href={l.url} target="_blank" rel="noreferrer" className="flex-1 truncate text-sm hover:underline">{l.label}</a>
            <button onClick={() => remove.mutate(l.id)} className="text-muted-foreground opacity-0 group-hover:opacity-100" aria-label="Eliminar"><Trash2 className="h-3.5 w-3.5" /></button>
          </li>
        ))}
      </ul>
      <form
        className="mt-3 space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          let u = url.trim();
          if (!/^https?:\/\//.test(u)) u = "https://" + u;
          try { new URL(u); } catch { return; }
          if (label.trim()) add.mutate({ label: label.trim(), url: u }, { onSuccess: () => { setLabel(""); setUrl(""); } });
        }}
      >
        <Input placeholder="Nombre" className="h-8" maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)} />
        <div className="flex gap-2">
          <Input placeholder="https://…" className="h-8" maxLength={500} value={url} onChange={(e) => setUrl(e.target.value)} />
          <Button size="sm" variant="outline" className="h-8" type="submit"><Plus className="h-4 w-4" /></Button>
        </div>
      </form>
    </Panel>
  );
}
