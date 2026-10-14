import { useEffect, useRef, useState } from "react";
import { Button } from "./ui";

export default function AppUpdate() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [needRefresh, setNeedRefresh] = useState(false);
  const requestedUpdate = useRef(false);

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
    const controlled = () => {
      if (requestedUpdate.current) location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", controlled);
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
      current?.removeEventListener("updatefound", installing);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        controlled,
      );
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
          onClick={() => {
            setBusy(true);
            setError("");
            try {
              const worker = registration?.waiting;
              if (!worker) {
                location.reload();
                return;
              }
              requestedUpdate.current = true;
              worker.postMessage({ type: "SKIP_WAITING" });
            } catch {
              requestedUpdate.current = false;
              setBusy(false);
              setError("No se pudo actualizar. Volvé a intentar con conexión.");
            }
          }}
        >
          {busy ? "Actualizando…" : "Actualizar ahora"}
        </Button>
        <Button secondary disabled={busy} onClick={() => setNeedRefresh(false)}>
          Después
        </Button>
      </div>
    </aside>
  );
}
