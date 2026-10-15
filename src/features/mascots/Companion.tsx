import { useEffect, useRef } from "react";
import { ArrowRight, Pause, Play } from "lucide-react";
import { useApp } from "../../app/context";
import { db } from "../../db";
import { profileSchema } from "../../schemas";
import { haptic } from "../../components/motion";
import type { companionState } from "../../services/mascotState";
import { companionGesture } from "../../services/mascotMotion";
import CartoonCharacter from "./CartoonCharacter";
import { useCartoonMotion } from "./useCartoonMotion";
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
  const paused = profile.mascotPaused ?? false;
  const { host, pose, play, running, reduced } = useCartoonMotion(paused);
  const latest = useRef(state);
  const gesture = useRef(0);
  const lastMood = useRef("");
  latest.current = state;
  useEffect(() => {
    let next = performance.now() + 8000;
    const timer = setInterval(() => {
      if (performance.now() < next) return;
      if (
        play(
          companionGesture(character, latest.current.mood, gesture.current),
          false,
        )
      ) {
        gesture.current++;
        next = performance.now() + 8000;
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [character, play]);
  useEffect(() => {
    if (paused || reduced) return;
    const reaction = `${state.mood}:${state.focus}`;
    if (
      lastMood.current !== reaction &&
      play(
        state.mood === "celebrate"
          ? "celebrate"
          : state.mood === "support"
            ? "sad"
            : state.focus === "water" || state.focus === "protein"
              ? "point"
              : "wave",
      )
    )
      lastMood.current = reaction;
  }, [paused, reduced, state.mood, state.focus, play]);
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
        disabled={paused || reduced}
        onClick={() => {
          if (play(companionGesture(character, state.mood, gesture.current))) {
            gesture.current++;
            haptic();
          }
        }}
      >
        <span ref={host} className="companion-art" data-motion={pose.name}>
          <CartoonCharacter
            key={pose.id}
            character={character}
            motion={pose.name}
            running={running}
          />
        </span>
        <span className="companion-floor" aria-hidden="true" />
      </button>
      <div className="companion-toolbar">
        <span>{name} · tu compañero</span>
        <button
          type="button"
          className="companion-pause"
          disabled={reduced}
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
          play("point");
          onFocus();
        }}
      >
        {state.action}
        <ArrowRight size={15} />
      </button>
    </section>
  );
}
