import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Compass, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Acceso · Brújula" },
      { name: "description", content: "Tu panel de estudiante: tareas, entregas, horario y notas." },
      { property: "og:title", content: "Acceso · Brújula" },
      { property: "og:description", content: "Tu panel de estudiante: tareas, entregas, horario y notas." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user) navigate({ to: "/inicio" }); });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/inicio" });
      } else {
        const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
        if (error) throw error;
        setSent(true);
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/inicio` } });
    if (error) {
      toast.error(error.message);
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm animate-in-up">
        <div className="mb-8 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Compass className="h-4 w-4" />
          </div>
          <span className="font-semibold">Brújula</span>
        </div>
        {sent ? (
          <div className="rounded-lg border bg-card p-6">
            <h1 className="text-lg font-semibold">Revisa tu correo</h1>
            <p className="mt-2 text-sm text-muted-foreground">Te hemos enviado un enlace para confirmar la cuenta. Después vuelve aquí e inicia sesión.</p>
            <Button variant="outline" className="mt-4 w-full" onClick={() => { setSent(false); setMode("in"); }}>Volver</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 rounded-lg border bg-card p-6">
            <div>
              <h1 className="text-lg font-semibold">{mode === "in" ? "Iniciar sesión" : "Crear cuenta"}</h1>
              <p className="mt-1 text-sm text-muted-foreground">Organiza tus estudios: entregas, exámenes, horario, notas y horas de estudio.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Correo</Label>
              <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" type="password" required minLength={8} autoComplete={mode === "in" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "in" ? "Entrar" : "Crear cuenta"}
            </Button>
            <div className="relative py-1 text-center text-xs text-muted-foreground">
              <span className="relative z-10 bg-card px-2">o</span>
              <span className="absolute inset-x-0 top-1/2 border-t" />
            </div>
            <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={google}>
              Continuar con Google
            </Button>
            <button type="button" className="w-full text-center text-xs text-muted-foreground hover:text-foreground" onClick={() => setMode(mode === "in" ? "up" : "in")}>
              {mode === "in" ? "¿Primera vez? Crear cuenta" : "Ya tengo cuenta"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
