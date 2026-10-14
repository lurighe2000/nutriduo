import { z } from "zod";
import webpush from "web-push";
import {
  reminderPreferencesSchema,
  remindersAt,
} from "../src/services/reminderContract";
export interface PushStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(options: {
    prefix: string;
    limit: number;
  }): Promise<{ keys: { name: string }[]; list_complete: boolean }>;
}
export interface PushEnv {
  PUSH_SUBSCRIPTIONS?: PushStore;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}
export const pushSubscriptionSchema = z.object({
  endpoint: z
    .string()
    .url()
    .max(2000)
    .refine((value) => {
      const u = new URL(value);
      return (
        u.protocol === "https:" &&
        !u.port &&
        !u.username &&
        !u.password &&
        !u.hash &&
        [
          "fcm.googleapis.com",
          "updates.push.services.mozilla.com",
          "web.push.apple.com",
          "webpush.push.apple.com",
        ].some((host) => u.hostname === host || u.hostname.endsWith("." + host))
      );
    }, "Servidor de notificaciones no permitido"),
  keys: z.object({
    p256dh: z
      .string()
      .regex(/^[A-Za-z0-9_-]+={0,2}$/)
      .min(86)
      .max(90),
    auth: z
      .string()
      .regex(/^[A-Za-z0-9_-]+={0,2}$/)
      .min(22)
      .max(24),
  }),
});
const storedSchema = z.object({
  subscription: pushSubscriptionSchema,
  preferences: reminderPreferencesSchema,
  lastTag: z.string().optional(),
  updatedAt: z.string(),
});
async function subscriptionKey(endpoint: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(endpoint),
  );
  return (
    "push:" +
    [...new Uint8Array(digest)]
      .map((x) => x.toString(16).padStart(2, "0"))
      .join("")
  );
}
export async function pushRoute(
  path: string,
  body: unknown,
  env: PushEnv,
  send: typeof fetch = fetch,
) {
  if (
    !env.PUSH_SUBSCRIPTIONS ||
    !env.VAPID_PUBLIC_KEY ||
    !env.VAPID_PRIVATE_KEY
  )
    throw new Error(
      "Los recordatorios todavía no están configurados en el servicio.",
    );
  if (path === "/notifications/config")
    return { publicKey: env.VAPID_PUBLIC_KEY };
  const input = z
    .object({
      subscription: pushSubscriptionSchema,
      preferences: reminderPreferencesSchema.optional(),
    })
    .strict()
    .parse(body);
  const key = await subscriptionKey(input.subscription.endpoint);
  const stored = await env.PUSH_SUBSCRIPTIONS.get(key);
  if (path === "/notifications/test") {
    if (!stored)
      throw new Error("Activá primero los recordatorios en este dispositivo.");
    const saved = storedSchema.parse(JSON.parse(stored));
    const response = await deliverPush(
      saved.subscription,
      {
        title: "¡NutriDuo ya está por acá!",
        body: "Este es tu aviso de prueba. Los recordatorios te van a acompañar durante la semana.",
        tag: "nutriduo-prueba",
      },
      env,
      send,
    );
    if (response.status === 404 || response.status === 410) {
      await env.PUSH_SUBSCRIPTIONS.delete(key);
      throw new Error(
        "La suscripción venció. Desactivá y volvé a activar los recordatorios.",
      );
    }
    if (!response.ok)
      throw new Error(
        `El servidor del celular rechazó el aviso (HTTP ${response.status}). Probá de nuevo más tarde.`,
      );
    return { sent: true };
  }
  if (path === "/notifications/status")
    return {
      enabled: Boolean(stored),
      preferences: stored
        ? storedSchema.parse(JSON.parse(stored)).preferences
        : undefined,
    };
  if (path === "/notifications/unsubscribe") {
    await env.PUSH_SUBSCRIPTIONS.delete(key);
    return { enabled: false };
  }
  if (path !== "/notifications/subscribe" || !input.preferences)
    throw new Error("Configuración de recordatorios inválida");
  if (!stored) {
    const all = await env.PUSH_SUBSCRIPTIONS.list({
      prefix: "push:",
      limit: 10,
    });
    if (all.keys.length >= 8 || !all.list_complete)
      throw new Error(
        "Se alcanzó el máximo de ocho dispositivos. Desactivá alguno antes de agregar otro.",
      );
  }
  const previous = stored ? storedSchema.parse(JSON.parse(stored)) : undefined;
  await env.PUSH_SUBSCRIPTIONS.put(
    key,
    JSON.stringify({
      subscription: input.subscription,
      preferences: input.preferences,
      lastTag: previous?.lastTag,
      updatedAt: new Date().toISOString(),
    }),
  );
  return { enabled: true, preferences: input.preferences };
}
export async function sendReminders(
  timestamp: number,
  env: PushEnv,
  send: typeof fetch = fetch,
) {
  if (
    !env.PUSH_SUBSCRIPTIONS ||
    !env.VAPID_PUBLIC_KEY ||
    !env.VAPID_PRIVATE_KEY ||
    !env.VAPID_SUBJECT
  )
    return;
  const listing = await env.PUSH_SUBSCRIPTIONS.list({
    prefix: "push:",
    limit: 10,
  });
  for (const key of listing.keys) {
    const raw = await env.PUSH_SUBSCRIPTIONS.get(key.name);
    if (!raw) continue;
    const parsed = storedSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) continue;
    const stored = parsed.data;
    for (const reminder of remindersAt(timestamp, stored.preferences)) {
      if (stored.lastTag === reminder.tag) continue;
      try {
        const response = await deliverPush(
          stored.subscription,
          {
            title: reminder.title,
            body: reminder.body,
            tag: reminder.tag,
          },
          env,
          send,
        );
        if (response.status === 404 || response.status === 410) {
          await env.PUSH_SUBSCRIPTIONS.delete(key.name);
          break;
        }
        if (response.ok) {
          stored.lastTag = reminder.tag;
          await env.PUSH_SUBSCRIPTIONS.put(key.name, JSON.stringify(stored));
        }
      } catch {
        /* Keep the subscription; a later reminder can still be delivered. */
      }
    }
  }
}
async function deliverPush(
  subscription: z.infer<typeof pushSubscriptionSchema>,
  message: { title: string; body: string; tag: string },
  env: PushEnv,
  send: typeof fetch,
) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT)
    throw new Error("Los avisos todavía no están configurados.");
  let request;
  try {
    request = webpush.generateRequestDetails(
      subscription,
      JSON.stringify(message),
      {
        TTL: 1800,
        urgency: "normal",
        vapidDetails: {
          subject: env.VAPID_SUBJECT,
          publicKey: env.VAPID_PUBLIC_KEY,
          privateKey: env.VAPID_PRIVATE_KEY,
        },
      },
    );
  } catch {
    throw new Error(
      "No se pudo cifrar el aviso. Desactivá y volvé a activar los recordatorios.",
    );
  }
  return send(request.endpoint, {
    method: request.method,
    headers: request.headers,
    body: request.body ? new Uint8Array(request.body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
}
