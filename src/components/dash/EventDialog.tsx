import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CATEGORY_LABEL, useTaskMutations, type AgendaItem } from "@/lib/data";
import { CategoryBadge, DueBadge } from "./common";

export function EventDialog({ item, onClose }: { item: AgendaItem | null; onClose: () => void }) {
  const { save } = useTaskMutations();
  const ev = item?.event;
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {item && item.kind === "class" && (
          <DialogHeader>
            <DialogTitle>{item.title}</DialogTitle>
            <DialogDescription>
              {CATEGORY_LABEL.class} · {format(item.date, "EEEE d MMMM, HH:mm", { locale: es })}
              {item.end ? `–${format(item.end, "HH:mm")}` : ""}
              {item.description ? ` · ${item.description}` : ""}
            </DialogDescription>
          </DialogHeader>
        )}
        {item && ev && (
          <>
            <DialogHeader>
              <DialogTitle>{item.title}</DialogTitle>
              <DialogDescription>{ev.course ?? "Calendario"} · {format(item.date, "EEEE d MMMM yyyy, HH:mm", { locale: es })}</DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2"><CategoryBadge category={item.category} /><DueBadge date={item.date} /></div>
            {ev.description ? (
              <p className="max-h-60 overflow-auto whitespace-pre-wrap text-sm text-muted-foreground">{ev.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground">El calendario no incluye descripción para esta actividad.</p>
            )}
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  save.mutate(
                    {
                      title: ev.title,
                      description: ev.description,
                      subject_id: item.subject?.id ?? null,
                      due_date: format(item.date, "yyyy-MM-dd"),
                      due_time: format(item.date, "HH:mm"),
                      priority: "high",
                      kind: item.category === "exam" ? "exam" : "deliverable",
                      status: "todo",
                      recurrence: "none",
                      source_uid: ev.uid,
                    },
                    { onSuccess: onClose },
                  )
                }
              >
                Convertir en tarea
              </Button>
              {ev.url && (
                <Button asChild>
                  <a href={ev.url} target="_blank" rel="noreferrer">Abrir enlace <ExternalLink className="h-3.5 w-3.5" /></a>
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
