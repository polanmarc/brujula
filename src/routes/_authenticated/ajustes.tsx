import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { CheckCircle2, CircleDashed, Loader2, RefreshCw, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ErrorBox, Loading, PageHeader, Panel } from "@/components/dash/common";
import { qk } from "@/lib/data";
import {
  getMoodleStatus,
  importIcsFile,
  saveMoodleSettings,
  syncMoodle,
} from "@/lib/moodle.functions";
import { useGmailStatus } from "@/lib/useAgenda";
import { disableReminders, enableReminders, remindersEnabled } from "@/lib/useReminders";

export const Route = createFileRoute("/_authenticated/ajustes")({
  head: () => ({
    meta: [
      { title: "Ajustes · Panel personal" },
      { name: "description", content: "Integraciones y preferencias." },
    ],
  }),
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
  return (
    <div className="space-y-4">
      <PageHeader title="Ajustes" description="Integraciones y preferencias." />
      <MoodleSettings />
      <GmailSettings />
      <ReminderSettings />
    </div>
  );
}

function ReminderSettings() {
  const [on, setOn] = useState(false);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    setOn(remindersEnabled());
    setBlocked(
      typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "denied",
    );
  }, []);

  const toggle = async (next: boolean) => {
    if (next) {
      const ok = await enableReminders();
      setOn(ok);
      if (!ok) {
        setBlocked(true);
        toast.error(
          "No se pudieron activar las notificaciones. Revisa los permisos del navegador.",
        );
      } else toast.success("Recordatorios activados");
    } else {
      disableReminders();
      setOn(false);
    }
  };

  return (
    <Panel
      title="Recordatorios de entregas"
      action={<StatusPill ok={on} label={on ? "Activados" : "Desactivados"} />}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 text-sm text-muted-foreground">
          <p className="text-foreground">Avísame de tareas y entregas que vencen hoy o mañana.</p>
          <p className="text-xs">
            Usa las notificaciones del navegador. Se muestran al abrir el panel, como máximo una vez
            al día por entrega.
          </p>
          {blocked && (
            <p className="text-xs text-destructive">
              Las notificaciones están bloqueadas en este navegador; habilítalas en los ajustes del
              sitio.
            </p>
          )}
        </div>
        <Switch checked={on} onCheckedChange={toggle} aria-label="Activar recordatorios" />
      </div>
    </Panel>
  );
}

function MoodleSettings() {
  const qc = useQueryClient();
  const statusFn = useServerFn(getMoodleStatus);
  const saveFn = useServerFn(saveMoodleSettings);
  const syncFn = useServerFn(syncMoodle);
  const importFn = useServerFn(importIcsFile);
  const status = useQuery({ queryKey: ["moodle", "status"], queryFn: () => statusFn() });
  const [url, setUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const after = (r: { imported: number; newSubjects?: number; skipped?: boolean }) => {
    toast.success(
      r.skipped
        ? "Sin cambios: el calendario ya estaba al día"
        : `${r.imported} eventos importados`,
    );
    qc.invalidateQueries({ queryKey: qk.events });
    qc.invalidateQueries({ queryKey: qk.subjects });
    qc.invalidateQueries({ queryKey: ["moodle", "status"] });
  };
  const onErr = (e: Error) => toast.error(e.message);

  const save = useMutation({
    mutationFn: (icsUrl: string | null) => saveFn({ data: { icsUrl } }),
    onSuccess: () => {
      setUrl("");
      toast.success("Guardado");
      qc.invalidateQueries({ queryKey: ["moodle", "status"] });
    },
    onError: onErr,
  });
  const sync = useMutation({
    mutationFn: () => syncFn({ data: { force: true } }),
    onSuccess: after,
    onError: onErr,
  });
  const imp = useMutation({
    mutationFn: (text: string) => importFn({ data: { text } }),
    onSuccess: after,
    onError: onErr,
  });

  return (
    <Panel
      title="Moodle (TecnoCampus)"
      action={
        status.data && (
          <StatusPill
            ok={status.data.icsConfigured}
            label={status.data.icsConfigured ? "Configurado" : "Sin configurar"}
          />
        )
      }
    >
      {status.isLoading ? (
        <Loading />
      ) : status.error ? (
        <ErrorBox error={status.error} />
      ) : (
        <div className="space-y-5">
          <div className="rounded-md bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
            <p className="font-medium text-foreground">
              Cómo obtener la URL privada del calendario
            </p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-4">
              <li>
                En Moodle abre <strong>Calendario</strong> →{" "}
                <strong>Importar o exportar calendarios</strong> →{" "}
                <strong>Exportar calendario</strong>.
              </li>
              <li>
                Elige «Todos los eventos» (o «Eventos relacionados con cursos») y un periodo amplio,
                por ejemplo «Próximos 60 días».
              </li>
              <li>
                Pulsa <strong>Obtener URL del calendario</strong> y pega aquí la dirección.
              </li>
            </ol>
            <p className="mt-1">
              La URL se guarda solo en el servidor y nunca se muestra en el navegador. No se pide ni
              se guarda tu contraseña.
            </p>
          </div>
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              if (url.trim()) save.mutate(url.trim());
            }}
          >
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="ics">URL de exportación iCal</Label>
              <Input
                id="ics"
                type="url"
                placeholder={
                  status.data?.icsConfigured
                    ? "•••••••• (guardada) — pega otra para reemplazarla"
                    : "https://…/calendar/export_execute.php?…"
                }
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <Button type="submit" className="sm:self-end" disabled={save.isPending || !url.trim()}>
              Guardar
            </Button>
          </form>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!status.data?.icsConfigured || sync.isPending}
              onClick={() => sync.mutate()}
            >
              {sync.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}{" "}
              Sincronizar ahora
            </Button>
            {status.data?.icsConfigured && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => save.mutate(null)}
              >
                Quitar URL
              </Button>
            )}
            <span className="text-xs text-muted-foreground">
              {status.data?.lastSync
                ? `Última sincronización ${formatDistanceToNow(new Date(status.data.lastSync), { addSuffix: true, locale: es })}`
                : "Nunca sincronizado"}
            </span>
          </div>
          <div className="border-t pt-4">
            <p className="text-sm font-medium">Importación manual</p>
            <p className="mb-2 text-xs text-muted-foreground">
              Si la exportación por URL no está disponible, descarga el archivo .ics desde Moodle y
              súbelo aquí.
            </p>
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
            <Button
              variant="outline"
              size="sm"
              disabled={imp.isPending}
              onClick={() => fileRef.current?.click()}
            >
              {imp.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}{" "}
              Subir archivo .ics
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            La API REST de Moodle requiere un token de servicio web que TecnoCampus debe habilitar;
            si lo obtienes, se puede añadir más adelante.
          </p>
        </div>
      )}
    </Panel>
  );
}

function GmailSettings() {
  const s = useGmailStatus();
  return (
    <Panel
      title="Gmail"
      action={
        s.data && (
          <StatusPill
            ok={s.data.connected}
            label={s.data.connected ? "Conectado" : "No conectado"}
          />
        )
      }
    >
      {s.isLoading ? (
        <Loading />
      ) : s.error ? (
        <ErrorBox error={s.error} />
      ) : s.data?.connected ? (
        <p className="text-sm">
          Conectado como <strong>{s.data.email}</strong> con acceso de solo lectura.
        </p>
      ) : (
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>Aún no hay ninguna cuenta de Google vinculada.</p>
          <p className="text-xs">
            Para conectar Gmail de forma directa y autónoma, añade tu clave o token de Google (
            <code>GOOGLE_ACCESS_TOKEN</code> o credenciales OAuth) en tu archivo <code>.env</code>.
          </p>
        </div>
      )}
    </Panel>
  );
}
