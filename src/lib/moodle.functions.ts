import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { importMoodleIcs, runMoodleSync } from "@/lib/moodle-sync";

type Ctx = { supabase: SupabaseClient<Database>; userId: string };

async function assertOwner(ctx: Ctx) {
  const { data, error } = await ctx.supabase.rpc("is_app_owner");
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Acceso restringido al propietario del panel");
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
      .from("user_settings")
      .select("moodle_ics_url")
      .eq("user_id", context.userId)
      .maybeSingle();
    return {
      icsConfigured: !!secret?.moodle_ics_url,
      baseUrl: data?.moodle_base_url ?? null,
      lastSync: data?.last_moodle_sync ?? null,
    };
  });

export const saveMoodleSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        icsUrl: z.string().trim().url().startsWith("https://").max(2000).nullable().optional(),
        baseUrl: z.string().trim().url().max(500).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const patch: Record<string, unknown> = {
      user_id: context.userId,
      updated_at: new Date().toISOString(),
    };
    if (data.icsUrl !== undefined) patch["moodle_ics_url"] = data.icsUrl || null;
    if (data.baseUrl !== undefined) patch["moodle_base_url"] = data.baseUrl || null;
    const { error } = await supabaseAdmin
      .from("user_settings")
      .upsert(patch, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const syncMoodle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ force: z.boolean().optional() }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    return runMoodleSync(context.userId, { force: !!data.force });
  });

export const importIcsFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ text: z.string().min(10).max(5_000_000) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    return importMoodleIcs(context.userId, data.text);
  });
