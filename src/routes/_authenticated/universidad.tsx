import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, ExternalLink, Link2, Plus, StickyNote, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AgendaRow, Empty, Loading, PageHeader, Panel } from "@/components/dash/common";
import { EventDialog } from "@/components/dash/EventDialog";
import { TaskDialog } from "@/components/dash/TaskDialog";
import { useLinkMutations, useLinks, useNoteMutations, useNotes, useSubjectMutations, useSubjects, type Note, type Subject } from "@/lib/data";
import { useAgenda, useAgendaSelection } from "@/lib/useAgenda";

export const Route = createFileRoute("/_authenticated/universidad")({
  head: () => ({ meta: [{ title: "Universidad · Panel personal" }, { name: "description", content: "Asignaturas, entregas y notas." }] }),
  component: UniPage,
});

function UniPage() {
  const { data: subjects = [], isLoading } = useSubjects();
  const { items } = useAgenda();
  const sel = useAgendaSelection();
  const now = Date.now() - 864e5;
  const upcoming = items.filter((i) => !i.done && i.date.getTime() >= now);
  const groups = [...subjects.map((s) => ({ key: s.id, subject: s as Subject | null, list: upcoming.filter((i) => i.subject?.id === s.id) })),
    { key: "none", subject: null, list: upcoming.filter((i) => !i.subject) }].filter((g) => g.list.length);

  return (
    <div className="space-y-6">
      <PageHeader title="Universidad" description="Asignaturas, entregas, notas y enlaces." />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel title="Próximas entregas por asignatura">
            {groups.length === 0 ? <Empty icon={BookOpen} title="Sin entregas próximas">Sincroniza Moodle en <Link to="/ajustes" className="underline">Ajustes</Link>.</Empty> : (
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
          <Notes />
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
  const { save, remove } = useSubjectMutations();
  const [name, setName] = useState("");
  return (
    <div className="space-y-2">
      {subjects.map((s) => (
        <div key={s.id} className="flex items-center gap-2">
          <input type="color" aria-label={`Color de ${s.name}`} defaultValue={s.color} onBlur={(e) => e.target.value !== s.color && save.mutate({ id: s.id, name: s.name, color: e.target.value })} className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0" />
          <span className="flex-1 truncate text-sm">{s.name}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => confirm(`¿Eliminar ${s.name}?`) && remove.mutate(s.id)} aria-label="Eliminar"><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      ))}
      {subjects.length === 0 && <p className="text-xs text-muted-foreground">Se crean automáticamente al sincronizar Moodle, o añádelas aquí.</p>}
      <form className="flex gap-2 pt-1" onSubmit={(e) => { e.preventDefault(); if (name.trim()) save.mutate({ name: name.trim(), color: "#3b82f6" }, { onSuccess: () => setName("") }); }}>
        <Input placeholder="Nueva asignatura" className="h-8" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
        <Button size="sm" variant="outline" className="h-8" type="submit"><Plus className="h-4 w-4" /></Button>
      </form>
    </div>
  );
}

function NoteEditor({ note }: { note: Note }) {
  const { save, remove } = useNoteMutations();
  const [v, setV] = useState(note.content);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <div className="group relative">
      <Textarea
        rows={4}
        value={v}
        maxLength={20000}
        placeholder="Escribe una nota…"
        className="resize-y bg-background"
        onChange={(e) => {
          setV(e.target.value);
          clearTimeout(timer.current);
          const content = e.target.value;
          timer.current = setTimeout(() => save.mutate({ id: note.id, content }), 700);
        }}
      />
      <Button variant="ghost" size="icon" className="absolute right-1 top-1 h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => remove.mutate(note.id)} aria-label="Eliminar nota"><Trash2 className="h-3 w-3" /></Button>
    </div>
  );
}

function Notes() {
  const { data: notes = [], isLoading } = useNotes();
  const { save } = useNoteMutations();
  return (
    <Panel title="Notas rápidas" action={<Button variant="ghost" size="sm" className="h-7" onClick={() => save.mutate({ content: "" })}><Plus className="h-3.5 w-3.5" /> Nota</Button>}>
      {isLoading ? <Loading /> : notes.length === 0 ? <Empty icon={StickyNote} title="Sin notas">Las notas se guardan automáticamente.</Empty> : (
        <div className="grid gap-3 sm:grid-cols-2">{notes.map((n) => <NoteEditor key={n.id} note={n} />)}</div>
      )}
    </Panel>
  );
}

function Links() {
  const { data: links = [] } = useLinks();
  const { add, remove } = useLinkMutations();
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const fixed = [
    { label: "Moodle TecnoCampus", url: "https://moodle.tecnocampus.cat" },
    { label: "Gmail", url: "https://mail.google.com" },
  ];
  return (
    <Panel title="Enlaces rápidos">
      <ul className="space-y-1">
        {[...fixed.map((f) => ({ ...f, id: null as string | null })), ...links].map((l) => (
          <li key={l.id ?? l.url} className="group flex items-center gap-2">
            <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
            <a href={l.url} target="_blank" rel="noreferrer" className="flex-1 truncate text-sm hover:underline">{l.label}</a>
            {l.id ? (
              <button onClick={() => remove.mutate(l.id!)} className="text-muted-foreground opacity-0 group-hover:opacity-100" aria-label="Eliminar"><Trash2 className="h-3.5 w-3.5" /></button>
            ) : <ExternalLink className="h-3 w-3 text-muted-foreground" />}
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
