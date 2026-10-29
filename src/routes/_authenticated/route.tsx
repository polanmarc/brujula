import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarDays,
  CheckSquare,
  Compass,
  Home,
  LogOut,
  Menu,
  Moon,
  Search,
  Sun,
  Timer,
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { CommandPalette } from "@/components/dash/CommandPalette";
import { NAV_GROUPS } from "@/components/dash/nav";
import { useReminders } from "@/lib/useReminders";
import { qk, useProfile } from "@/lib/data";
import { syncCalendars } from "@/lib/calendar.functions";
import { clock, TimerProvider, useTimer } from "@/lib/useTimer";
import { cn } from "@/lib/utils";

const openCommandPalette = () => window.dispatchEvent(new Event("open-command-palette"));

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AppLayout,
});

const MOBILE_TABS = [
  { to: "/inicio", label: "Inicio", icon: Home },
  { to: "/calendario", label: "Agenda", icon: CalendarDays },
  { to: "/tareas", label: "Tareas", icon: CheckSquare },
  { to: "/estudio", label: "Estudio", icon: Timer },
] as const;

function useTheme() {
  // the root shell applies the class before paint, so reading it here never flickers
  const [dark, setDark] = useState(() => typeof document !== "undefined" && document.documentElement.classList.contains("dark"));
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      // ignore storage errors
    }
    setDark(next);
  };
  return { dark, toggle };
}

function TimerChip() {
  const { state, seconds } = useTimer();
  if (state.phase === "idle") return null;
  return (
    <Link
      to="/estudio"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium tabular-nums",
        state.phase === "break" ? "bg-success/15 text-success" : "bg-primary/10 text-primary",
      )}
    >
      <Timer className="h-3.5 w-3.5" />
      {state.phase === "break" ? "Descanso" : "Estudio"} {clock(seconds)}
    </Link>
  );
}

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { user } = Route.useRouteContext();
  const { data: profile } = useProfile();
  const { dark, toggle } = useTheme();
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Compass className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold">Brújula</span>
        <span className="ml-auto"><TimerChip /></span>
      </div>
      <div className="px-2 pb-2">
        <button
          onClick={() => {
            onNavigate?.();
            openCommandPalette();
          }}
          className="flex w-full items-center gap-2 rounded-md border border-sidebar-border bg-sidebar px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/60"
        >
          <Search className="h-4 w-4" /> Buscar
          <kbd className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">⌘K</kbd>
        </button>
      </div>
      <nav className="flex-1 space-y-3 overflow-y-auto px-2 pb-2">
        {NAV_GROUPS.map((g) => (
          <div key={g.label}>
            <p className="px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/80">{g.label}</p>
            <div className="space-y-0.5">
              {g.items.map(({ to, label, icon: Icon }) => (
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
            </div>
          </div>
        ))}
      </nav>
      <div className="space-y-1 border-t border-sidebar-border p-2">
        <p className="truncate px-2.5 py-1 text-xs text-muted-foreground">{profile?.display_name || user.email}</p>
        <button
          onClick={toggle}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent/60"
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {dark ? "Modo claro" : "Modo oscuro"}
        </button>
        <button
          onClick={() => supabase.auth.signOut()}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-sidebar-foreground hover:bg-sidebar-accent/60"
        >
          <LogOut className="h-4 w-4" /> Cerrar sesión
        </button>
      </div>
    </div>
  );
}

function BottomNav({ onMore }: { onMore: () => void }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {MOBILE_TABS.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          className={cn(
            "flex flex-col items-center gap-0.5 py-2 text-[11px]",
            path.startsWith(to) ? "font-medium text-primary" : "text-muted-foreground",
          )}
        >
          <Icon className="h-5 w-5" />
          {label}
        </Link>
      ))}
      <button onClick={onMore} className="flex flex-col items-center gap-0.5 py-2 text-[11px] text-muted-foreground">
        <Menu className="h-5 w-5" />
        Más
      </button>
    </nav>
  );
}

function useCalendarAutoSync() {
  const qc = useQueryClient();
  const syncFn = useServerFn(syncCalendars);

  useEffect(() => {
    let cancelled = false;
    // Throttled per source on the server (SYNC_THROTTLE_MS); cheap to call on every load.
    syncFn({ data: {} })
      .then((res) => {
        if (cancelled) return;
        if (res.synced) {
          qc.invalidateQueries({ queryKey: qk.events });
          qc.invalidateQueries({ queryKey: qk.subjects });
          qc.invalidateQueries({ queryKey: qk.sources });
        }
      })
      .catch((err) => {
        console.debug("[Calendar AutoSync]", err?.message || err);
      });

    return () => {
      cancelled = true;
    };
  }, [syncFn, qc]);
}

/** New accounts go through /bienvenida once. */
function useOnboardingGate(path: string) {
  const navigate = useNavigate();
  const profile = useProfile();
  useEffect(() => {
    if (profile.isLoading || profile.error) return;
    if (!profile.data?.onboarded && path !== "/bienvenida") navigate({ to: "/bienvenida", replace: true });
  }, [profile.isLoading, profile.error, profile.data, path, navigate]);
}

function AppLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  useOnboardingGate(path);
  if (path === "/bienvenida") return <Outlet />;
  return (
    <TimerProvider>
      <AppShell />
    </TimerProvider>
  );
}

function AppShell() {
  const [open, setOpen] = useState(false);
  useCalendarAutoSync();
  useReminders();

  return (
    <div className="flex min-h-screen bg-background">
      <CommandPalette />
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 border-r border-sidebar-border bg-sidebar md:block">
        <Nav />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur md:hidden">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Compass className="h-3.5 w-3.5" />
          </div>
          <span className="text-sm font-semibold">Brújula</span>
          <span className="ml-auto"><TimerChip /></span>
          <Button variant="ghost" size="icon" aria-label="Buscar" onClick={openCommandPalette}>
            <Search className="h-4 w-4" />
          </Button>
        </header>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="w-64 bg-sidebar p-0">
            <SheetTitle className="sr-only">Menú</SheetTitle>
            <Nav onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 md:px-8 md:py-8">
          <Outlet />
        </main>
        <BottomNav onMore={() => setOpen(true)} />
      </div>
    </div>
  );
}
