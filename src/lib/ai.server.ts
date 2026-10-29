// Claude API helpers (server only). Every feature goes through `askStructured`, which
// enforces the per-user daily limit and returns schema-validated JSON.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod/v4";

const MODEL = "claude-opus-5-5";

export const aiConfigured = () => !!process.env["ANTHROPIC_API_KEY"];

let client: Anthropic | undefined;
const anthropic = () => (client ??= new Anthropic());

async function checkQuota(userId: string, feature: string) {
  const limit = Number(process.env["AI_DAILY_LIMIT"] ?? 30);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from("ai_requests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);
  if ((count ?? 0) >= limit) throw new Error(`Has alcanzado el límite diario de ${limit} peticiones de IA`);
  await supabaseAdmin.from("ai_requests").insert({ user_id: userId, feature });
}

export async function askStructured<S extends z.ZodType>(opts: {
  userId: string;
  feature: string;
  schema: S;
  system: string;
  content: Anthropic.Beta.BetaContentBlockParam[];
  effort?: "low" | "medium" | "high";
}): Promise<z.infer<S>> {
  if (!aiConfigured()) throw new Error("La IA no está configurada en el servidor (falta ANTHROPIC_API_KEY)");
  await checkQuota(opts.userId, opts.feature);
  try {
    const res = await anthropic().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: opts.system,
      output_config: { effort: opts.effort ?? "low", format: betaZodOutputFormat(opts.schema) },
      messages: [{ role: "user", content: opts.content }],
    });
    if (res.stop_reason === "refusal") throw new Error("La IA no ha podido procesar esta petición");
    if (res.stop_reason === "max_tokens") throw new Error("La respuesta de la IA quedó incompleta; prueba con menos contenido");
    if (!res.parsed_output) throw new Error("La IA devolvió una respuesta no válida");
    return res.parsed_output as z.infer<S>;
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) throw new Error("La IA está saturada; inténtalo en un minuto");
    if (e instanceof Anthropic.AuthenticationError) throw new Error("La clave de la IA del servidor no es válida");
    if (e instanceof Anthropic.BadRequestError) throw new Error(`Petición rechazada por la IA: ${e.message}`);
    if (e instanceof Anthropic.APIError) throw new Error(`Error de la IA (${e.status}); inténtalo de nuevo`);
    throw e;
  }
}

const dated = z.object({
  title: z.string(),
  date: z.string().describe("Fecha en formato YYYY-MM-DD"),
  time: z.string().nullable().describe("Hora HH:MM en 24h, o null si no se indica"),
  kind: z.enum(["deliverable", "exam", "task"]),
});

export const MailSummarySchema = z.object({
  summary: z.string().describe("Resumen en 1-3 frases, en español"),
  action_items: z.array(z.string()).describe("Cosas que el estudiante tiene que hacer"),
  deadlines: z.array(dated).describe("Fechas límite, exámenes o entregas mencionados"),
});

export const SyllabusSchema = z.object({
  subject_name: z.string().nullable(),
  teacher: z.string().nullable(),
  evaluation: z
    .array(z.object({ name: z.string(), weight: z.number().describe("Porcentaje sobre la nota final, 0-100") }))
    .describe("Criterios de evaluación con su peso"),
  deadlines: z.array(dated),
  minimum_rules: z.array(z.string()).describe("Requisitos como nota mínima en el examen o asistencia obligatoria"),
});

export const WeekPlanSchema = z.object({
  days: z.array(
    z.object({
      date: z.string().describe("YYYY-MM-DD"),
      focus: z.string().describe("Prioridad del día en pocas palabras"),
      blocks: z.array(z.object({ start: z.string().describe("HH:MM"), end: z.string().describe("HH:MM"), activity: z.string() })),
    }),
  ),
  tips: z.array(z.string()).describe("2-4 consejos concretos para esta semana"),
});

export const isoDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
