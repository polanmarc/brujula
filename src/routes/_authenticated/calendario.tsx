import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorBox, Loading, PageHeader, Panel } from "@/components/dash/common";
import { CalendarView } from "@/components/dash/CalendarView";
import { EventDialog } from "@/components/dash/EventDialog";
import { TaskDialog } from "@/components/dash/TaskDialog";
import { useSubjects } from "@/lib/data";
import { useAgenda, useAgendaSelection } from "@/lib/useAgenda";

export const Route = createFileRoute("/_authenticated/calendario")({
  head: () => ({ meta: [{ title: "Calendario · Panel personal" }, { name: "description", content: "Entregas de Moodle y tareas en un calendario." }] }),
  component: CalendarPage,
});

function CalendarPage() {
  const { items, isLoading, error } = useAgenda();
  const { data: subjects = [] } = useSubjects();
  const sel = useAgendaSelection();
  const [newOpen, setNewOpen] = useState(false);
  return (
    <div>
      <PageHeader title="Calendario" description="Tareas personales y actividades de Moodle, sin duplicados." actions={<Button size="sm" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> Nueva tarea</Button>} />
      {subjects.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-3">
          {subjects.map((s) => (
            <span key={s.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />{s.name}
            </span>
          ))}
        </div>
      )}
      <Panel>{error ? <ErrorBox error={error} /> : isLoading ? <Loading /> : <CalendarView items={items} onSelect={sel.select} />}</Panel>
      <TaskDialog open={newOpen || !!sel.task} onOpenChange={(o) => { if (!o) { setNewOpen(false); sel.setTask(null); } }} initial={sel.task} />
      <EventDialog item={sel.event} onClose={() => sel.setEvent(null)} />
    </div>
  );
}
