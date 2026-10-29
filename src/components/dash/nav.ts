import {
  BookOpen,
  CalendarDays,
  CheckSquare,
  Clock,
  GraduationCap,
  Home,
  Mail,
  Settings,
  Timer,
  Users,
  Wallet,
} from "lucide-react";

export const NAV_GROUPS = [
  {
    label: "Organización",
    items: [
      { to: "/inicio", label: "Inicio", icon: Home },
      { to: "/calendario", label: "Calendario", icon: CalendarDays },
      { to: "/tareas", label: "Tareas", icon: CheckSquare },
    ],
  },
  {
    label: "Estudios",
    items: [
      { to: "/universidad", label: "Asignaturas", icon: BookOpen },
      { to: "/calificaciones", label: "Calificaciones", icon: GraduationCap },
      { to: "/horario", label: "Horario", icon: Clock },
      { to: "/estudio", label: "Estudio", icon: Timer },
      { to: "/grupos", label: "Grupos", icon: Users },
    ],
  },
  {
    label: "Personal",
    items: [
      { to: "/finanzas", label: "Finanzas", icon: Wallet },
      { to: "/gmail", label: "Correo", icon: Mail },
      { to: "/ajustes", label: "Ajustes", icon: Settings },
    ],
  },
] as const;

export type NavItem = (typeof NAV_GROUPS)[number]["items"][number];
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g): NavItem[] => [...g.items]);
