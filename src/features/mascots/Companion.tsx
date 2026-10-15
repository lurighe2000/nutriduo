import { useEffect, useRef, useState } from "react";
import { ArrowRight, Pause, Play } from "lucide-react";
import { useApp } from "../../app/context";
import { db } from "../../db";
import { profileSchema } from "../../schemas";
import {
  DuoBuddy,
  haptic,
  prefersReducedMotion,
} from "../../components/motion";
import type { companionState } from "../../services/mascotState";
import { companionGesture } from "../../services/mascotMotion";
import type { createCharacter } from "./renderer";
import "./companion.css";

type State = ReturnType<typeof companionState>;
export default function Companion({
  state,
  onFocus,
}: {
  state: State;
  onFocus: () => void;
}) {
  const { profile, run } = useApp();
  const character = profile.id === "ari" ? "angel" : "stitch";
  const name = character === "angel" ? "Angel" : "Stitch";
  const host = useRef<HTMLSpanElement>(null);
  const engine = useRef<Awaited<ReturnType<typeof createCharacter>>>(undefined);
  const latest = useRef(state);
  const lastMood = useRef("");
  const gesture = useRef(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reduced, setReduced] = useState(prefersReducedMotion);
  const paused = profile.mascotPaused ?? false;
  latest.current = state;
  const choose = () =>
    companionGesture(character, latest.current.mood, gesture.current);
  const chooseRef = useRef(choose);
  chooseRef.current = choose;
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    const element = host.current!;
    const abort = new AbortController();
    let interval: ReturnType<typeof setInterval> | undefined;
    const fail = () => {
      setFailed(true);
      setReady(false);
      engine.current?.dispose();
    };
    setReady(false);
    setFailed(false);
    lastMood.current = "";
    element.addEventListener("mascot-error", fail);
    void import("./renderer")
      .then(({ createCharacter }) =>
        createCharacter(element, character, abort.signal),
      )
      .then((value) => {
        if (abort.signal.aborted) {
          value.dispose();
          return;
        }
        engine.current = value;
        setReady(true);
        let nextGestureAt = performance.now() + 8000;
        interval = setInterval(() => {
          if (document.hidden || performance.now() < nextGestureAt) return;
          if (value.play(chooseRef.current(), false)) {
            gesture.current++;
            nextGestureAt = performance.now() + 8000;
          }
        }, 1000);
      })
      .catch(() => {
        if (!abort.signal.aborted) fail();
      });
    return () => {
      abort.abort();
      clearInterval(interval);
      element.removeEventListener("mascot-error", fail);
      engine.current = undefined;
    };
  }, [character]);
  useEffect(() => {
    if (!ready) return;
    engine.current?.setPaused(paused);
    if (paused || reduced) return;
    const reaction = `${state.mood}:${state.focus}`;
    if (lastMood.current !== reaction) {
      engine.current?.play(
        state.mood === "celebrate"
          ? "celebrate"
          : state.mood === "support"
            ? "sad"
            : state.focus === "water" || state.focus === "protein"
              ? "point"
              : "wave",
      );
      lastMood.current = reaction;
    }
  }, [ready, paused, reduced, state.mood, state.focus]);
  return (
    <section
      className="companion"
      aria-label={`Tu compañero: ${name}`}
      data-character={character}
      data-mood={state.mood}
    >
      <button
        className="companion-stage"
        aria-label={`Jugar con ${name}`}
        disabled={!ready || paused || reduced}
        onClick={() => {
          if (engine.current?.play(chooseRef.current())) {
            gesture.current++;
            haptic();
          }
        }}
      >
        <span ref={host} className="companion-canvas" aria-hidden="true" />
        {!ready && (
          <span className="companion-placeholder">
            <DuoBuddy size={88} label="" />
          </span>
        )}
        <span className="companion-floor" aria-hidden="true" />
      </button>
      <div className="companion-toolbar">
        <span>{name} · tu compañero</span>
        <button
          type="button"
          className="companion-pause"
          disabled={reduced || failed}
          aria-label={
            reduced
              ? "Movimiento reducido"
              : paused
                ? `Activar movimiento de ${name}`
                : `Pausar movimiento de ${name}`
          }
          aria-pressed={paused || reduced}
          onClick={() => {
            void run(async () =>
              db.transaction("rw", db.profiles, async () => {
                const current = await db.profiles.get(profile.id);
                if (current)
                  await db.profiles.put(
                    profileSchema.parse({ ...current, mascotPaused: !paused }),
                  );
              }),
            );
          }}
        >
          {paused || reduced ? <Play size={15} /> : <Pause size={15} />}
        </button>
      </div>
      <p className="companion-message">{state.message}</p>
      <button
        className="text-button companion-focus"
        onClick={() => {
          engine.current?.play("point");
          onFocus();
        }}
      >
        {state.action}
        <ArrowRight size={15} />
      </button>
      {failed && (
        <small className="companion-fallback">
          La vista 3D no está disponible en este navegador.
        </small>
      )}
    </section>
  );
}
