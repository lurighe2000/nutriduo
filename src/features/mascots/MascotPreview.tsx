import { useState } from "react";
import CartoonCharacter from "./CartoonCharacter";
import { useCartoonMotion } from "./useCartoonMotion";
import type { Character, Motion } from "./types";
import "./mascots.css";

const LABELS: Record<Motion, string> = {
  idle: "Respirar y parpadear",
  wave: "Saludar",
  look: "Mirar alrededor",
  scratch: "Rascarse",
  nose: "Travesura de la nariz",
  point: "Señalar",
  celebrate: "Celebrar",
  sad: "Bajar las orejas",
  dance: "Bailar",
  headstand: "Ponerse de cabeza",
  reference: "Jugar con las manos",
};
function CharacterDemo({ character }: { character: Character }) {
  const [paused, setPaused] = useState(false);
  const { host, pose, play, running, reduced } = useCartoonMotion(paused);
  return (
    <>
      <div className="mascot-demo">
        <span ref={host} className="mascot-stage">
          <CartoonCharacter
            key={pose.id}
            character={character}
            motion={pose.name}
            running={running}
          />
        </span>
        <div className="mascot-stage-floor" aria-hidden="true" />
        <span className="mascot-state" role="status">
          Dibujos animados en 2D
        </span>
        <button disabled={reduced} onClick={() => setPaused(!paused)}>
          {reduced
            ? "Movimiento reducido"
            : paused
              ? "Continuar movimiento"
              : "Pausar movimiento"}
        </button>
      </div>
      <div className="mascot-motion-picker" aria-label="Movimientos">
        {(Object.entries(LABELS) as [Motion, string][])
          .filter(([motion]) =>
            character === "angel"
              ? motion !== "headstand" && motion !== "nose"
              : motion !== "reference",
          )
          .map(([motion, label]) => (
            <button
              key={motion}
              aria-pressed={pose.name === motion}
              disabled={paused || reduced}
              onClick={() => play(motion)}
            >
              {label}
            </button>
          ))}
      </div>
    </>
  );
}
export default function MascotPreview() {
  const [character, setCharacter] = useState<Character>("stitch");
  const [dark, setDark] = useState(false);
  return (
    <main className={`mascot-preview ${dark ? "is-dark" : ""} ${character}`}>
      <header>
        <a href={import.meta.env.BASE_URL}>NutriDuo</a>
        <button onClick={() => setDark(!dark)}>
          {dark ? "Modo claro" : "Modo oscuro"}
        </button>
      </header>
      <section className="mascot-preview-content">
        <div className="mascot-preview-copy">
          <h1>Compañeros de todos los días.</h1>
          <p>
            Stitch con Luca y Angel con Ari. Dibujos en 2D, expresiones y
            pequeños gestos para acompañarte.
          </p>
          <div className="mascot-profile-picker" aria-label="Personaje">
            <button
              aria-pressed={character === "stitch"}
              onClick={() => setCharacter("stitch")}
            >
              Stitch · Luca
            </button>
            <button
              aria-pressed={character === "angel"}
              onClick={() => setCharacter("angel")}
            >
              Angel · Ari
            </button>
          </div>
        </div>
        <CharacterDemo key={character} character={character} />
        <p className="mascot-preview-note">
          Podés pausar los gestos. Se respeta el movimiento reducido de tu
          celular.
        </p>
        <a
          className="mascot-credits"
          href={`${import.meta.env.BASE_URL}mascots/credits.json`}
        >
          Dibujos y créditos
        </a>
      </section>
    </main>
  );
}
