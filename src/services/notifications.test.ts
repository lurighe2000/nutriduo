import { expect, it, vi } from "vitest";
import webpush from "web-push";
import { createECDH, randomBytes } from "node:crypto";
import { defaultReminders, remindersAt } from "./reminderContract";
import {
  pushRoute,
  pushSubscriptionSchema,
  sendReminders,
  type PushEnv,
} from "../../worker/notifications";
function fixture() {
  const data = new Map<string, string>();
  const keys = webpush.generateVAPIDKeys();
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return {
    env: {
      VAPID_PUBLIC_KEY: keys.publicKey,
      VAPID_PRIVATE_KEY: keys.privateKey,
      VAPID_SUBJECT: "mailto:fixture@example.com",
      PUSH_SUBSCRIPTIONS: {
        get: async (k: string) => data.get(k) ?? null,
        put: async (k: string, v: string) => {
          data.set(k, v);
        },
        delete: async (k: string) => {
          data.delete(k);
        },
        list: async () => ({
          keys: [...data.keys()].map((name) => ({ name })),
          list_complete: true,
        }),
      },
    } satisfies PushEnv,
    subscription: {
      endpoint: "https://fcm.googleapis.com/fcm/send/fixture",
      keys: {
        p256dh: ecdh.getPublicKey().toString("base64url"),
        auth: randomBytes(16).toString("base64url"),
      },
    },
    data,
  };
}
it("programa horarios de Buenos Aires y reserva el informe para el domingo", () => {
  const sunday = Date.parse("2026-10-18T22:30:00Z");
  expect(remindersAt(sunday, defaultReminders).map((r) => r.id)).toEqual([
    "report",
  ]);
  expect(remindersAt(sunday + 86400000, defaultReminders)).toHaveLength(0);
  expect(
    remindersAt(Date.parse("2026-10-14T11:30:00Z"), defaultReminders).map(
      (r) => r.id,
    ),
  ).toEqual(["breakfast"]);
  expect(
    remindersAt(sunday, { ...defaultReminders, report: false }),
  ).toHaveLength(0);
});
it("rechaza endpoints ajenos, guarda sólo suscripción y preferencias y permite desactivar", async () => {
  const { env, subscription, data } = fixture();
  expect(() =>
    pushSubscriptionSchema.parse({
      ...subscription,
      endpoint: "http://localhost:1234/",
    }),
  ).toThrow();
  expect(() =>
    pushSubscriptionSchema.parse({
      ...subscription,
      endpoint: "https://fcm.googleapis.com.attacker.example/",
    }),
  ).toThrow();
  await pushRoute(
    "/notifications/subscribe",
    { subscription, preferences: defaultReminders },
    env,
  );
  expect(data.size).toBe(1);
  expect(
    await pushRoute("/notifications/status", { subscription }, env),
  ).toEqual({ enabled: true, preferences: defaultReminders });
  expect([...data.values()][0]).not.toContain(env.VAPID_PRIVATE_KEY);
  await pushRoute("/notifications/unsubscribe", { subscription }, env);
  expect(data.size).toBe(0);
});
it("cifra push, evita duplicados y elimina suscripciones vencidas", async () => {
  const { env, subscription, data } = fixture();
  await pushRoute(
    "/notifications/subscribe",
    { subscription, preferences: defaultReminders },
    env,
  );
  const send = vi.fn(async () => new Response("", { status: 201 }));
  const now = Date.parse("2026-10-14T11:30:00Z");
  await sendReminders(now, env, send);
  await sendReminders(now + 60000, env, send);
  expect(send).toHaveBeenCalledTimes(1);
  const init = send.mock.calls[0] as unknown as [string, RequestInit];
  expect(init[1].body).toBeInstanceOf(Uint8Array);
  expect(new TextDecoder().decode(init[1].body as Uint8Array)).not.toContain(
    "Buen día",
  );
  const expired = vi.fn(async () => new Response("", { status: 410 }));
  await sendReminders(now + 86400000, env, expired);
  expect(data.size).toBe(0);
});
it("el aviso de prueba requiere una suscripción registrada y confirma la aceptación del servidor", async () => {
  const { env, subscription } = fixture();
  const send = vi.fn(async () => new Response("", { status: 201 }));
  await expect(
    pushRoute("/notifications/test", { subscription }, env, send),
  ).rejects.toThrow("Activá primero");
  await pushRoute(
    "/notifications/subscribe",
    { subscription, preferences: defaultReminders },
    env,
  );
  expect(
    await pushRoute("/notifications/test", { subscription }, env, send),
  ).toEqual({ sent: true });
  expect(send).toHaveBeenCalledTimes(1);
});
