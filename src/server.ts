// Load .env automatically in local Node/runtime environments
if (typeof process !== "undefined" && typeof (process as any).loadEnvFile === "function") {
  try {
    (process as any).loadEnvFile();
  } catch {
    // .env might already be loaded or not present in container
  }
}

import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { authenticateCronRequest } from "./integrations/supabase/cron-auth";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// Scheduled calendar sync, triggered by an external cron with a shared secret
// (CRON_SECRET). Keeps every account's iCal sources fresh without opening the app.
async function handleCronSync(request: Request): Promise<Response> {
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const unauthorized = await authenticateCronRequest(request);
  if (unauthorized) return unauthorized;
  try {
    const { listSyncableUserIds, mapLimit, runUserSync } = await import("./lib/calendar-sync");
    const userIds = await listSyncableUserIds();
    const results = await mapLimit(userIds, 5, async (userId) => {
      try {
        return { userId, ...(await runUserSync(userId, { force: true })) };
      } catch (error) {
        return { userId, error: (error as Error).message };
      }
    });
    return Response.json({ ok: true, users: userIds.length, results });
  } catch (error) {
    console.error(error);
    return Response.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
}

// Daily reminders (Web Push + optional email digest), same shared secret. Run it once a morning.
async function handleCronNotify(request: Request): Promise<Response> {
  if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const unauthorized = await authenticateCronRequest(request);
  if (unauthorized) return unauthorized;
  try {
    const { mapLimit } = await import("./lib/calendar-sync");
    const { listNotifiableUsers, notifyUser } = await import("./lib/notify.server");
    const users = await listNotifiableUsers();
    const results = await mapLimit(users, 5, async (u) => {
      try {
        return { userId: u.userId, ...(await notifyUser(u.userId, { email: u.email })) };
      } catch (error) {
        return { userId: u.userId, error: (error as Error).message };
      }
    });
    return Response.json({ ok: true, users: users.length, results });
  } catch (error) {
    console.error(error);
    return Response.json({ ok: false, error: (error as Error).message }, { status: 500 });
  }
}

async function routeApi(request: Request, pathname: string): Promise<Response | null> {
  if (pathname === "/api/cron/sync") return handleCronSync(request);
  if (pathname === "/api/cron/notify") return handleCronNotify(request);
  if (pathname === "/api/google/callback" && request.method === "GET") {
    const { handleGoogleCallback } = await import("./lib/google.server");
    return handleGoogleCallback(request);
  }
  if (pathname.startsWith("/api/ics/") && request.method === "GET") {
    const { handleIcsFeed } = await import("./lib/ics-export");
    return handleIcsFeed(request);
  }
  return null;
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const api = await routeApi(request, new URL(request.url).pathname);
      if (api) return api;
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
