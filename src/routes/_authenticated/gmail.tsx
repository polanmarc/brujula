import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { format, isToday } from "date-fns";
import { es } from "date-fns/locale";
import { ExternalLink, Mail, RefreshCw, Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Empty, ErrorBox, Loading, PageHeader, Panel } from "@/components/dash/common";
import { getMail, listMail } from "@/lib/gmail.functions";
import { useGmailStatus } from "@/lib/useAgenda";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/gmail")({
  head: () => ({ meta: [{ title: "Gmail · Panel personal" }, { name: "description", content: "Bandeja de entrada de solo lectura." }] }),
  component: GmailPage,
});

const senderName = (from: string) => from.replace(/<.*>/, "").replace(/"/g, "").trim() || from;

function GmailPage() {
  const status = useGmailStatus();
  const list = useServerFn(listMail);
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const connected = status.data?.connected;

  const mail = useQuery({
    queryKey: ["gmail", "list", search, unreadOnly],
    queryFn: () => list({ data: { q: search, unreadOnly } }),
    enabled: !!connected,
    refetchInterval: 120_000,
  });

  if (status.isLoading) return <Loading />;
  if (status.error) return <ErrorBox error={status.error} />;
  if (!connected) {
    return (
      <div>
        <PageHeader title="Gmail" />
        <Panel>
          <Empty icon={Mail} title="Gmail no está conectado">
            <p>Para ver tu correo hay que vincular tu cuenta de Google con permiso de solo lectura. Pídelo en el chat de Lovable («conecta Gmail») y aparecerá una tarjeta para autorizarla.</p>
            {status.data && "error" in status.data && status.data.error && <p className="mt-2 text-destructive">Detalle: {status.data.error}</p>}
          </Empty>
        </Panel>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Gmail"
        description={`${status.data?.email} · ${status.data?.unread} sin leer en la bandeja de entrada`}
        actions={<Button size="sm" variant="outline" onClick={() => { status.refetch(); mail.refetch(); }} disabled={mail.isFetching}><RefreshCw className={cn("h-4 w-4", mail.isFetching && "animate-spin")} /> Sincronizar</Button>}
      />
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <form className="relative w-full sm:w-80" onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); }}>
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar en Gmail (Enter)" className="h-9 pl-8" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
        <div className="flex items-center gap-2">
          <Switch id="unread" checked={unreadOnly} onCheckedChange={setUnreadOnly} />
          <Label htmlFor="unread" className="text-sm">Solo no leídos</Label>
        </div>
      </div>
      <Panel className="[&>div]:p-0">
        {mail.error ? <div className="p-4"><ErrorBox error={mail.error} /></div> : mail.isLoading ? <Loading /> : !mail.data?.items.length ? (
          <Empty icon={Mail} title="No hay correos">{search || unreadOnly ? "Prueba otra búsqueda." : "Tu bandeja está vacía."}</Empty>
        ) : (
          <ul className="divide-y">
            {mail.data.items.map((m) => (
              <li key={m.id}>
                <button onClick={() => setOpenId(m.id)} className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-muted/50">
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", m.unread ? "bg-primary" : "bg-transparent")} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className={cn("truncate text-sm", m.unread && "font-semibold")}>{senderName(m.from)}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">{format(new Date(m.date), isToday(new Date(m.date)) ? "HH:mm" : "d MMM", { locale: es })}</span>
                    </div>
                    <p className={cn("truncate text-sm", m.unread ? "text-foreground" : "text-muted-foreground")}>{m.subject}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.snippet}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <MessageDialog id={openId} onClose={() => setOpenId(null)} />
      <p className="mt-3 text-xs text-muted-foreground">Acceso de solo lectura. Configura integraciones en <Link to="/ajustes" className="underline">Ajustes</Link>.</p>
    </div>
  );
}

function MessageDialog({ id, onClose }: { id: string | null; onClose: () => void }) {
  const get = useServerFn(getMail);
  const msg = useQuery({ queryKey: ["gmail", "msg", id], queryFn: () => get({ data: { id: id! } }), enabled: !!id, staleTime: Infinity });
  return (
    <Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-2xl">
        {msg.isLoading ? <Loading /> : msg.error ? <ErrorBox error={msg.error} /> : msg.data && (
          <>
            <DialogHeader>
              <DialogTitle className="pr-6">{msg.data.subject}</DialogTitle>
              <DialogDescription>{msg.data.from} · {format(new Date(msg.data.date), "d MMM yyyy, HH:mm", { locale: es })}</DialogDescription>
            </DialogHeader>
            <div className="max-h-[55vh] overflow-auto whitespace-pre-wrap break-words text-sm">{msg.data.body}</div>
            <Button asChild variant="outline" size="sm" className="w-fit">
              <a href={`https://mail.google.com/mail/u/0/#all/${msg.data.threadId}`} target="_blank" rel="noreferrer">Abrir en Gmail <ExternalLink className="h-3.5 w-3.5" /></a>
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
