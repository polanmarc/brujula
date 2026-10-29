import { addDays, endOfDay, format, startOfDay } from "date-fns";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { dueLabel, isActionable } from "./data";
import { useAgenda } from "./useAgenda";

const ENABLED_KEY = "reminders";
const NOTIFIED_KEY = "reminders-notified";

function canNotify() {
  return typeof window !== "undefined" && "Notification" in window;
}

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;

/** True only if the user opted in AND the browser permission is granted. */
export function remindersEnabled(): boolean {
  if (!canNotify() || Notification.permission !== "granted") return false;
  try {
    return localStorage.getItem(ENABLED_KEY) === "on";
  } catch {
    return false;
  }
}

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** Subscribe this device to Web Push and store the subscription for the cron job. */
async function subscribePush(vapidPublicKey: string) {
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(vapidPublicKey) }));
  const json = sub.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert(
    { endpoint: sub.endpoint, p256dh: json.keys?.["p256dh"] ?? "", auth: json.keys?.["auth"] ?? "" },
    { onConflict: "endpoint" },
  );
  if (error) throw new Error(error.message);
}

async function unsubscribePush() {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  }
}

/** Opt in — requests permission and, when the server supports it, subscribes to push. */
export async function enableReminders(vapidPublicKey: string | null): Promise<{ ok: boolean; push: boolean }> {
  if (!canNotify()) return { ok: false, push: false };
  const perm =
    Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;
  if (perm !== "granted") return { ok: false, push: false };
  try {
    localStorage.setItem(ENABLED_KEY, "on");
  } catch {
    // ignore storage errors
  }
  let push = false;
  if (vapidPublicKey && pushSupported()) {
    await subscribePush(vapidPublicKey);
    push = true;
  }
  return { ok: true, push };
}

export async function disableReminders() {
  try {
    localStorage.setItem(ENABLED_KEY, "off");
  } catch {
    // ignore storage errors
  }
  await unsubscribePush();
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

/** In-app fallback: one browser notification per not-yet-notified item due today or tomorrow. */
export function useReminders() {
  const { items } = useAgenda();

  useEffect(() => {
    if (!remindersEnabled()) return;
    const limit = endOfDay(addDays(new Date(), 1));
    const todayStart = startOfDay(new Date());
    const due = items.filter((i) => isActionable(i) && !i.done && i.date >= todayStart && i.date <= limit);
    if (!due.length) return;

    const today = format(new Date(), "yyyy-MM-dd");
    const notified = readNotified(today);
    const fresh = due.filter((i) => !notified.keys.includes(i.key));
    if (!fresh.length) return;

    for (const i of fresh.slice(0, 5)) {
      try {
        new Notification(`${dueLabel(i.date).text}: ${i.title}`, {
          body: i.subject?.name ?? "Brújula",
          tag: i.key,
          icon: "/icon.svg",
        });
      } catch {
        // some browsers (Android) only allow notifications from the service worker; push covers them
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
