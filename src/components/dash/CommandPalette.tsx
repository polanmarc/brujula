import { useNavigate } from "@tanstack/react-router";
import {
  BookOpen,
  CalendarDays,
  CheckSquare,
  Home,
  Link2,
  Mail,
  Moon,
  Plus,
  Settings,
  Sun,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useLinks } from "@/lib/data";

const NAV = [
  { to: "/inicio", label: "Inicio", icon: Home },
  { to: "/calendario", label: "Calendario", icon: CalendarDays },
  { to: "/tareas", label: "Tareas", icon: CheckSquare },
  { to: "/universidad", label: "Universidad", icon: BookOpen },
  { to: "/gmail", label: "Gmail", icon: Mail },
  { to: "/ajustes", label: "Ajustes", icon: Settings },
] as const;

function toggleTheme() {
  const next = !document.documentElement.classList.contains("dark");
  document.documentElement.classList.toggle("dark", next);
  try {
    localStorage.setItem("theme", next ? "dark" : "light");
  } catch {
    // ignore storage errors (private mode, blocked cookies)
  }
}

/** ⌘K / Ctrl+K command palette: jump between sections, open links, toggle theme. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { data: links = [] } = useLinks();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("open-command-palette", onOpen);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command-palette", onOpen);
    };
  }, []);

  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Escribe un comando o busca…" />
      <CommandList>
        <CommandEmpty>Sin resultados.</CommandEmpty>
        <CommandGroup heading="Acciones">
          <CommandItem
            onSelect={() => run(() => navigate({ to: "/tareas", search: { new: true } }))}
          >
            <Plus /> Nueva tarea
          </CommandItem>
          <CommandItem onSelect={() => run(toggleTheme)}>
            <Moon className="dark:hidden" />
            <Sun className="hidden dark:block" />
            Cambiar tema
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Ir a">
          {NAV.map(({ to, label, icon: Icon }) => (
            <CommandItem key={to} onSelect={() => run(() => navigate({ to }))}>
              <Icon /> {label}
            </CommandItem>
          ))}
        </CommandGroup>
        {links.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Enlaces rápidos">
              {links.map((l) => (
                <CommandItem
                  key={l.id}
                  value={`enlace ${l.label}`}
                  onSelect={() => run(() => window.open(l.url, "_blank", "noreferrer"))}
                >
                  <Link2 /> {l.label}
                  <CommandShortcut>↗</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
