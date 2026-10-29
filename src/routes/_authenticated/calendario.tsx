import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CategoryIcon, ErrorBox, Loading, PageHeader, Panel } from "@/components/dash/common";
import { CalendarView } from "@/components/dash/CalendarView";
import { EventDialog } from "@/components/dash/EventDialog";
import { TaskDialog } from "@/components/dash/TaskDialog";
import { CATEGORY_LABEL, useSubjects, type AgendaCategory } from "@/lib/data";
import { useAgenda, useAgendaSelection } from "@/lib/useAgenda";

export const Route = createFileRoute("/_authenticated/calendario")({
  head: () => ({ meta: [{ title: "Calendario · Brújula" }, { name: "description", content: "Entregas, exámenes, clases y tareas en un calendario." }] }),
  component: CalendarPage,
});

const CATEGORIES: AgendaCategory[] = ["deadline", "exam", "task", "class", "event"];

function CalendarPage() {
  const { items, isLoading, error } = useAgenda({ withClasses: true });
  const { data: subjects = [] } = useSubjects();
  const sel = useAgendaSelection();
  const [newOpen, setNewOpen] = useState(false);
  const [shown, setShown] = useState<string[]>(CATEGORIES);
  const visible = items.filter((i) => shown.includes(i.category));
  return (
    <div>
      <PageHeader title="Calendario" description="Tareas, entregas, exámenes y clases sin duplicados." actions={<Button size="sm" onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" /> Nueva tarea</Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <ToggleGroup type="multiple" size="sm" value={shown} onValueChange={setShown} className="flex-wrap justify-start">
          {CATEGORIES.map((c) => (
            <ToggleGroupItem key={c} value={c} className="gap-1.5 text-xs">
              <CategoryIcon category={c} /> {CATEGORY_LABEL[c]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {subjects.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {subjects.map((s) => (
              <span key={s.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />{s.name}
              </span>
            ))}
          </div>
        )}
      </div>
      <Panel>{error ? <ErrorBox error={error} /> : isLoading ? <Loading /> : <CalendarView items={visible} onSelect={sel.select} />}</Panel>
      <TaskDialog open={newOpen || !!sel.task} onOpenChange={(o) => { if (!o) { setNewOpen(false); sel.setTask(null); } }} initial={sel.task} />
      <EventDialog item={sel.event} onClose={() => sel.setEvent(null)} />
    </div>
  );
}
