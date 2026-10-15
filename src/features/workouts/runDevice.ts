import { useEffect, useState } from "react";

export function speak(text: string, enabled: boolean) {
  if (!enabled || !("speechSynthesis" in window)) return;
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-AR";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  } catch {
    // Voice is a nicety.
  }
}

export function spokenPace(seconds: number) {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)} minutos ${s % 60} segundos por kilómetro`;
}

export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | undefined;
    let alive = true;
    const acquire = async () => {
      try {
        const next = await navigator.wakeLock.request("screen");
        if (alive) lock = next;
        else void next.release();
      } catch {
        // Battery saver or unsupported: the screen may turn off.
      }
    };
    void acquire();
    const visible = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", visible);
      void lock?.release().catch(() => {});
    };
  }, [active]);
}

/** Steps per minute from the phone's accelerometer (no extra permission on Android). */
export function useCadence(active: boolean) {
  const [cadence, setCadence] = useState<number>();
  useEffect(() => {
    if (!active || !("DeviceMotionEvent" in window)) return;
    const steps: number[] = [];
    let average = 9.8;
    let above = false;
    let lastStep = 0;
    const onMotion = (event: DeviceMotionEvent) => {
      const a = event.accelerationIncludingGravity;
      if (!a || a.x == null || a.y == null || a.z == null) return;
      const magnitude = Math.hypot(a.x, a.y, a.z);
      average = average * 0.95 + magnitude * 0.05;
      const now = performance.now();
      if (!above && magnitude > average + 1.6 && now - lastStep > 250) {
        above = true;
        lastStep = now;
        steps.push(now);
      } else if (above && magnitude < average) above = false;
    };
    const timer = window.setInterval(() => {
      const now = performance.now();
      while (steps.length && now - steps[0] > 15_000) steps.shift();
      setCadence(steps.length >= 20 ? steps.length * 4 : undefined);
    }, 3000);
    window.addEventListener("devicemotion", onMotion);
    return () => {
      window.removeEventListener("devicemotion", onMotion);
      window.clearInterval(timer);
    };
  }, [active]);
  return cadence;
}

type MotionPermission = { requestPermission?: () => Promise<string> };
/** iPhone asks for motion access; it must be called from a tap. */
export function askMotionPermission() {
  const request = (
    window.DeviceMotionEvent as unknown as MotionPermission | undefined
  )?.requestPermission;
  if (typeof request === "function") void request().catch(() => {});
}
