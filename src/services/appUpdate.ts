/** Activate a waiting worker without depending on a single controllerchange event.
 * A silent/obsolete worker must leave the UI retryable, never busy forever.
 * Does not unregister workers or touch caches, IndexedDB, PINs or saved records.
 */
export function activateAppUpdate(
  registration: ServiceWorkerRegistration,
  container: ServiceWorkerContainer,
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<void> {
  const target = registration.waiting ?? registration.installing;
  if (options.signal?.aborted)
    return Promise.reject(
      new DOMException("Actualización cancelada", "AbortError"),
    );
  if (!target) {
    return registration.active?.state === "activated"
      ? Promise.resolve()
      : Promise.reject(
          new Error(
            "No hay una actualización lista. Volvé a abrir la app con conexión.",
          ),
        );
  }
  return new Promise((resolve, reject) => {
    const previous = container.controller;
    let sent = false;
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      clearInterval(poll);
      target.removeEventListener("statechange", check);
      container.removeEventListener("controllerchange", check);
      options.signal?.removeEventListener("abort", cancel);
      if (error) reject(error);
      else resolve();
    };
    const cancel = () =>
      finish(new DOMException("Actualización cancelada", "AbortError"));
    const check = () => {
      if (
        target.state === "activated" ||
        (container.controller !== previous &&
          container.controller?.state === "activated")
      ) {
        finish();
      } else if (target.state === "redundant") {
        finish(new Error("La actualización cambió. Volvé a intentar."));
      } else if (!sent && target.state === "installed") {
        sent = true;
        try {
          target.postMessage({ type: "SKIP_WAITING" });
        } catch {
          finish(
            new Error(
              "No se pudo iniciar la actualización. Volvé a intentar con conexión.",
            ),
          );
        }
      }
    };
    target.addEventListener("statechange", check);
    container.addEventListener("controllerchange", check);
    options.signal?.addEventListener("abort", cancel, { once: true });
    const timeout = setTimeout(() => {
      check();
      if (!settled)
        finish(
          new Error(
            "La actualización tardó más de lo esperado. Revisá tu conexión y volvé a intentar.",
          ),
        );
    }, options.timeoutMs ?? 12000);
    // Some installed browsers delay events while resuming from the background.
    const poll = setInterval(check, 250);
    check();
  });
}
