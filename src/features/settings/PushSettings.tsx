import { useEffect, useState } from "react";
import { z } from "zod";
import { Button } from "../../components/ui";
import { useApp } from "../../app/context";
import { notificationRequest } from "../../services/integratedAI";
import {
  defaultReminders,
  reminderPreferencesSchema,
  type ReminderPreferences,
} from "../../services/reminderContract";
const statusSchema = z.object({
  enabled: z.boolean(),
  preferences: reminderPreferencesSchema.optional(),
});
export function pushSupported() {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}
export default function PushSettings() {
  const { profile, run, notify } = useApp();
  const [preferences, setPreferences] =
      useState<ReminderPreferences>(defaultReminders),
    [enabled, setEnabled] = useState(false),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState("Comprobando este dispositivo…");
  const supported = pushSupported();
  useEffect(() => {
    let active = true;
    if (!supported) return;
    void navigator.serviceWorker
      .getRegistration()
      .then(async (registration) => {
        const subscription = await registration?.pushManager.getSubscription();
        if (!subscription) {
          if (active)
            setStatus(
              "Todavía no activaste los recordatorios en este dispositivo.",
            );
          return;
        }
        const result = statusSchema.parse(
          await notificationRequest(profile.id, "status", {
            subscription: subscription.toJSON(),
          }),
        );
        if (!active) return;
        setEnabled(result.enabled);
        if (result.preferences) setPreferences(result.preferences);
        setStatus(
          result.enabled
            ? "Recordatorios activados en este dispositivo."
            : "La suscripción del navegador necesita volver a activarse.",
        );
      })
      .catch(() => {
        if (active)
          setStatus(
            "No pudimos comprobar los recordatorios. Conectá el servicio de análisis y volvé a intentarlo.",
          );
      });
    return () => {
      active = false;
    };
  }, [profile.id, supported]);
  async function activate() {
    setBusy(true);
    await run(async () => {
      // Permission must be requested directly from this button gesture on iOS.
      const permission = await Notification.requestPermission();
      if (permission !== "granted")
        throw new Error(
          "No se concedió permiso. Podés habilitarlo desde la configuración de notificaciones del navegador o del celular.",
        );
      const key = z
        .object({ publicKey: z.string().min(80).max(100) })
        .parse(await notificationRequest(profile.id, "config"));
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration?.active)
        throw new Error(
          "Abrí la versión publicada e instalá o actualizá NutriDuo antes de activar los recordatorios.",
        );
      if (registration.waiting || registration.installing)
        throw new Error(
          "Hay una actualización pendiente. Tocá Actualizar ahora y volvé a activar los recordatorios.",
        );
      const padding = "=".repeat((4 - (key.publicKey.length % 4)) % 4);
      const raw = atob(
        key.publicKey.replace(/-/g, "+").replace(/_/g, "/") + padding,
      );
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: Uint8Array.from(raw, (c) => c.charCodeAt(0)),
        }));
      const result = statusSchema.parse(
        await notificationRequest(profile.id, "subscribe", {
          subscription: subscription.toJSON(),
          preferences,
        }),
      );
      setEnabled(result.enabled);
      setStatus(
        "Recordatorios activados en este dispositivo. Pueden llegar con NutriDuo cerrada.",
      );
    }, "Recordatorios configurados");
    setBusy(false);
  }
  async function disable() {
    setBusy(true);
    await run(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      let remoteError = false;
      if (subscription) {
        try {
          await notificationRequest(profile.id, "unsubscribe", {
            subscription: subscription.toJSON(),
          });
        } catch {
          remoteError = true;
        }
        await subscription.unsubscribe();
      }
      setEnabled(false);
      setStatus("Recordatorios desactivados en este dispositivo.");
      if (remoteError)
        notify(
          "El navegador dejó de recibir avisos. La suscripción del servicio se eliminará cuando detecte que venció.",
        );
    }, "Recordatorios desactivados");
    setBusy(false);
  }
  return (
    <div>
      <p>
        Recordatorios amigables de comidas, movimiento y seguimiento. Se activan
        una vez por celular y pueden llegar con la app cerrada. Los mensajes no
        incluyen tu peso, objetivos ni datos del PDF.
      </p>
      {!supported ? (
        <p className="notice">
          Este navegador no ofrece notificaciones push. En iPhone, agregá
          NutriDuo a la pantalla de inicio desde Safari y abrila desde su ícono.
          En Android, usá Chrome e instalá la app.
        </p>
      ) : (
        <>
          <p role="status" className="notice">
            {status}
          </p>
          {(["meals", "movement", "strength", "weight", "report"] as const).map(
            (key, i) => (
              <label className="checkbox" key={key}>
                <input
                  type="checkbox"
                  checked={preferences[key]}
                  onChange={(e) =>
                    setPreferences({ ...preferences, [key]: e.target.checked })
                  }
                />
                {
                  [
                    "Desayuno, almuerzo, merienda y cena",
                    "Salir a caminar o trotar cada mañana",
                    "Fuerza en casa · martes y viernes",
                    "Pesaje por la mañana · opcional",
                    "Subir informe Femmto · domingos",
                  ][i]
                }
              </label>
            ),
          )}
          <p className="muted small">
            Horarios orientativos de Buenos Aires, durante el día. El aviso de
            fuerza sigue la rutina inicial de dos días; no lee tus sesiones. El
            celular puede demorar o silenciar avisos por ahorro de batería,
            falta de internet o modo concentración.
          </p>
          <div className="actions">
            <Button disabled={busy} onClick={() => void activate()}>
              {busy
                ? "Configurando…"
                : enabled
                  ? "Guardar preferencias de recordatorios"
                  : "Activar recordatorios en este celular"}
            </Button>
            <Button secondary disabled={busy} onClick={() => void disable()}>
              Desactivar en este dispositivo
            </Button>
            {enabled && (
              <Button
                secondary
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void run(async () => {
                    const subscription = await (
                      await navigator.serviceWorker.getRegistration()
                    )?.pushManager.getSubscription();
                    if (!subscription)
                      throw new Error("Volvé a activar los recordatorios.");
                    await notificationRequest(profile.id, "test", {
                      subscription: subscription.toJSON(),
                    });
                  }, "Aviso de prueba enviado. Revisá las notificaciones del celular.").finally(
                    () => setBusy(false),
                  );
                }}
              >
                Enviar aviso de prueba
              </Button>
            )}
          </div>
        </>
      )}
      <p className="muted small">
        Cloudflare guarda la dirección de notificaciones y estas preferencias
        para poder enviarte avisos. No se sincronizan los registros de salud.
        Los avisos dentro de la app se configuran por separado en Tu perfil y
        objetivos.
      </p>
    </div>
  );
}
