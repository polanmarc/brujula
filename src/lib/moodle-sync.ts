// Core Moodle ICS sync, usable from both server functions (owner, RLS-checked)
// and the cron route (shared-secret). Everything here runs with the admin client
// and takes an explicit user_id, so it never depends on auth.uid().
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { parseIcs, type IcsEvent } from "@/lib/ics";

export type AdminClient = SupabaseClient<Database>;

const PALETTE = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
];

// Skip a sync if the last one finished less than this ago (unless forced).
export const SYNC_THROTTLE_MS = 30 * 60 * 1000;

/** Whether a sync should be skipped because a recent one is still within the throttle window. */
export function isThrottled(lastSync: string | null | undefined, now = Date.now()): boolean {
  if (!lastSync) return false;
  return now - new Date(lastSync).getTime() < SYNC_THROTTLE_MS;
}

export type SyncResult =
  | { imported: number; newSubjects: number; skipped: false }
  | { imported: 0; newSubjects: 0; skipped: true; reason: "not_configured" | "throttled" };

async function storeEvents(admin: AdminClient, userId: string, events: IcsEvent[], source: string) {
  if (events.length) {
    const rows = events.map((e) => ({
      ...e,
      user_id: userId,
      source,
      updated_at: new Date().toISOString(),
    }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await admin
        .from("calendar_events")
        .upsert(rows.slice(i, i + 500), { onConflict: "user_id,uid" });
      if (error) throw new Error(error.message);
    }
  }
  // auto-create subjects for new courses (admin bypasses RLS, so scope by user_id)
  const courses = [...new Set(events.map((e) => e.course).filter(Boolean))] as string[];
  let newSubjects = 0;
  if (courses.length) {
    const { data: existing } = await admin.from("subjects").select("name").eq("user_id", userId);
    const have = new Set((existing ?? []).map((s) => s.name));
    const missing = courses.filter((c) => !have.has(c));
    if (missing.length) {
      const offset = have.size;
      const rows = missing.map((name, i) => ({
        name,
        user_id: userId,
        color: PALETTE[(offset + i) % PALETTE.length]!,
      }));
      const { error } = await admin.from("subjects").insert(rows);
      if (error) throw new Error(error.message);
      newSubjects = missing.length;
    }
  }
  return { imported: events.length, newSubjects };
}

/** Download the stored ICS URL for a user and upsert its events. Honors the throttle. */
export async function runMoodleSync(
  userId: string,
  opts: { force?: boolean } = {},
): Promise<SyncResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: s } = await supabaseAdmin
    .from("user_settings")
    .select("moodle_ics_url, last_moodle_sync")
    .eq("user_id", userId)
    .maybeSingle();

  if (!s?.moodle_ics_url)
    return { imported: 0, newSubjects: 0, skipped: true, reason: "not_configured" };
  if (!opts.force && isThrottled(s.last_moodle_sync)) {
    return { imported: 0, newSubjects: 0, skipped: true, reason: "throttled" };
  }

  const res = await fetch(s.moodle_ics_url, { headers: { Accept: "text/calendar" } });
  if (!res.ok)
    throw new Error(
      `Moodle respondió ${res.status}. Revisa que la URL de exportación siga siendo válida.`,
    );
  const events = parseIcs(await res.text());
  const result = await storeEvents(supabaseAdmin, userId, events, "moodle");
  await supabaseAdmin
    .from("user_settings")
    .update({ last_moodle_sync: new Date().toISOString() })
    .eq("user_id", userId);
  return { ...result, skipped: false };
}

/** Upsert events from a raw ICS file for a user (manual import — always runs). */
export async function importMoodleIcs(userId: string, text: string): Promise<SyncResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const result = await storeEvents(supabaseAdmin, userId, parseIcs(text), "ics");
  return { ...result, skipped: false };
}

/** Every account with a configured ICS URL — used by the cron route (single owner in practice). */
export async function listSyncableUserIds(): Promise<string[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_settings")
    .select("user_id")
    .not("moodle_ics_url", "is", null);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.user_id);
}
