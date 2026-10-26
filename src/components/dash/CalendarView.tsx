import { addDays, addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { AgendaItem } from "@/lib/data";
import { AgendaRow } from "./common";

export type CalMode = "month" | "week" | "day";

function Chip({ item, onClick }: { item: AgendaItem; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn("flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] leading-tight hover:bg-muted", item.done && "line-through opacity-60")}
      title={item.title}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" style={item.subject ? { backgroundColor: item.subject.color } : undefined} />
      {!item.allDay && <span className="text-muted-foreground">{format(item.date, "HH:mm")}</span>}
      <span className="truncate">{item.title}</span>
    </button>
  );
}

export function CalendarView({ items, onSelect, initialMode = "month", compact = false }: { items: AgendaItem[]; onSelect: (i: AgendaItem) => void; initialMode?: CalMode; compact?: boolean }) {
  const [mode, setMode] = useState<CalMode>(initialMode);
  const [cursor, setCursor] = useState(new Date());

  const days = useMemo(() => {
    if (mode === "month") {
      return eachDayOfInterval({ start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }) });
    }
    if (mode === "week") return eachDayOfInterval({ start: startOfWeek(cursor, { weekStartsOn: 1 }), end: endOfWeek(cursor, { weekStartsOn: 1 }) });
    return [cursor];
  }, [mode, cursor]);

  const forDay = (d: Date) => items.filter((i) => isSameDay(i.date, d));
  const move = (n: number) => setCursor((c) => (mode === "month" ? addMonths(c, n) : mode === "week" ? addWeeks(c, n) : addDays(c, n)));
  const title = mode === "month" ? format(cursor, "MMMM yyyy", { locale: es }) : mode === "week" ? `${format(days[0]!, "d MMM", { locale: es })} – ${format(days[6]!, "d MMM yyyy", { locale: es })}` : format(cursor, "EEEE d MMMM yyyy", { locale: es });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(-1)} aria-label="Anterior"><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(1)} aria-label="Siguiente"><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" className="h-7" onClick={() => setCursor(new Date())}>Hoy</Button>
        </div>
        <span className="text-sm font-medium capitalize">{title}</span>
        {!compact && (
          <ToggleGroup type="single" size="sm" value={mode} onValueChange={(v) => v && setMode(v as CalMode)} className="ml-auto">
            <ToggleGroupItem value="month">Mes</ToggleGroupItem>
            <ToggleGroupItem value="week">Semana</ToggleGroupItem>
            <ToggleGroupItem value="day">Día</ToggleGroupItem>
          </ToggleGroup>
        )}
      </div>

      {mode === "day" ? (
        <div className="rounded-md border p-2">
          {forDay(cursor).length ? forDay(cursor).map((i) => <AgendaRow key={i.key} item={i} onClick={() => onSelect(i)} />) : <p className="py-6 text-center text-sm text-muted-foreground">Nada programado este día.</p>}
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <div className="grid grid-cols-7 border-b bg-muted/40">
            {["L", "M", "X", "J", "V", "S", "D"].map((d) => <div key={d} className="px-2 py-1 text-[11px] font-medium text-muted-foreground">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const list = forDay(d);
              return (
                <div key={d.toISOString()} className={cn("border-b border-r p-1 last:border-r-0 [&:nth-child(7n)]:border-r-0", mode === "month" ? "min-h-24" : compact ? "min-h-28" : "min-h-56", mode === "month" && !isSameMonth(d, cursor) && "bg-muted/30")}>
                  <button
                    onClick={() => { setCursor(d); if (!compact) setMode("day"); }}
                    className={cn("mb-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[11px]", isToday(d) ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground hover:bg-muted")}
                  >
                    {format(d, "d")}
                  </button>
                  <div className="space-y-0.5">
                    {list.slice(0, mode === "month" ? 3 : 8).map((i) => <Chip key={i.key} item={i} onClick={() => onSelect(i)} />)}
                    {list.length > (mode === "month" ? 3 : 8) && <p className="px-1 text-[10px] text-muted-foreground">+{list.length - (mode === "month" ? 3 : 8)} más</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
