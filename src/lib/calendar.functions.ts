import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { importIcsText, runSourceSync, runUserSync } from "@/lib/calendar-sync";
import { PALETTE } from "@/lib/palette";

const kind = z.enum(["deadlines", "classes", "other"]);

/** Add a private iCal feed. The URL is written by the server and never readable from the browser. */
export const addCalendarSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(80),
        kind,
        color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(),
        icsUrl: z
          .string()
          .trim()
          .transform((u) => u.replace(/^webcal:\/\//i, "https://"))
          .pipe(z.string().url().startsWith("https://").max(2000)),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("calendar_sources")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId);
    if ((count ?? 0) >= 15) throw new Error("Máximo 15 calendarios por cuenta");
    const { data: row, error } = await supabaseAdmin
      .from("calendar_sources")
      .insert({
        user_id: context.userId,
        name: data.name,
        kind: data.kind,
        color: data.color ?? PALETTE[(count ?? 0) % PALETTE.length]!,
        ics_url: data.icsUrl,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    try {
      return { id: row.id, ...(await runSourceSync(context.userId, row.id, { force: true })) };
    } catch (e) {
      return { id: row.id, imported: 0, newSubjects: 0, skipped: false, error: (e as Error).message };
    }
  });

export const replaceCalendarUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        icsUrl: z
          .string()
          .trim()
          .transform((u) => u.replace(/^webcal:\/\//i, "https://"))
          .pipe(z.string().url().startsWith("https://").max(2000)),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("calendar_sources")
      .update({ ics_url: data.icsUrl, last_error: null })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return runSourceSync(context.userId, data.id, { force: true });
  });

/** Sync all sources (throttled unless forced) or a single one. */
export const syncCalendars = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ force: z.boolean().optional(), sourceId: z.string().uuid().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    if (data.sourceId) {
      const r = await runSourceSync(context.userId, data.sourceId, { force: !!data.force });
      return { imported: r.imported, newSubjects: r.newSubjects, synced: r.skipped ? 0 : 1, errors: [] as string[] };
    }
    return runUserSync(context.userId, { force: !!data.force });
  });

export const importIcsFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ text: z.string().min(10).max(5_000_000), kind: kind.optional() }).parse(input),
  )
  .handler(async ({ data, context }) => importIcsText(context.userId, data.text, data.kind));
