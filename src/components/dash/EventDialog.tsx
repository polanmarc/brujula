import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTaskMutations, type AgendaItem } from "@/lib/data";
import { DueBadge } from "./common";

export function EventDialog({ item, onClose }: { item: AgendaItem | null; onClose: () => void }) {
  const { save } = useTaskMutations();
  const ev = item?.event;
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        {item && ev && (
          <>
            <DialogHeader>
              <DialogTitle>{item.title}</DialogTitle>
              <DialogDescription>{ev.course ?? "Moodle"} · {format(item.date, "EEEE d MMMM yyyy, HH:mm", { locale: es })}</DialogDescription>
            </DialogHeader>
            <DueBadge date={item.date} />
            {ev.description ? (
              <p className="max-h-60 overflow-auto whitespace-pre-wrap text-sm text-muted-foreground">{ev.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Moodle no incluye descripción para esta actividad.</p>
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
                  <a href={ev.url} target="_blank" rel="noreferrer">Abrir en Moodle <ExternalLink className="h-3.5 w-3.5" /></a>
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
