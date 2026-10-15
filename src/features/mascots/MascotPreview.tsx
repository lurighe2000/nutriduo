import { useState, type CSSProperties } from "react";
import BulldogCharacter from "./BulldogCharacter";
import { useCartoonMotion } from "./useCartoonMotion";
import type { CompanionMood } from "../../services/mascotState";
import "./mascots.css";

export default function MascotPreview() {
  const [mood, setMood] = useState<CompanionMood>("happy");
  const [pink, setPink] = useState(false);
  const [dark, setDark] = useState(false);
  const [paused, setPaused] = useState(false);
  const { host, pose, play, running, reduced } = useCartoonMotion(paused);
  return (
    <main
      className={`mascot-preview ${dark ? "is-dark" : ""} ${pink ? "angel" : ""}`}
    >
      <header>
        <a href={import.meta.env.BASE_URL}>NutriDuo</a>
        <button onClick={() => setDark(!dark)}>
          {dark ? "Modo claro" : "Modo oscuro"}
        </button>
      </header>
      <section className="mascot-preview-content">
        <div className="mascot-preview-copy">
          <h1>Tu compañero, con más personalidad.</h1>
          <p>
            Bulldog francés negro atigrado y pechito blanco, dibujado a partir
            de tus fotos. En Inicio ocupa un rincón chiquito.
          </p>
          <div className="mascot-profile-picker" aria-label="Perfil">
            <button aria-pressed={!pink} onClick={() => setPink(false)}>
              Luca
            </button>
            <button aria-pressed={pink} onClick={() => setPink(true)}>
              Ari
            </button>
          </div>
        </div>
        <div
          className="mascot-demo"
          style={
            { "--dog-accent": pink ? "#de7aa8" : "#73b8eb" } as CSSProperties
          }
        >
          <span ref={host} className="mascot-stage">
            <BulldogCharacter
              key={pose.id}
              mood={mood}
              motion={pose.name}
              running={running}
            />
          </span>
          <span className="mascot-state" role="status">
            Bulldog francés · 2D animado
          </span>
          <button disabled={reduced} onClick={() => setPaused(!paused)}>
            {reduced
              ? "Movimiento reducido"
              : paused
                ? "Continuar movimiento"
                : "Pausar movimiento"}
          </button>
        </div>
        <div className="mascot-motion-picker" aria-label="Estado de ánimo">
          {(
            [
              ["neutral", "Neutral"],
              ["happy", "Contento"],
              ["support", "Triste suave"],
              ["celebrate", "Festejando"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              aria-pressed={mood === value}
              onClick={() => setMood(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mascot-motion-picker" aria-label="Movimientos">
          {(
            [
              ["wave", "Dar la patita"],
              ["look", "Inclinar la cabeza"],
              ["scratch", "Mover las orejas"],
              ["celebrate", "Festejar"],
            ] as const
          ).map(([motion, label]) => (
            <button
              key={motion}
              disabled={paused || reduced}
              onClick={() => play(motion)}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="mascot-preview-note">
          Podés pausar los gestos. Se respeta el movimiento reducido de tu
          celular.
        </p>
      </section>
    </main>
  );
}
