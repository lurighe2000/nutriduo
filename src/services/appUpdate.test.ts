import { afterEach, describe, expect, it, vi } from "vitest";
import { activateAppUpdate } from "./appUpdate";

function fixture() {
  const worker = Object.assign(new EventTarget(), {
    state: "installed" as ServiceWorkerState,
    postMessage: vi.fn(),
  });
  const previous = Object.assign(new EventTarget(), { state: "activated" });
  const container = Object.assign(new EventTarget(), {
    controller: previous as unknown as ServiceWorker,
  });
  const registration = { waiting: worker, installing: null, active: previous };
  return {
    worker,
    previous,
    container,
    registration,
    start: (signal?: AbortSignal) =>
      activateAppUpdate(
        registration as unknown as ServiceWorkerRegistration,
        container as unknown as ServiceWorkerContainer,
        { timeoutMs: 1000, signal },
      ),
  };
}
afterEach(() => vi.useRealTimers());
describe("activación de actualizaciones", () => {
  it("reconoce activación aunque el navegador no avise controllerchange", async () => {
    const f = fixture();
    const pending = f.start();
    expect(f.worker.postMessage).toHaveBeenCalledWith({ type: "SKIP_WAITING" });
    f.worker.state = "activated";
    f.worker.dispatchEvent(new Event("statechange"));
    await expect(pending).resolves.toBeUndefined();
  });
  it("recupera la activación si tampoco se entregó el evento de estado", async () => {
    vi.useFakeTimers();
    const f = fixture();
    const pending = f.start();
    f.worker.state = "activated";
    await vi.advanceTimersByTimeAsync(250);
    await expect(pending).resolves.toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("un worker que ignora el mensaje termina en error y permite otro intento", async () => {
    vi.useFakeTimers();
    const f = fixture();
    const pending = expect(f.start()).rejects.toThrow("tardó más");
    await vi.advanceTimersByTimeAsync(1000);
    await pending;
    expect(vi.getTimerCount()).toBe(0);
    f.worker.postMessage.mockImplementation(() => {
      f.worker.state = "activated";
      f.worker.dispatchEvent(new Event("statechange"));
    });
    await expect(f.start()).resolves.toBeUndefined();
  });
  it("acepta una activación ya completada por otra ventana", async () => {
    const f = fixture();
    f.registration.waiting = null as unknown as typeof f.worker;
    await expect(f.start()).resolves.toBeUndefined();
  });
  it("espera a que termine la instalación antes de pedir la activación", async () => {
    const f = fixture();
    f.worker.state = "installing";
    const pending = f.start();
    expect(f.worker.postMessage).not.toHaveBeenCalled();
    f.worker.state = "installed";
    f.worker.dispatchEvent(new Event("statechange"));
    expect(f.worker.postMessage).toHaveBeenCalledOnce();
    f.worker.state = "activated";
    f.worker.dispatchEvent(new Event("statechange"));
    await pending;
  });
  it("cancela la espera al cerrar la vista sin recargarla después", async () => {
    vi.useFakeTimers();
    const f = fixture();
    const abort = new AbortController();
    const pending = f.start(abort.signal);
    abort.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(vi.getTimerCount()).toBe(0);
  });
});
