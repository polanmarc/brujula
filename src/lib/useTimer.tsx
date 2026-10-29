import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { qk } from "./data";

// Pomodoro / stopwatch shared by the whole app, persisted so a reload doesn't lose it.
export type TimerState = {
  mode: "pomodoro" | "free";
  phase: "idle" | "focus" | "break";
  subjectId: string | null;
  focusMin: number;
  breakMin: number;
  /** epoch ms when the current phase started */
  startedAt: number | null;
  /** completed focus blocks in this run (long break every 4) */
  cycles: number;
};

const KEY = "study-timer";
const DEFAULT: TimerState = { mode: "pomodoro", phase: "idle", subjectId: null, focusMin: 25, breakMin: 5, startedAt: null, cycles: 0 };

type Ctx = {
  state: TimerState;
  /** seconds elapsed (free) or remaining (pomodoro) in the current phase */
  seconds: number;
  configure: (patch: Partial<Pick<TimerState, "mode" | "subjectId" | "focusMin" | "breakMin">>) => void;
  start: () => void;
  stop: (save?: boolean) => void;
  skip: () => void;
};

const TimerContext = createContext<Ctx | null>(null);

function load(): TimerState {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT, ...(JSON.parse(raw) as TimerState) } : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

function notify(title: string, body: string) {
  toast(title, { description: body });
  try {
    if ("Notification" in window && Notification.permission === "granted") new Notification(title, { body, icon: "/icon.svg" });
  } catch {
    // notifications from the page are optional
  }
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [state, setState] = useState<TimerState>(DEFAULT);
  const [now, setNow] = useState(Date.now());
  const saving = useRef(false);

  useEffect(() => setState(load()), []);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // ignore storage errors
    }
  }, [state]);
  useEffect(() => {
    if (state.phase === "idle") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state.phase]);

  const save = useCallback(
    async (startedAt: number, minutes: number, mode: TimerState["mode"], subjectId: string | null) => {
      if (minutes < 1 || saving.current) return;
      saving.current = true;
      try {
        const { error } = await supabase.from("study_sessions").insert({
          started_at: new Date(startedAt).toISOString(),
          minutes: Math.min(600, Math.round(minutes)),
          kind: mode,
          subject_id: subjectId,
        });
        if (error) throw new Error(error.message);
        qc.invalidateQueries({ queryKey: qk.study });
      } catch (e) {
        toast.error(`No se pudo guardar la sesión: ${(e as Error).message}`);
      } finally {
        saving.current = false;
      }
    },
    [qc],
  );

  const elapsed = state.startedAt ? Math.max(0, Math.floor((now - state.startedAt) / 1000)) : 0;
  const phaseLen = (state.phase === "break" ? (state.cycles % 4 === 0 ? state.breakMin * 3 : state.breakMin) : state.focusMin) * 60;
  const seconds = state.mode === "free" ? elapsed : Math.max(0, phaseLen - elapsed);

  // phase transitions for pomodoro
  useEffect(() => {
    if (state.mode !== "pomodoro" || state.phase === "idle" || !state.startedAt) return;
    if (elapsed < phaseLen) return;
    if (state.phase === "focus") {
      void save(state.startedAt, state.focusMin, "pomodoro", state.subjectId);
      const cycles = state.cycles + 1;
      notify("¡Bloque completado!", cycles % 4 === 0 ? "Tómate un descanso largo." : "Toca un descanso corto.");
      setState((s) => ({ ...s, phase: "break", startedAt: Date.now(), cycles }));
    } else {
      notify("Fin del descanso", "Vuelta al estudio.");
      setState((s) => ({ ...s, phase: "focus", startedAt: Date.now() }));
    }
  }, [elapsed, phaseLen, state, save]);

  const value: Ctx = {
    state,
    seconds,
    configure: (patch) => setState((s) => ({ ...s, ...patch })),
    start: () => setState((s) => ({ ...s, phase: "focus", startedAt: Date.now(), cycles: 0 })),
    stop: (keep = true) => {
      // a pomodoro focus block cut short or a stopwatch still counts the minutes studied
      if (keep && state.phase === "focus" && state.startedAt) void save(state.startedAt, elapsed / 60, state.mode, state.subjectId);
      setState((s) => ({ ...s, phase: "idle", startedAt: null, cycles: 0 }));
    },
    skip: () => {
      if (state.phase === "focus" && state.startedAt) void save(state.startedAt, elapsed / 60, state.mode, state.subjectId);
      setState((s) => ({
        ...s,
        phase: s.phase === "focus" ? "break" : "focus",
        startedAt: Date.now(),
        cycles: s.phase === "focus" ? s.cycles + 1 : s.cycles,
      }));
    },
  };
  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}

export function useTimer() {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error("useTimer fuera de TimerProvider");
  return ctx;
}

export const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
