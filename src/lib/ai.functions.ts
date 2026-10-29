import { createServerFn } from "@tanstack/react-start";
import { addDays, format } from "date-fns";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const when = z.object({
  today: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tz: z.string().max(64).default("Europe/Madrid"),
});

export const aiStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { aiConfigured } = await import("@/lib/ai.server");
    return { available: aiConfigured() };
  });

/** Summarize one Gmail message and pull out deadlines (read-only Gmail access). */
export const summarizeMail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => when.extend({ id: z.string().regex(/^[a-zA-Z0-9]+$/) }).parse(input))
  .handler(async ({ data, context }) => {
    const { getUserAccessToken } = await import("@/lib/google.server");
    const acc = await getUserAccessToken(context.userId);
    if (!acc) throw new Error("Gmail no está conectado");
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${data.id}?format=full`, {
      headers: { Authorization: `Bearer ${acc.token}` },
    });
    if (!res.ok) throw new Error(`Gmail [${res.status}]`);
    const m = await res.json();
    const headers: { name: string; value: string }[] = m.payload?.headers ?? [];
    const h = (n: string) => headers.find((x) => x.name.toLowerCase() === n)?.value ?? "";
    const body = extractText(m.payload) || m.snippet || "";
    const { askStructured, MailSummarySchema } = await import("@/lib/ai.server");
    return askStructured({
      userId: context.userId,
      feature: "mail",
      schema: MailSummarySchema,
      system:
        "Ayudas a un estudiante a gestionar su correo. Resume el mensaje en español y extrae solo fechas límite reales (entregas, exámenes, inscripciones). " +
        `Hoy es ${data.today} (zona horaria ${data.tz}); convierte fechas relativas a fechas absolutas. Si no hay fechas, devuelve una lista vacía.`,
      content: [{ type: "text", text: `De: ${h("from")}\nAsunto: ${h("subject")}\nFecha: ${h("date")}\n\n${body.slice(0, 30000)}` }],
    });
  });

type MailPart = { mimeType?: string; body?: { data?: string }; parts?: MailPart[] };

function extractText(part: MailPart | undefined): string {
  if (!part) return "";
  const decode = (b64: string) => Buffer.from(b64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  if (part.mimeType === "text/plain" && part.body?.data) return decode(part.body.data);
  for (const p of part.parts ?? []) {
    const t = extractText(p);
    if (t) return t;
  }
  if (part.mimeType === "text/html" && part.body?.data) return decode(part.body.data).replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ");
  return "";
}

/** Read a course guide (PDF or pasted text) and extract evaluation criteria and dates. */
export const extractSyllabus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    when
      .extend({
        pdfBase64: z.string().max(14_000_000).optional(),
        text: z.string().max(200_000).optional(),
      })
      .refine((v) => !!v.pdfBase64 || !!v.text, "Sube un PDF o pega el texto")
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { askStructured, SyllabusSchema } = await import("@/lib/ai.server");
    return askStructured({
      userId: context.userId,
      feature: "syllabus",
      schema: SyllabusSchema,
      effort: "medium",
      system:
        "Lees guías docentes universitarias. Extrae los criterios de evaluación con su peso porcentual (deben sumar 100 si la guía lo indica), " +
        "el profesorado y las fechas de entregas y exámenes. No inventes datos: si algo no aparece, usa null o una lista vacía. " +
        `Hoy es ${data.today}; si una fecha no indica año, usa el curso académico en vigor.`,
      content: [
        ...(data.pdfBase64
          ? [{ type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: data.pdfBase64 } }]
          : []),
        { type: "text", text: data.text ? `Guía docente:\n\n${data.text}` : "Extrae la información de esta guía docente." },
      ],
    });
  });

/** Plan the coming week from the student's own tasks, deadlines, classes and study history. */
export const planWeek = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => when.extend({ hoursPerDay: z.number().min(0.5).max(12).default(3) }).parse(input))
  .handler(async ({ data, context }) => {
    const sb = context.supabase; // RLS-scoped to the caller
    const end = format(addDays(new Date(`${data.today}T12:00:00`), 14), "yyyy-MM-dd");
    const [tasks, events, sessions, subjects] = await Promise.all([
      sb.from("tasks").select("title, due_date, due_time, kind, priority, estimate_minutes, subject_id, status").neq("status", "done").lte("due_date", end),
      sb.from("calendar_events").select("title, starts_at, kind, course").gte("starts_at", `${data.today}T00:00:00Z`).lte("starts_at", `${end}T23:59:59Z`),
      sb.from("class_sessions").select("weekday, start_time, end_time, subject_id"),
      sb.from("subjects").select("id, name"),
    ]);
    const name = new Map((subjects.data ?? []).map((s) => [s.id, s.name]));
    const lines = [
      "PENDIENTE:",
      ...(tasks.data ?? []).map((t) => `- [${t.kind}/${t.priority}] ${t.title} (${t.subject_id ? name.get(t.subject_id) : "personal"}) vence ${t.due_date ?? "sin fecha"}${t.due_time ? " " + t.due_time.slice(0, 5) : ""}${t.estimate_minutes ? `, estimado ${t.estimate_minutes} min` : ""}`),
      "CALENDARIO:",
      ...(events.data ?? []).filter((e) => e.kind !== "class").map((e) => `- [${e.kind}] ${e.title} (${e.course ?? ""}) ${e.starts_at}`),
      "HORARIO DE CLASES (1=lunes):",
      ...(sessions.data ?? []).map((s) => `- día ${s.weekday} ${s.start_time.slice(0, 5)}-${s.end_time.slice(0, 5)} ${name.get(s.subject_id) ?? ""}`),
    ];
    const { askStructured, WeekPlanSchema } = await import("@/lib/ai.server");
    return askStructured({
      userId: context.userId,
      feature: "plan",
      schema: WeekPlanSchema,
      effort: "medium",
      system:
        "Eres un planificador de estudio. Crea un plan realista para los próximos 7 días empezando hoy, en español. " +
        `Hoy es ${data.today} (${data.tz}). El estudiante quiere estudiar unas ${data.hoursPerDay} h al día fuera de clase. ` +
        "No solapes bloques con las clases, prioriza lo que vence antes y los exámenes, y deja descansos. Usa solo las tareas dadas.",
      content: [{ type: "text", text: lines.join("\n").slice(0, 40000) }],
    });
  });
