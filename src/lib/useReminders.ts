import { addDays, endOfDay, format, startOfDay } from "date-fns";
import { useEffect } from "react";
import { dueLabel } from "./data";
import { useAgenda } from "./useAgenda";

const ENABLED_KEY = "reminders";
const NOTIFIED_KEY = "reminders-notified";

function canNotify() {
  return typeof window !== "undefined" && "Notification" in window;
}

/** True only if the owner opted in AND the browser permission is granted. */
export function remindersEnabled(): boolean {
  if (!canNotify() || Notification.permission !== "granted") return false;
  try {
    return localStorage.getItem(ENABLED_KEY) === "on";
  } catch {
    return false;
  }
}

/** Opt in — requests permission if needed. Returns whether reminders are now active. */
export async function enableReminders(): Promise<boolean> {
  if (!canNotify()) return false;
  const perm =
    Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;
  if (perm !== "granted") return false;
  try {
    localStorage.setItem(ENABLED_KEY, "on");
  } catch {
    // ignore storage errors
  }
  return true;
}

export function disableReminders() {
  try {
    localStorage.setItem(ENABLED_KEY, "off");
  } catch {
    // ignore storage errors
  }
}

type Notified = { date: string; keys: string[] };

function readNotified(today: string): Notified {
  try {
    const raw = localStorage.getItem(NOTIFIED_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Notified;
      if (parsed.date === today) return parsed;
    }
  } catch {
    // ignore parse/storage errors
  }
  return { date: today, keys: [] };
}

/** Fires one browser notification per not-yet-notified item due today or tomorrow. */
export function useReminders() {
  const { items } = useAgenda();

  useEffect(() => {
    if (!remindersEnabled()) return;
    const limit = endOfDay(addDays(new Date(), 1));
    const todayStart = startOfDay(new Date());
    const due = items.filter((i) => !i.done && i.date >= todayStart && i.date <= limit);
    if (!due.length) return;

    const today = format(new Date(), "yyyy-MM-dd");
    const notified = readNotified(today);
    const fresh = due.filter((i) => !notified.keys.includes(i.key));
    if (!fresh.length) return;

    for (const i of fresh.slice(0, 5)) {
      try {
        new Notification(`${dueLabel(i.date).text}: ${i.title}`, {
          body: i.subject?.name ?? "Panel personal",
          tag: i.key,
        });
      } catch {
        // some browsers restrict the Notification constructor; ignore
      }
    }

    try {
      localStorage.setItem(
        NOTIFIED_KEY,
        JSON.stringify({ date: today, keys: [...notified.keys, ...fresh.map((i) => i.key)] }),
      );
    } catch {
      // ignore storage errors
    }
  }, [items]);
}
