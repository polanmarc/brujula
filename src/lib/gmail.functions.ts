import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Official Google Gmail REST API endpoints (read-only: never call send/modify/trash)
const GATEWAY = "https://gmail.googleapis.com/gmail/v1";
const BATCH = "https://www.googleapis.com/batch/gmail/v1";

export type MailItem = {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
  snippet: string;
  unread: boolean;
};

async function creds(userId: string): Promise<Record<string, string> | null> {
  const { getUserAccessToken } = await import("@/lib/google.server");
  const acc = await getUserAccessToken(userId);
  return acc ? { Authorization: `Bearer ${acc.token}` } : null;
}

async function gm(userId: string, path: string) {
  const h = await creds(userId);
  if (!h) throw new Error("GMAIL_NOT_CONNECTED");
  const res = await fetch(`${GATEWAY}${path}`, { headers: h });
  if (!res.ok) throw new Error(`Gmail [${res.status}]: ${await res.text()}`);
  return res.json();
}

function header(headers: { name: string; value: string }[] = [], name: string) {
  return headers.find((x) => x.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

async function batchMetadata(userId: string, ids: string[]): Promise<any[]> {
  const h = await creds(userId);
  if (!h) return [];
  const boundary = "batch_dash_" + Math.random().toString(36).slice(2);
  const body =
    ids
      .map(
        (id, i) =>
          `--${boundary}\r\nContent-Type: application/http\r\nContent-ID: <item${i}>\r\n\r\n` +
          `GET /gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date\r\n\r\n`,
      )
      .join("") + `--${boundary}--`;
  const res = await fetch(BATCH, {
    method: "POST",
    headers: { ...h, "Content-Type": `multipart/mixed; boundary=${boundary}` },
    body,
  });
  if (!res.ok) throw new Error(`Gmail batch [${res.status}]: ${await res.text()}`);
  const ct = res.headers.get("content-type") ?? "";
  const rb = ct.match(/boundary=("?)([^";]+)\1/)?.[2];
  if (!ct.includes("multipart/mixed") || !rb) throw new Error("Respuesta inesperada de Gmail");
  const text = await res.text();
  const out: any[] = [];
  const errors: string[] = [];
  for (const part of text.split(`--${rb}`)) {
    const statusMatch = part.match(/HTTP\/1\.1 (\d{3})/);
    if (!statusMatch) continue;
    const jsonStart = part.indexOf("{", part.indexOf(statusMatch[0]));
    const jsonEnd = part.lastIndexOf("}");
    const code = statusMatch[1]!;
    if (+code >= 300) {
      errors.push(code);
      continue;
    }
    if (jsonStart >= 0 && jsonEnd > jsonStart)
      out.push(JSON.parse(part.slice(jsonStart, jsonEnd + 1)));
  }
  if (!out.length && errors.length) throw new Error(`Gmail devolvió errores: ${errors.join(", ")}`);
  return out;
}

export const gmailStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { googleConfigured, getUserAccessToken } = await import("@/lib/google.server");
    const available = googleConfigured();
    try {
      const acc = available ? await getUserAccessToken(context.userId) : null;
      if (!acc) return { connected: false as const, available, email: null, unread: 0 };
      const [profile, inbox] = await Promise.all([
        gm(context.userId, "/users/me/profile"),
        gm(context.userId, "/users/me/labels/INBOX"),
      ]);
      return {
        connected: true as const,
        available,
        email: profile.emailAddress as string,
        unread: (inbox.messagesUnread ?? 0) as number,
      };
    } catch (e) {
      return { connected: false as const, available, email: null, unread: 0, error: (e as Error).message };
    }
  });

export const listMail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z
      .object({
        q: z.string().max(300).default(""),
        unreadOnly: z.boolean().default(false),
        pageToken: z.string().max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const q = [data.q, data.unreadOnly ? "is:unread" : ""].filter(Boolean).join(" ");
    const params = new URLSearchParams({ maxResults: "25", labelIds: "INBOX" });
    if (q) {
      params.delete("labelIds");
      params.set("q", q);
    }
    if (data.pageToken) params.set("pageToken", data.pageToken);
    const list = await gm(context.userId, `/users/me/messages?${params}`);
    const ids: string[] = (list.messages ?? []).map((m: { id: string }) => m.id);
    const metas = ids.length ? await batchMetadata(context.userId, ids) : [];
    const byId = new Map(metas.map((m) => [m.id, m]));
    const items: MailItem[] = ids
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((m: any) => ({
        id: m.id,
        threadId: m.threadId,
        from: header(m.payload?.headers, "From"),
        subject: header(m.payload?.headers, "Subject") || "(sin asunto)",
        date: m.internalDate
          ? new Date(+m.internalDate).toISOString()
          : header(m.payload?.headers, "Date"),
        snippet: m.snippet ?? "",
        unread: (m.labelIds ?? []).includes("UNREAD"),
      }));
    return { items, nextPageToken: (list.nextPageToken as string | undefined) ?? null };
  });

function decode(b64: string) {
  const bin = atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

function findBody(part: any, mime: string): string | null {
  if (!part) return null;
  if (part.mimeType === mime && part.body?.data) return decode(part.body.data);
  for (const p of part.parts ?? []) {
    const r = findBody(p, mime);
    if (r) return r;
  }
  return null;
}

export const getMail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ id: z.string().regex(/^[a-zA-Z0-9]+$/) }).parse(input))
  .handler(async ({ data, context }) => {
    const m = await gm(context.userId, `/users/me/messages/${data.id}?format=full`);
    const text = findBody(m.payload, "text/plain");
    const html = text ? null : findBody(m.payload, "text/html");
    return {
      id: m.id as string,
      threadId: m.threadId as string,
      from: header(m.payload?.headers, "From"),
      to: header(m.payload?.headers, "To"),
      subject: header(m.payload?.headers, "Subject") || "(sin asunto)",
      date: new Date(+m.internalDate).toISOString(),
      body:
        text ??
        (html
          ? html
              .replace(/<style[\s\S]*?<\/style>/gi, "")
              .replace(/<[^>]+>/g, " ")
              .replace(/&nbsp;/g, " ")
              .replace(/\s{2,}/g, " ")
              .trim()
          : (m.snippet ?? "")),
    };
  });

export const googleConnectUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { buildAuthUrl } = await import("@/lib/google.server");
    return { url: buildAuthUrl(context.userId) };
  });

export const googleDisconnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { disconnectGoogle } = await import("@/lib/google.server");
    await disconnectGoogle(context.userId);
    return { ok: true };
  });
