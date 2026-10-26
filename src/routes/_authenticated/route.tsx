import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { BookOpen, CalendarDays, CheckSquare, Home, LayoutDashboard, LogOut, Mail, Menu, Moon, Settings, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { qk } from "@/lib/data";
import { syncMoodle } from "@/lib/moodle.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AppLayout,
});

const NAV = [
  { to: "/inicio", label: "Inicio", icon: Home },
  { to: "/calendario", label: "Calendario", icon: CalendarDays },
  { to: "/tareas", label: "Tareas", icon: CheckSquare },
  { to: "/universidad", label: "Universidad", icon: BookOpen },
  { to: "/gmail", label: "Gmail", icon: Mail },
  { to: "/ajustes", label: "Ajustes", icon: Settings },
] as const;

function useTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    setDark(next);
  };
  return { dark, toggle };
}

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user } = Route.useRouteContext();
  const { dark, toggle } = useTheme();
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <LayoutDashboard className="h-3.5 w-3.5" />
        </div>
        <span className="text-sm font-semibold">Panel personal</span>
      </div>
      <nav className="flex-1 space-y-0.5 px-2">
        {NAV.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
              path.startsWith(to)
                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/60",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="space-y-1 border-t border-sidebar-border p-2">
        <p className="truncate px-2.5 py-1 text-xs text-muted-foreground">{user.email}</p>
        <button onClick={toggle} className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent/60">
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {dark ? "Modo claro" : "Modo oscuro"}
        </button>
        <button onClick={() => supabase.auth.signOut()} className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent/60">
          <LogOut className="h-4 w-4" /> Cerrar sesión
        </button>
      </div>
    </div>
  );
}

function useMoodleAutoSync() {
  const qc = useQueryClient();
  const syncFn = useServerFn(syncMoodle);

  useEffect(() => {
    let cancelled = false;
    syncFn()
      .then((res) => {
        if (cancelled) return;
        if (res && !("skipped" in res)) {
          qc.invalidateQueries({ queryKey: qk.events });
          qc.invalidateQueries({ queryKey: qk.subjects });
          qc.invalidateQueries({ queryKey: ["moodle", "status"] });
        }
      })
      .catch((err) => {
        console.debug("[Moodle AutoSync]", err?.message || err);
      });

    return () => {
      cancelled = true;
    };
  }, [syncFn, qc]);
}

function AppLayout() {
  const [open, setOpen] = useState(false);
  useMoodleAutoSync();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 border-r border-sidebar-border bg-sidebar md:block">
        <Nav />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b px-4 py-2 md:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Menú"><Menu className="h-4 w-4" /></Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-60 bg-sidebar p-0">
              <Nav onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <span className="text-sm font-semibold">Panel personal</span>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
