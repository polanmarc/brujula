import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bell, CalendarPlus, Check, Compass, Loader2, Mail, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addCalendarSource } from "@/lib/calendar.functions";
import { PALETTE } from "@/lib/palette";
import { qk, useProfile, useProfileMutation, useSubjectMutations, useSubjects } from "@/lib/data";
import { googleConnectUrl } from "@/lib/gmail.functions";
import { getNotifyConfig } from "@/lib/notify.functions";
import { useGmailStatus } from "@/lib/useAgenda";
import { enableReminders } from "@/lib/useReminders";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/bienvenida")({
  head: () => ({ meta: [{ title: "Bienvenida · Brújula" }] }),
  component: Onboarding,
});

const STEPS = ["Tu perfil", "Tus asignaturas", "Conexiones"];

function Onboarding() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const { data: profile, isLoading } = useProfile();
  const update = useProfileMutation();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ display_name: "", university: "", degree: "" });

  useEffect(() => {
    if (isLoading) return;
    setForm({
      display_name: profile?.display_name || user.email?.split("@")[0] || "",
      university: profile?.university ?? "",
      degree: profile?.degree ?? "",
    });
  }, [isLoading, profile, user.email]);

  const finish = () =>
    update.mutate({ ...form, onboarded: true }, { onSuccess: () => navigate({ to: "/inicio", replace: true }) });

  return (
    <div className="flex min-h-screen items-start justify-center bg-background px-4 py-10">
      <div className="w-full max-w-lg animate-in-up">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground"><Compass className="h-4 w-4" /></div>
          <span className="font-semibold">Brújula</span>
          <button className="ml-auto text-xs text-muted-foreground hover:text-foreground" onClick={finish}>Saltar</button>
        </div>
        <ol className="mb-6 flex gap-2">
          {STEPS.map((s, i) => (
            <li key={s} className="flex-1">
              <div className={cn("h-1 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
              <p className={cn("mt-1 text-xs", i === step ? "font-medium" : "text-muted-foreground")}>{s}</p>
            </li>
          ))}
        </ol>
        <div className="rounded-lg border bg-card p-6">
          {step === 0 && (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); update.mutate(form, { onSuccess: () => setStep(1) }); }}>
              <div>
                <h1 className="text-lg font-semibold">¡Bienvenido/a!</h1>
                <p className="text-sm text-muted-foreground">Tres pasos rápidos para dejar tu panel listo.</p>
              </div>
              <div className="space-y-1.5"><Label htmlFor="o-name">¿Cómo te llamas?</Label><Input id="o-name" required maxLength={60} value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="o-uni">Centro de estudios <span className="text-muted-foreground">(opcional)</span></Label><Input id="o-uni" maxLength={120} placeholder="Universidad, instituto, academia…" value={form.university} onChange={(e) => setForm({ ...form, university: e.target.value })} /></div>
              <div className="space-y-1.5"><Label htmlFor="o-deg">Estudios <span className="text-muted-foreground">(opcional)</span></Label><Input id="o-deg" maxLength={120} placeholder="Grado, ciclo, curso…" value={form.degree} onChange={(e) => setForm({ ...form, degree: e.target.value })} /></div>
              <Button type="submit" className="w-full" disabled={update.isPending}>Continuar</Button>
            </form>
          )}
          {step === 1 && <SubjectsStep onNext={() => setStep(2)} />}
          {step === 2 && <ConnectStep onFinish={finish} busy={update.isPending} />}
        </div>
      </div>
    </div>
  );
}

function SubjectsStep({ onNext }: { onNext: () => void }) {
  const qc = useQueryClient();
  const { data: subjects = [] } = useSubjects();
  const { save, remove } = useSubjectMutations();
  const addSource = useServerFn(addCalendarSource);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const connect = async () => {
    setBusy(true);
    try {
      const r = await addSource({ data: { name: "Campus virtual", kind: "deadlines", icsUrl: url } });
      if ("error" in r && r.error) toast.error(r.error);
      else toast.success(`${r.imported} eventos importados${r.newSubjects ? `, ${r.newSubjects} asignaturas creadas` : ""}`);
      setUrl("");
      [qk.subjects, qk.events, qk.sources].forEach((k) => qc.invalidateQueries({ queryKey: k }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Tus asignaturas</h2>
        <p className="text-sm text-muted-foreground">Conecta el calendario de tu campus virtual (Moodle, Canvas, Classroom, Blackboard…) o añádelas a mano.</p>
      </div>
      <div className="space-y-2 rounded-md bg-muted/50 p-3">
        <Label htmlFor="o-ics" className="flex items-center gap-1.5"><CalendarPlus className="h-4 w-4" /> URL del calendario (iCal)</Label>
        <div className="flex gap-2">
          <Input id="o-ics" type="url" placeholder="https://…/export_execute.php?… o webcal://…" value={url} onChange={(e) => setUrl(e.target.value)} />
          <Button variant="outline" disabled={busy || !url.trim()} onClick={connect}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Conectar"}</Button>
        </div>
        <p className="text-xs text-muted-foreground">En Moodle: Calendario → Exportar calendario → Obtener URL. Las asignaturas se crean solas.</p>
      </div>
      <div className="space-y-2">
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) save.mutate({ name: name.trim(), color: PALETTE[subjects.length % PALETTE.length]! }, { onSuccess: () => setName("") }); }}>
          <Input placeholder="Añadir asignatura a mano" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" variant="outline" aria-label="Añadir"><Plus className="h-4 w-4" /></Button>
        </form>
        <div className="flex flex-wrap gap-1.5">
          {subjects.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />{s.name}
              <button onClick={() => remove.mutate(s.id)} aria-label={`Quitar ${s.name}`}><X className="h-3 w-3 text-muted-foreground" /></button>
            </span>
          ))}
        </div>
      </div>
      <Button className="w-full" onClick={onNext}>Continuar</Button>
    </div>
  );
}

function ConnectStep({ onFinish, busy }: { onFinish: () => void; busy: boolean }) {
  const gmail = useGmailStatus();
  const connectFn = useServerFn(googleConnectUrl);
  const configFn = useServerFn(getNotifyConfig);
  const [notif, setNotif] = useState(false);
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Conexiones opcionales</h2>
        <p className="text-sm text-muted-foreground">Puedes cambiarlas cuando quieras desde Ajustes.</p>
      </div>
      <div className="flex items-center gap-3 rounded-md border p-3">
        <Mail className="h-5 w-5 text-muted-foreground" />
        <div className="flex-1 text-sm"><p className="font-medium">Correo de Gmail</p><p className="text-xs text-muted-foreground">Solo lectura. Resume correos y detecta fechas.</p></div>
        {gmail.data?.connected ? <Check className="h-5 w-5 text-success" /> : (
          <Button size="sm" variant="outline" disabled={!gmail.data?.available}
            onClick={async () => { try { window.location.href = (await connectFn()).url; } catch (e) { toast.error((e as Error).message); } }}>
            {gmail.data?.available === false ? "No disponible" : "Conectar"}
          </Button>
        )}
      </div>
      <div className="flex items-center gap-3 rounded-md border p-3">
        <Bell className="h-5 w-5 text-muted-foreground" />
        <div className="flex-1 text-sm"><p className="font-medium">Recordatorios</p><p className="text-xs text-muted-foreground">Avisos de lo que vence hoy y mañana.</p></div>
        {notif ? <Check className="h-5 w-5 text-success" /> : (
          <Button size="sm" variant="outline" onClick={async () => {
            try {
              const cfg = await configFn();
              const r = await enableReminders(cfg.vapidPublicKey);
              setNotif(r.ok);
              if (!r.ok) toast.error("Permiso de notificaciones denegado");
            } catch (e) {
              toast.error((e as Error).message);
            }
          }}>Activar</Button>
        )}
      </div>
      <Button className="w-full" onClick={onFinish} disabled={busy}>Empezar a usar Brújula</Button>
    </div>
  );
}
