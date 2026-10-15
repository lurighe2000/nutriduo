import { useEffect, useRef, useState } from "react";
import { Button } from "./ui";
import { activateAppUpdate } from "../services/appUpdate";

export default function AppUpdate() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [needRefresh, setNeedRefresh] = useState(false);
  const updateAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    let mounted = true;
    let current: ServiceWorkerRegistration | undefined;
    const waiting = () => {
      if (mounted && current?.waiting && navigator.serviceWorker.controller)
        setNeedRefresh(true);
    };
    const installing = () => {
      current?.installing?.addEventListener("statechange", waiting);
    };
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, {
        scope: import.meta.env.BASE_URL,
        updateViaCache: "none",
      })
      .then((value) => {
        if (!mounted) return;
        current = value;
        setRegistration(value);
        waiting();
        installing();
        value.addEventListener("updatefound", installing);
      })
      .catch(() => {});
    return () => {
      mounted = false;
      updateAbort.current?.abort();
      current?.removeEventListener("updatefound", installing);
    };
  }, []);

  useEffect(() => {
    if (!registration) return;
    const check = () => {
      if (navigator.onLine && !document.hidden && !registration.installing)
        void registration.update().catch(() => {});
    };
    window.addEventListener("online", check);
    document.addEventListener("visibilitychange", check);
    const timer = window.setInterval(check, 60 * 60 * 1000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [registration]);

  if (!needRefresh) return null;
  return (
    <aside
      className="app-update"
      role="status"
      aria-label="Actualización disponible"
    >
      <strong>Hay una nueva versión de NutriDuo</strong>
      <p>
        Guardá lo que estés cargando antes de actualizar. Tus registros
        guardados se conservan.
      </p>
      {error && <p className="error">{error}</p>}
      <div className="actions">
        <Button
          disabled={busy}
          onClick={async () => {
            if (busy) return;
            setBusy(true);
            setError("");
            const abort = new AbortController();
            updateAbort.current = abort;
            try {
              if (!registration)
                throw new Error(
                  "Volvé a abrir la app con conexión para actualizar.",
                );
              await activateAppUpdate(registration, navigator.serviceWorker, {
                signal: abort.signal,
              });
              if (!abort.signal.aborted) location.reload();
            } catch (failure) {
              if (!abort.signal.aborted)
                setError(
                  failure instanceof Error
                    ? failure.message
                    : "No se pudo actualizar. Volvé a intentar con conexión.",
                );
            } finally {
              if (!abort.signal.aborted) setBusy(false);
            }
          }}
        >
          {busy
            ? "Actualizando…"
            : error
              ? "Reintentar actualización"
              : "Actualizar ahora"}
        </Button>
        <Button secondary disabled={busy} onClick={() => setNeedRefresh(false)}>
          Después
        </Button>
      </div>
    </aside>
  );
}
