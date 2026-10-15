import { useEffect, useRef, useState } from "react";
import type { Character, Motion, ViewAngle, createCharacter } from "./renderer";
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
  reference: "Pose de referencia",
};

export default function MascotPreview() {
  const [character, setCharacter] = useState<Character>("stitch");
  const [dark, setDark] = useState(false);
  const [paused, setPaused] = useState(false);
  const [status, setStatus] = useState("Cargando el personaje…");
  const [motions, setMotions] = useState<Motion[]>([]);
  const [selected, setSelected] = useState<Motion>("idle");
  const [view, setView] = useState<ViewAngle>("front");
  const stage = useRef<HTMLDivElement>(null);
  const engine = useRef<Awaited<ReturnType<typeof createCharacter>>>(undefined);
  useEffect(() => {
    const host = stage.current!;
    const abort = new AbortController();
    const fail = () =>
      setStatus("No se pudo iniciar el visor 3D. Probá recargar esta vista.");
    host.addEventListener("mascot-error", fail);
    setStatus("Cargando el personaje…");
    setMotions([]);
    setSelected("idle");
    setPaused(false);
    setView("front");
    void import("./renderer")
      .then(({ createCharacter }) =>
        createCharacter(host, character, abort.signal, setSelected),
      )
      .then((value) => {
        if (abort.signal.aborted) {
          value.dispose();
          return;
        }
        engine.current = value;
        setMotions(value.motions as Motion[]);
        setStatus(
          value.motions.length
            ? "Listo para moverse"
            : "Escultura sin color ni animaciones",
        );
      })
      .catch((error: unknown) => {
        if (
          !abort.signal.aborted &&
          !(error instanceof DOMException && error.name === "AbortError")
        )
          fail();
      });
    return () => {
      abort.abort();
      host.removeEventListener("mascot-error", fail);
      engine.current = undefined;
    };
  }, [character]);
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
          <h1>Un compañero con personalidad.</h1>
          <p>
            Vista de trabajo. Stitch permite probar gestos. Angel muestra la
            escultura generada desde tu única imagen: todavía necesita corregir
            orejas y cara, aplicar el color y preparar las articulaciones.
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
        <div className="mascot-demo">
          <div
            ref={stage}
            className="mascot-stage"
            role="img"
            aria-label={`Vista 3D de ${character === "stitch" ? "Stitch" : "Angel"}`}
          />
          <div className="mascot-stage-floor" aria-hidden="true" />
          <span className="mascot-state" role="status">
            {status}
          </span>
          <div className="mascot-view-picker" aria-label="Ángulo del modelo">
            {(
              [
                ["front", "Frente"],
                ["threeQuarter", "Tres cuartos"],
                ["side", "Perfil"],
                ["back", "Espalda"],
              ] as const
            ).map(([angle, label]) => (
              <button
                key={angle}
                aria-pressed={view === angle}
                onClick={() => {
                  engine.current?.setView(angle);
                  setView(angle);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            disabled={!motions.length}
            onClick={() => {
              engine.current?.setPaused(!paused);
              setPaused(!paused);
            }}
          >
            {paused ? "Continuar movimiento" : "Pausar movimiento"}
          </button>
        </div>
        <div className="mascot-motion-picker" aria-label="Movimientos">
          {motions.map((motion) => (
            <button
              key={motion}
              aria-pressed={selected === motion}
              onClick={() => {
                engine.current?.play(motion);
              }}
            >
              {LABELS[motion]}
            </button>
          ))}
        </div>
        {character === "angel" && (
          <figure className="mascot-reference">
            <img
              src={`${import.meta.env.BASE_URL}mascots/angel-reference.jpg`}
              alt="Única referencia visual de Angel elegida por Luca: rosa vivo, sonrisa abierta, V blanca y antenas detrás del cuerpo"
            />
            <figcaption>Tu referencia de Angel</figcaption>
          </figure>
        )}
        <p className="mascot-preview-note">
          Los movimientos se detienen con la vista fuera de pantalla. Se respeta
          la opción de reducir movimiento del celular.
        </p>
        <a
          className="mascot-credits"
          href={`${import.meta.env.BASE_URL}mascots/credits.json`}
        >
          Modelos y créditos
        </a>
      </section>
    </main>
  );
}
