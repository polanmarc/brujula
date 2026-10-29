import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Public VAPID key (safe to expose) plus which channels the server can deliver. */
export const getNotifyConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { emailConfigured, pushConfigured } = await import("@/lib/notify.server");
    return {
      vapidPublicKey: pushConfigured() ? process.env["VAPID_PUBLIC_KEY"]! : null,
      email: emailConfigured(),
    };
  });

export const sendTestNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { sendPush } = await import("@/lib/notify.server");
    const sent = await sendPush(context.userId, {
      title: "Brújula",
      body: "Las notificaciones funcionan. Te avisaremos de lo que vence hoy y mañana.",
      url: "/inicio",
      tag: "test",
    });
    if (!sent) throw new Error("No hay ningún dispositivo suscrito o el servidor no tiene claves VAPID");
    return { sent };
  });
