// Daily reminders: Web Push (VAPID) and an optional email digest (Resend).
// Called by POST /api/cron/notify (shared secret) and by the "send test" server fn.
import { addDays, endOfDay, format, startOfDay } from "date-fns";
import { es } from "date-fns/locale";
import { buildAgenda, isActionable, type AgendaItem } from "./agenda";

export const pushConfigured = () =>
  !!process.env["VAPID_PUBLIC_KEY"] && !!process.env["VAPID_PRIVATE_KEY"];
export const emailConfigured = () => !!process.env["RESEND_API_KEY"] && !!process.env["DIGEST_FROM_EMAIL"];

async function webpush() {
  const wp = (await import("web-push")).default;
  wp.setVapidDetails(
    process.env["VAPID_SUBJECT"] || `mailto:${process.env["DIGEST_FROM_EMAIL"] || "admin@example.com"}`,
    process.env["VAPID_PUBLIC_KEY"]!,
    process.env["VAPID_PRIVATE_KEY"]!,
  );
  return wp;
}

/** Actionable items due today or tomorrow for one user. */
export async function dueSoon(userId: string, now = new Date()): Promise<AgendaItem[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const from = startOfDay(now);
  const to = endOfDay(addDays(now, 1));
  const [tasks, events, subjects] = await Promise.all([
    supabaseAdmin.from("tasks").select("*").eq("user_id", userId).neq("status", "done")
      .gte("due_date", format(from, "yyyy-MM-dd")).lte("due_date", format(to, "yyyy-MM-dd")),
    supabaseAdmin.from("calendar_events").select("*").eq("user_id", userId)
      .gte("starts_at", from.toISOString()).lte("starts_at", to.toISOString()),
    supabaseAdmin.from("subjects").select("*").eq("user_id", userId),
  ]);
  return buildAgenda(tasks.data ?? [], events.data ?? [], subjects.data ?? []).filter(
    (i) => isActionable(i) && !i.done && i.date >= from && i.date <= to,
  );
}

export async function sendPush(userId: string, payload: { title: string; body: string; url?: string; tag?: string }) {
  if (!pushConfigured()) return 0;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: subs } = await supabaseAdmin.from("push_subscriptions").select("*").eq("user_id", userId);
  if (!subs?.length) return 0;
  const wp = await webpush();
  let sent = 0;
  for (const s of subs) {
    try {
      await wp.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 6 * 3600 });
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      // the browser dropped the subscription
      if (status === 404 || status === 410) await supabaseAdmin.from("push_subscriptions").delete().eq("id", s.id);
      else console.error("[push]", status, (e as Error).message);
    }
  }
  return sent;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function digestHtml(name: string, items: AgendaItem[], appUrl: string): string {
  const rows = items
    .map((i) => `<li style="margin:6px 0"><strong>${esc(i.title)}</strong><br><span style="color:#666">${esc(i.subject?.name ?? "Personal")} · ${format(i.date, i.allDay ? "EEEE d MMM" : "EEEE d MMM, HH:mm", { locale: es })}</span></li>`)
    .join("");
  return `<div style="font-family:system-ui,sans-serif;max-width:520px">
<p>Hola${name ? ` ${esc(name)}` : ""}, esto es lo que vence hoy y mañana:</p>
<ul style="padding-left:18px">${rows}</ul>
<p><a href="${esc(appUrl)}/inicio">Abrir Brújula</a></p>
<p style="color:#999;font-size:12px">Puedes desactivar este resumen en Ajustes.</p></div>`;
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env["RESEND_API_KEY"]}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env["DIGEST_FROM_EMAIL"], to: [to], subject, html }),
  });
  if (!res.ok) throw new Error(`Resend [${res.status}]: ${await res.text()}`);
}

/** Push + email digest for one user. Returns what was sent. */
export async function notifyUser(userId: string, opts: { email: boolean }) {
  const items = await dueSoon(userId);
  if (!items.length) return { items: 0, push: 0, email: false };
  const today = items.filter((i) => differenceIsToday(i.date));
  const title = today.length ? `${today.length} para hoy · ${items.length - today.length} mañana` : `${items.length} para mañana`;
  const push = await sendPush(userId, {
    title,
    body: items.slice(0, 4).map((i) => i.title).join(" · "),
    url: "/inicio",
    tag: "digest-" + format(new Date(), "yyyy-MM-dd"),
  });
  let email = false;
  if (opts.email && emailConfigured()) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: user }, { data: profile }] = await Promise.all([
      supabaseAdmin.auth.admin.getUserById(userId),
      supabaseAdmin.from("profiles").select("display_name").eq("user_id", userId).maybeSingle(),
    ]);
    const to = user.user?.email;
    if (to) {
      const appUrl = process.env["APP_URL"]?.replace(/\/+$/, "") ?? "";
      await sendEmail(to, `Brújula: ${title}`, digestHtml(profile?.display_name ?? "", items, appUrl));
      email = true;
    }
  }
  return { items: items.length, push, email };
}

function differenceIsToday(d: Date) {
  return format(d, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
}

/** Every user that opted into push or email. */
export async function listNotifiableUsers(): Promise<{ userId: string; email: boolean }[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [{ data: subs }, { data: digest }] = await Promise.all([
    supabaseAdmin.from("push_subscriptions").select("user_id"),
    supabaseAdmin.from("profiles").select("user_id").eq("digest_email", true),
  ]);
  const map = new Map<string, boolean>();
  for (const s of subs ?? []) map.set(s.user_id, map.get(s.user_id) ?? false);
  for (const d of digest ?? []) map.set(d.user_id, true);
  return [...map].map(([userId, email]) => ({ userId, email }));
}
