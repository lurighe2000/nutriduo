import { useEffect, useRef } from "react";
export type ProfileStep = "profiles" | "pin" | "setup" | "proposal";
interface GateEntry {
  session: string;
  depth: number;
  step: ProfileStep;
}
// The login/onboarding flow also gets browser history, without recording PINs.
export function useProfileBack(
  step: ProfileStep,
  restore: (step: ProfileStep) => void,
) {
  const session = useRef(crypto.randomUUID());
  const previous = useRef(step);
  const callback = useRef(restore);
  callback.current = restore;
  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      const entry: GateEntry | undefined = event.state?.nutriduoProfileStep;
      const next = entry?.session === session.current ? entry.step : "profiles";
      previous.current = next;
      callback.current(next);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    if (previous.current === step) return;
    previous.current = step;
    const current: GateEntry | undefined = history.state?.nutriduoProfileStep;
    const depth = current?.session === session.current ? current.depth : 0;
    if (step === "profiles") {
      if (depth) history.go(-depth);
      return;
    }
    history.pushState(
      {
        ...history.state,
        nutriduoProfileStep: {
          session: session.current,
          depth: depth + 1,
          step,
        },
      },
      "",
      location.href,
    );
  }, [step]);
}
