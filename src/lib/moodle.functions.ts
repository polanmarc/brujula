import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseIcs, type IcsEvent } from "@/lib/ics";

const PALETTE = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16"];

type Ctx = { supabase: any; userId: string };

async function assertOwner(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("is_app_owner");
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acceso restringido al propietario del panel");
}

async function storeEvents(ctx: Ctx, events: IcsEvent[], source: string) {
  const { supabase, userId } = ctx;
  if (events.length) {
    const rows = events.map((e) => ({ ...e, user_id: userId, source, updated_at: new Date().toISOString() }));
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from("calendar_events").upsert(rows.slice(i, i + 500), { onConflict: "user_id,uid" });
      if (error) throw new Error(error.message);
    }
  }
  // auto-create subjects for new courses
  const courses = [...new Set(events.map((e) => e.course).filter(Boolean))] as string[];
  if (courses.length) {
    const { data: existing } = await supabase.from("subjects").select("name");
    const have = new Set((existing ?? []).map((s: { name: string }) => s.name));
    const missing = courses.filter((c) => !have.has(c));
    if (missing.length) {
      const offset = have.size;
      await supabase.from("subjects").insert(
        missing.map((name, i) => ({ name, user_id: userId, color: PALETTE[(offset + i) % PALETTE.length] })),
      );
    }
  }
  return { imported: events.length, newSubjects: courses.length };
}

export const getMoodleStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_settings")
      .select("moodle_base_url, last_moodle_sync")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: secret } = await supabaseAdmin
      .from("user_settings").select("moodle_ics_url").eq("user_id", context.userId).maybeSingle();
    return {
      icsConfigured: !!secret?.moodle_ics_url,
      baseUrl: data?.moodle_base_url ?? null,
      lastSync: data?.last_moodle_sync ?? null,
    };
  });

export const saveMoodleSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({
      icsUrl: z.string().trim().url().startsWith("https://").max(2000).nullable().optional(),
      baseUrl: z.string().trim().url().max(500).nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = { user_id: context.userId, updated_at: new Date().toISOString() };
    if (data.icsUrl !== undefined) patch["moodle_ics_url"] = data.icsUrl || null;
    if (data.baseUrl !== undefined) patch["moodle_base_url"] = data.baseUrl || null;
    const { error } = await supabaseAdmin.from("user_settings").upsert(patch, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const syncMoodle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s } = await supabaseAdmin
      .from("user_settings").select("moodle_ics_url").eq("user_id", context.userId).maybeSingle();
    if (!s?.moodle_ics_url) return { imported: 0, newSubjects: 0, skipped: true };
    const res = await fetch(s.moodle_ics_url, { headers: { Accept: "text/calendar" } });
    if (!res.ok) throw new Error(`Moodle respondió ${res.status}. Revisa que la URL de exportación siga siendo válida.`);
    const text = await res.text();
    const events = parseIcs(text);
    const result = await storeEvents(context, events, "moodle");
    await supabaseAdmin.from("user_settings")
      .update({ last_moodle_sync: new Date().toISOString() }).eq("user_id", context.userId);
    return result;
  });

export const importIcsFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ text: z.string().min(10).max(5_000_000) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    return storeEvents(context, parseIcs(data.text), "ics");
  });
