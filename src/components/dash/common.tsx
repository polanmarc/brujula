import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AlertCircle, ExternalLink, GraduationCap, Inbox, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { dueLabel, type AgendaItem, type Subject } from "@/lib/data";

export function PageHeader({ title, description, actions }: { title: string; description?: string | undefined; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, action, children, className }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("animate-in-up rounded-lg border bg-card", className)}>
      {title && (
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <h2 className="text-sm font-medium">{title}</h2>
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function SubjectDot({ subject, className }: { subject: Subject | null; className?: string }) {
  return <span className={cn("inline-block h-2 w-2 shrink-0 rounded-full bg-muted-foreground/40", className)} style={subject ? { backgroundColor: subject.color } : undefined} />;
}

export function DueBadge({ date, done }: { date: Date; done?: boolean }) {
  if (done) return <span className="text-xs text-muted-foreground">Hecha</span>;
  const l = dueLabel(date);
  return (
    <span className={cn("whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium",
      l.tone === "overdue" && "bg-destructive/10 text-destructive",
      l.tone === "soon" && "bg-warning/15 text-warning",
      l.tone === "normal" && "bg-muted text-muted-foreground")}>
      {l.text}
    </span>
  );
}

export function AgendaRow({ item, onClick }: { item: AgendaItem; onClick?: () => void }) {
  return (
    <div className="group flex items-center gap-3 rounded-md px-2 py-2 hover:bg-muted/60">
      <SubjectDot subject={item.subject} />
      <button onClick={onClick} className="min-w-0 flex-1 text-left">
        <div className={cn("flex items-center gap-1.5 truncate text-sm", item.done && "text-muted-foreground line-through")}>
          {item.kind === "event" && <GraduationCap className="h-3.5 w-3.5 shrink-0 text-primary" />}
          <span className="truncate">{item.title}</span>
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {item.subject?.name ?? item.event?.course ?? (item.kind === "task" ? "Personal" : "Moodle")} · {format(item.date, item.allDay ? "EEE d MMM" : "EEE d MMM, HH:mm", { locale: es })}
        </div>
      </button>
      <DueBadge date={item.date} done={item.done} />
      {item.url && (
        <a href={item.url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground" aria-label="Abrir en Moodle">
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}

export function Empty({ icon: Icon = Inbox, title, children }: { icon?: typeof Inbox; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Icon className="h-6 w-6 text-muted-foreground/60" />
      <p className="mt-2 text-sm font-medium">{title}</p>
      {children && <div className="mt-1 max-w-sm text-xs text-muted-foreground">{children}</div>}
    </div>
  );
}

export function Loading() {
  return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
}

export function ErrorBox({ error }: { error: unknown }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="break-words">{(error as Error)?.message ?? "Error desconocido"}</span>
    </div>
  );
}
