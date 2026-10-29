import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { AlertCircle, CheckCircle2, CircleDashed, Copy, Loader2, Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ErrorBox, Loading, PageHeader, Panel } from "@/components/dash/common";
import { supabase } from "@/integrations/supabase/client";
import { addCalendarSource, importIcsFile, replaceCalendarUrl, syncCalendars } from "@/lib/calendar.functions";
import { qk, useCalendarSources, useProfile, useProfileMutation, type CalendarSource } from "@/lib/data";
import { googleConnectUrl, googleDisconnect } from "@/lib/gmail.functions";
import { getNotifyConfig, sendTestNotification } from "@/lib/notify.functions";
import { useGmailStatus } from "@/lib/useAgenda";
import { disableReminders, enableReminders, pushSupported, remindersEnabled } from "@/lib/useReminders";

const GOOGLE_RESULT: Record<string, [ok: boolean, msg: string]> = {
  ok: [true, "Gmail conectado"],
  denied: [false, "Has cancelado la conexión con Google"],
  invalid: [false, "La conexión con Google caducó; inténtalo de nuevo"],
  no_refresh: [false, "Google no devolvió acceso permanente; quita el acceso de Brújula en tu cuenta de Google y reconecta"],
  not_configured: [false, "Google no está configurado en el servidor"],
  error: [false, "No se pudo conectar con Google"],
};

export const Route = createFileRoute("/_authenticated/ajustes")({
  head: () => ({
    meta: [
      { title: "Ajustes · Brújula" },
      { name: "description", content: "Perfil, integraciones y preferencias." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { google?: string } =>
    typeof search["google"] === "string" ? { google: search["google"] } : {},
  component: SettingsPage,
});

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${ok ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}
    >
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <CircleDashed className="h-3 w-3" />}
      {label}
    </span>
  );
}

function SettingsPage() {
  const { google } = Route.useSearch();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();
  useEffect(() => {
    if (!google) return;
    const [ok, msg] = GOOGLE_RESULT[google] ?? [false, "Respuesta de Google desconocida"];
    if (ok) toast.success(msg);
    else toast.error(msg);
    qc.invalidateQueries({ queryKey: ["gmail"] });
    navigate({ search: {}, replace: true });
  }, [google, navigate, qc]);

  return (
    <div className="space-y-4">
      <PageHeader title="Ajustes" description="Perfil, integraciones y preferencias." />
      <ProfileSettings />
      <CalendarSettings />
      <GmailSettings />
      <ReminderSettings />
      <ExportSettings />
    </div>
  );
}

function ProfileSettings() {
  const { data: profile, isLoading } = useProfile();
  const update = useProfileMutation();
  const [f, setF] = useState({ display_name: "", university: "", degree: "", weekly_goal: "10", absence_pct: "20" });
  useEffect(() => {
    if (profile)
      setF({
        display_name: profile.display_name,
        university: profile.university ?? "",
        degree: profile.degree ?? "",
        weekly_goal: String(profile.weekly_goal_minutes / 60),
        absence_pct: String(profile.absence_limit_pct),
      });
  }, [profile]);
  if (isLoading) return <Panel title="Perfil"><Loading /></Panel>;
  return (
    <Panel title="Perfil y preferencias">
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          update.mutate(
            {
              display_name: f.display_name.trim(),
              university: f.university.trim() || null,
              degree: f.degree.trim() || null,
              weekly_goal_minutes: Math.round(Math.max(0, Number(f.weekly_goal.replace(",", ".")) || 0) * 60),
              absence_limit_pct: Math.max(0, Math.min(100, Math.round(Number(f.absence_pct) || 20))),
            },
            { onSuccess: () => toast.success("Guardado") },
          );
        }}
      >
        <div className="space-y-1.5"><Label htmlFor="p-name">Nombre</Label><Input id="p-name" maxLength={60} value={f.display_name} onChange={(e) => setF({ ...f, display_name: e.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="p-uni">Centro de estudios</Label><Input id="p-uni" maxLength={120} value={f.university} onChange={(e) => setF({ ...f, university: e.target.value })} /></div>
        <div className="space-y-1.5"><Label htmlFor="p-deg">Estudios</Label><Input id="p-deg" maxLength={120} value={f.degree} onChange={(e) => setF({ ...f, degree: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label htmlFor="p-goal">Objetivo semanal (h)</Label><Input id="p-goal" inputMode="decimal" value={f.weekly_goal} onChange={(e) => setF({ ...f, weekly_goal: e.target.value })} /></div>
          <div className="space-y-1.5"><Label htmlFor="p-abs">Faltas permitidas (%)</Label><Input id="p-abs" type="number" min={0} max={100} value={f.absence_pct} onChange={(e) => setF({ ...f, absence_pct: e.target.value })} /></div>
        </div>
        <div className="sm:col-span-2"><Button type="submit" size="sm" disabled={update.isPending}>Guardar</Button></div>
      </form>
    </Panel>
  );
}

const KIND_LABEL: Record<string, string> = { deadlines: "Entregas y exámenes", classes: "Horario de clases", other: "Otros eventos" };

function CalendarSettings() {
  const qc = useQueryClient();
  const sources = useCalendarSources();
  const addFn = useServerFn(addCalendarSource);
  const syncFn = useServerFn(syncCalendars);
  const importFn = useServerFn(importIcsFile);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("deadlines");
  const [url, setUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = () => [qk.sources, qk.events, qk.subjects].forEach((k) => qc.invalidateQueries({ queryKey: k }));
  const onErr = (e: Error) => toast.error(e.message);

  const add = useMutation({
    mutationFn: () => addFn({ data: { name: name.trim() || "Calendario", kind: kind as "deadlines", icsUrl: url } }),
    onSuccess: (r) => {
      if ("error" in r && r.error) toast.error(`Guardado, pero la primera sincronización falló: ${r.error}`);
      else toast.success(`${r.imported} eventos importados`);
      setName("");
      setUrl("");
      refresh();
    },
    onError: onErr,
  });
  const syncAll = useMutation({
    mutationFn: () => syncFn({ data: { force: true } }),
    onSuccess: (r) => {
      if (r.errors.length) toast.error(r.errors.join("\n"));
      else toast.success(`${r.imported} eventos actualizados`);
      refresh();
    },
    onError: onErr,
  });
  const imp = useMutation({
    mutationFn: (text: string) => importFn({ data: { text, kind: kind as "deadlines" } }),
    onSuccess: (r) => { toast.success(`${r.imported} eventos importados`); refresh(); },
    onError: onErr,
  });

  const list = sources.data ?? [];
  return (
    <Panel
      title="Calendarios"
      action={<StatusPill ok={list.length > 0} label={list.length ? `${list.length} conectado${list.length > 1 ? "s" : ""}` : "Sin configurar"} />}
    >
      {sources.isLoading ? <Loading /> : sources.error ? <ErrorBox error={sources.error} /> : (
        <div className="space-y-5">
          {list.length > 0 && (
            <div className="space-y-2">
              {list.map((s) => <SourceRow key={s.id} source={s} onChange={refresh} />)}
              <Button variant="outline" size="sm" disabled={syncAll.isPending} onClick={() => syncAll.mutate()}>
                {syncAll.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Sincronizar todo
              </Button>
            </div>
          )}
          <div className="rounded-md bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
            <p className="font-medium text-foreground">¿Dónde está la URL iCal?</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              <li><strong>Moodle</strong>: Calendario → Importar o exportar calendarios → Exportar → «Obtener URL del calendario».</li>
              <li><strong>Canvas</strong>: Calendario → «Calendar Feed» (abajo a la derecha).</li>
              <li><strong>Google Classroom / Google Calendar</strong>: ajustes del calendario → «Dirección secreta en formato iCal».</li>
              <li><strong>Outlook / Teams</strong>: Configuración → Calendarios compartidos → Publicar → enlace ICS.</li>
            </ul>
            <p className="mt-1">La URL se guarda solo en el servidor y nunca se muestra en el navegador. No se pide ninguna contraseña.</p>
          </div>
          <form
            className="grid gap-2 sm:grid-cols-[1fr_11rem]"
            onSubmit={(e) => { e.preventDefault(); if (url.trim()) add.mutate(); }}
          >
            <Input placeholder="Nombre (p. ej. Moodle)" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(KIND_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="url" placeholder="https://… o webcal://…" value={url} onChange={(e) => setUrl(e.target.value)} />
            <Button type="submit" disabled={add.isPending || !url.trim()}>{add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Añadir</Button>
          </form>
          <div className="border-t pt-4">
            <p className="text-sm font-medium">Importación manual</p>
            <p className="mb-2 text-xs text-muted-foreground">Si tu plataforma no da URL, descarga el archivo .ics y súbelo (se importa como «{KIND_LABEL[kind]}»).</p>
            <input
              ref={fileRef}
              type="file"
              accept=".ics,text/calendar"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) imp.mutate(await f.text());
                e.target.value = "";
              }}
            />
            <Button variant="outline" size="sm" disabled={imp.isPending} onClick={() => fileRef.current?.click()}>
              {imp.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Subir archivo .ics
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}

function SourceRow({ source, onChange }: { source: CalendarSource; onChange: () => void }) {
  const syncFn = useServerFn(syncCalendars);
  const replaceFn = useServerFn(replaceCalendarUrl);
  const [replacing, setReplacing] = useState(false);
  const [url, setUrl] = useState("");
  const sync = useMutation({
    mutationFn: () => syncFn({ data: { force: true, sourceId: source.id } }),
    onSuccess: (r) => { toast.success(`${r.imported} eventos actualizados`); onChange(); },
    onError: (e: Error) => { toast.error(e.message); onChange(); },
  });
  const replace = useMutation({
    mutationFn: () => replaceFn({ data: { id: source.id, icsUrl: url } }),
    onSuccess: () => { toast.success("URL actualizada"); setReplacing(false); setUrl(""); onChange(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("calendar_sources").delete().eq("id", source.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: onChange,
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: source.color }} />
        <span className="text-sm font-medium">{source.name}</span>
        <span className="text-xs text-muted-foreground">{KIND_LABEL[source.kind]}</span>
        <span className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={sync.isPending} onClick={() => sync.mutate()} aria-label="Sincronizar">
            <RefreshCw className={`h-3.5 w-3.5 ${sync.isPending ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setReplacing((v) => !v)}>Cambiar URL</Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => confirm(`¿Quitar «${source.name}» y sus eventos?`) && remove.mutate()} aria-label="Quitar">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {source.last_sync ? `Sincronizado ${formatDistanceToNow(new Date(source.last_sync), { addSuffix: true, locale: es })}` : "Nunca sincronizado"}
      </p>
      {source.last_error && <p className="mt-1 flex items-start gap-1 text-xs text-destructive"><AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />{source.last_error}</p>}
      {replacing && (
        <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (url.trim()) replace.mutate(); }}>
          <Input type="url" className="h-8" placeholder="Nueva URL iCal" value={url} onChange={(e) => setUrl(e.target.value)} />
          <Button size="sm" className="h-8" disabled={replace.isPending}>Guardar</Button>
        </form>
      )}
    </div>
  );
}

function GmailSettings() {
  const qc = useQueryClient();
  const s = useGmailStatus();
  const connectFn = useServerFn(googleConnectUrl);
  const disconnectFn = useServerFn(googleDisconnect);
  const connect = useMutation({
    mutationFn: () => connectFn(),
    onSuccess: ({ url }) => { window.location.href = url; },
    onError: (e: Error) => toast.error(e.message),
  });
  const disconnect = useMutation({
    mutationFn: () => disconnectFn(),
    onSuccess: () => { toast.success("Gmail desconectado"); qc.invalidateQueries({ queryKey: ["gmail"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const detail = s.data && "error" in s.data ? s.data.error : null;
  return (
    <Panel
      title="Gmail"
      action={s.data && <StatusPill ok={s.data.connected} label={s.data.connected ? "Conectado" : "No conectado"} />}
    >
      {s.isLoading ? <Loading /> : s.error ? <ErrorBox error={s.error} /> : s.data?.connected ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm">Conectado como <strong>{s.data.email}</strong> con acceso de solo lectura.</p>
          <Button variant="ghost" size="sm" className="text-destructive" disabled={disconnect.isPending} onClick={() => disconnect.mutate()}>Desconectar</Button>
        </div>
      ) : !s.data?.available ? (
        <p className="text-sm text-muted-foreground">La conexión con Google no está configurada en este servidor.</p>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">Conecta tu cuenta de Google para leer tu bandeja (solo lectura; nunca enviamos ni borramos nada).</p>
          <Button size="sm" disabled={connect.isPending} onClick={() => connect.mutate()}>{connect.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Conectar Gmail</Button>
        </div>
      )}
      {detail && <p className="mt-2 text-xs text-destructive">Detalle: {detail}</p>}
    </Panel>
  );
}

function ReminderSettings() {
  const configFn = useServerFn(getNotifyConfig);
  const testFn = useServerFn(sendTestNotification);
  const config = useQuery({ queryKey: ["notify", "config"], queryFn: () => configFn(), staleTime: Infinity });
  const { data: profile } = useProfile();
  const update = useProfileMutation();
  const [on, setOn] = useState(false);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    setOn(remindersEnabled());
    setBlocked(typeof window !== "undefined" && "Notification" in window && Notification.permission === "denied");
  }, []);

  const toggle = async (next: boolean) => {
    try {
      if (next) {
        const r = await enableReminders(config.data?.vapidPublicKey ?? null);
        setOn(r.ok);
        if (!r.ok) {
          setBlocked(true);
          toast.error("No se pudieron activar las notificaciones. Revisa los permisos del navegador.");
        } else toast.success(r.push ? "Recordatorios activados en este dispositivo" : "Recordatorios activados (solo con la app abierta)");
      } else {
        await disableReminders();
        setOn(false);
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const test = useMutation({ mutationFn: () => testFn(), onSuccess: () => toast.success("Notificación enviada"), onError: (e: Error) => toast.error(e.message) });
  const push = !!config.data?.vapidPublicKey && pushSupported();

  return (
    <Panel title="Recordatorios" action={<StatusPill ok={on || !!profile?.digest_email} label={on || profile?.digest_email ? "Activados" : "Desactivados"} />}>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 text-sm text-muted-foreground">
            <p className="text-foreground">Notificaciones en este dispositivo</p>
            <p className="text-xs">
              {push
                ? "Cada mañana te avisamos de lo que vence hoy y mañana, aunque no tengas la app abierta. En el móvil, instala Brújula en la pantalla de inicio."
                : "Se muestran al abrir el panel, como máximo una vez al día por entrega."}
            </p>
            {blocked && <p className="text-xs text-destructive">Las notificaciones están bloqueadas en este navegador; habilítalas en los ajustes del sitio.</p>}
          </div>
          <Switch checked={on} onCheckedChange={toggle} aria-label="Activar notificaciones" />
        </div>
        {on && push && <Button variant="outline" size="sm" disabled={test.isPending} onClick={() => test.mutate()}>Enviar notificación de prueba</Button>}
        <div className="flex items-start justify-between gap-4 border-t pt-4">
          <div className="space-y-1 text-sm text-muted-foreground">
            <p className="text-foreground">Resumen diario por email</p>
            <p className="text-xs">{config.data?.email ? "Un correo cada mañana con las entregas y exámenes de hoy y mañana." : "El envío de emails no está configurado en este servidor."}</p>
          </div>
          <Switch
            checked={!!profile?.digest_email}
            disabled={!config.data?.email}
            onCheckedChange={(v) => update.mutate({ digest_email: v })}
            aria-label="Resumen por email"
          />
        </div>
      </div>
    </Panel>
  );
}

function ExportSettings() {
  const { data: profile } = useProfile();
  const update = useProfileMutation();
  if (!profile) return null;
  const url = `${window.location.origin}/api/ics/${profile.feed_token}.ics`;
  const regenerate = () => {
    if (!confirm("El enlace anterior dejará de funcionar. ¿Continuar?")) return;
    const token = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
    update.mutate({ feed_token: token }, { onSuccess: () => toast.success("Enlace regenerado") });
  };
  return (
    <Panel title="Exportar a tu calendario">
      <p className="mb-2 text-sm text-muted-foreground">Suscríbete a este enlace desde Google Calendar («Otros calendarios → Desde URL»), Apple Calendar u Outlook para ver tus tareas, entregas y clases allí.</p>
      <div className="flex gap-2">
        <Input readOnly value={url} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
        <Button variant="outline" size="icon" aria-label="Copiar enlace" onClick={() => navigator.clipboard.writeText(url).then(() => toast.success("Enlace copiado"))}><Copy className="h-4 w-4" /></Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Es privado: quien tenga el enlace puede ver tu calendario.{" "}
        <button className="underline hover:text-foreground" onClick={regenerate}>Regenerar enlace</button>
      </p>
    </Panel>
  );
}
