import { useCallback, useEffect, useRef, useState } from "react";
import { motionDuration, type Motion } from "./types";

/** Timers only delimit whole gestures. CSS animates the drawn parts between them. */
export function useCartoonMotion(paused: boolean) {
  const host = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(true);
  const [hidden, setHidden] = useState(document.hidden);
  const [reduced, setReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [pose, setPose] = useState<{ name: Motion; id: number }>({
    name: "idle",
    id: 0,
  });
  const current = useRef<Motion>("idle");
  const queued = useRef<Motion | undefined>(undefined);
  const remaining = useRef(0);
  const running = !paused && !reduced && visible && !hidden;
  const enabled = useRef(running);
  enabled.current = running;
  const play = useCallback((name: Motion, interrupt = true) => {
    if (!enabled.current || name === "idle") return false;
    if (current.current !== "idle") {
      if (interrupt) queued.current = name;
      return interrupt;
    }
    current.current = name;
    remaining.current = motionDuration[name];
    setPose((previous) => ({ name, id: previous.id + 1 }));
    return true;
  }, []);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const preference = () => setReduced(media.matches);
    const visibility = () => setHidden(document.hidden);
    const observer = new IntersectionObserver(([entry]) =>
      setVisible(entry.isIntersecting),
    );
    if (host.current) observer.observe(host.current);
    media.addEventListener("change", preference);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", preference);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, []);
  useEffect(() => {
    if (!reduced) return;
    current.current = "idle";
    queued.current = undefined;
    setPose((previous) => ({ name: "idle", id: previous.id + 1 }));
  }, [reduced]);
  useEffect(() => {
    if (!running || pose.name === "idle") return;
    const start = performance.now();
    let finished = false;
    const timer = setTimeout(
      () => {
        finished = true;
        const name = queued.current ?? "idle";
        queued.current = undefined;
        current.current = name;
        remaining.current = motionDuration[name];
        setPose((previous) => ({ name, id: previous.id + 1 }));
      },
      Math.max(0, remaining.current),
    );
    return () => {
      clearTimeout(timer);
      if (!finished)
        remaining.current = Math.max(
          0,
          remaining.current - (performance.now() - start),
        );
    };
  }, [running, pose]);
  return { host, pose, play, running, reduced };
}
