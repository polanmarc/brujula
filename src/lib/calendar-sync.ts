// Core iCal sync for every calendar source (Moodle, Canvas, Classroom, timetable feeds…),
// usable from both server functions (authenticated user) and the cron route (shared-secret).
// Everything here runs with the admin client and takes an explicit user_id, so it never
// depends on auth.uid().
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { parseIcs, type IcsEvent } from "@/lib/ics";
import { PALETTE } from "@/lib/palette";

export { PALETTE };

export type AdminClient = SupabaseClient<Database>;
export type SourceKind = "deadlines" | "classes" | "other";
export type EventKind = "deadline" | "exam" | "class" | "event";


// Skip a sync if the last one finished less than this ago (unless forced).
// Only the on-load auto-sync is unforced; cron and the settings buttons always force.
export const SYNC_THROTTLE_MS = 5 * 60 * 1000;

const EXAM_RE = /\b(examen|exam|parcial|final|prueba|quiz|test|control|midterm)\b/i;

/** Whether a sync should be skipped because a recent one is still within the throttle window. */
export function isThrottled(lastSync: string | null | undefined, now = Date.now()): boolean {
  if (!lastSync) return false;
  return now - new Date(lastSync).getTime() < SYNC_THROTTLE_MS;
}

/** Event category from the source type and its title. */
export function classifyEvent(title: string, sourceKind: string): EventKind {
  if (sourceKind === "classes") return "class";
  if (EXAM_RE.test(title)) return "exam";
  return sourceKind === "other" ? "event" : "deadline";
}

/**
 * Stored events of a source that are gone from its feed and should be deleted.
 * Only future ones: past events drop out of Moodle's "recent" export window, so their
 * absence doesn't mean they were removed.
 */
export function staleEventIds(
  stored: { id: string; uid: string; starts_at: string }[],
  feedUids: Iterable<string>,
  now = Date.now(),
): string[] {
  const keep = new Set(feedUids);
  return stored.filter((e) => !keep.has(e.uid) && new Date(e.starts_at).getTime() >= now).map((e) => e.id);
}

export type SyncResult =
  | { imported: number; newSubjects: number; removed: number; skipped: false }
  | { imported: 0; newSubjects: 0; removed: 0; skipped: true; reason: "not_configured" | "throttled" };

async function storeEvents(
  admin: AdminClient,
  userId: string,
  events: IcsEvent[],
  source: { id: string | null; kind: string; label: string },
) {
  if (events.length) {
    const rows = events.map((e) => ({
      ...e,
      user_id: userId,
      source: source.label,
      source_id: source.id,
      kind: classifyEvent(e.title, source.kind),
      updated_at: new Date().toISOString(),
    }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await admin
        .from("calendar_events")
        .upsert(rows.slice(i, i + 500), { onConflict: "user_id,uid" });
      if (error) throw new Error(error.message);
    }
  }
  // drop future events the feed no longer has (deleted/hidden in Moodle). An empty feed is
  // more likely a hiccup or expired URL than a wiped course, so never prune on it.
  let removed = 0;
  if (source.id && events.length) {
    const { data: stored, error } = await admin
      .from("calendar_events")
      .select("id, uid, starts_at")
      .eq("user_id", userId)
      .eq("source_id", source.id)
      .gte("starts_at", new Date().toISOString());
    if (error) throw new Error(error.message);
    const stale = staleEventIds(stored ?? [], events.map((e) => e.uid));
    for (let i = 0; i < stale.length; i += 200) {
      const { error: delError } = await admin
        .from("calendar_events")
        .delete()
        .eq("user_id", userId)
        .in("id", stale.slice(i, i + 200));
      if (delError) throw new Error(delError.message);
    }
    removed = stale.length;
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
  return { imported: events.length, newSubjects, removed };
}

/** Download one source's iCal URL and upsert its events. Honors the throttle. */
export async function runSourceSync(
  userId: string,
  sourceId: string,
  opts: { force?: boolean } = {},
): Promise<SyncResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: s } = await supabaseAdmin
    .from("calendar_sources")
    .select("id, name, kind, ics_url, last_sync")
    .eq("user_id", userId)
    .eq("id", sourceId)
    .maybeSingle();

  if (!s?.ics_url) return { imported: 0, newSubjects: 0, removed: 0, skipped: true, reason: "not_configured" };
  if (!opts.force && isThrottled(s.last_sync)) {
    return { imported: 0, newSubjects: 0, removed: 0, skipped: true, reason: "throttled" };
  }

  try {
    const res = await fetch(s.ics_url, { headers: { Accept: "text/calendar" } });
    if (!res.ok)
      throw new Error(`«${s.name}» respondió ${res.status}. Revisa que la URL siga siendo válida.`);
    const events = parseIcs(await res.text());
    const result = await storeEvents(supabaseAdmin, userId, events, { id: s.id, kind: s.kind, label: "ics" });
    await supabaseAdmin
      .from("calendar_sources")
      .update({ last_sync: new Date().toISOString(), last_error: null })
      .eq("id", s.id);
    return { ...result, skipped: false };
  } catch (e) {
    await supabaseAdmin
      .from("calendar_sources")
      .update({ last_sync: new Date().toISOString(), last_error: (e as Error).message.slice(0, 300) })
      .eq("id", s.id);
    throw e;
  }
}

/** Sync every source of a user; failures of one source don't stop the others. */
export async function runUserSync(userId: string, opts: { force?: boolean } = {}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("calendar_sources")
    .select("id")
    .eq("user_id", userId)
    .not("ics_url", "is", null);
  let imported = 0;
  let newSubjects = 0;
  let removed = 0;
  let synced = 0;
  const errors: string[] = [];
  for (const { id } of data ?? []) {
    try {
      const r = await runSourceSync(userId, id, opts);
      if (!r.skipped) {
        synced++;
        imported += r.imported;
        newSubjects += r.newSubjects;
        removed += r.removed;
      }
    } catch (e) {
      errors.push((e as Error).message);
    }
  }
  return { imported, newSubjects, removed, synced, errors };
}

/** Upsert events from a raw ICS file for a user (manual import — always runs). */
export async function importIcsText(userId: string, text: string, kind: SourceKind = "deadlines"): Promise<SyncResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const result = await storeEvents(supabaseAdmin, userId, parseIcs(text), { id: null, kind, label: "ics-file" });
  return { ...result, skipped: false };
}

/** Every account with at least one iCal URL — used by the cron route. */
export async function listSyncableUserIds(): Promise<string[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("calendar_sources")
    .select("user_id")
    .not("ics_url", "is", null);
  if (error) throw new Error(error.message);
  return [...new Set((data ?? []).map((r) => r.user_id))];
}

/** Run async work over items with bounded concurrency. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return out;
}
