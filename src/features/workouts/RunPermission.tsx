import { Footprints, LocateFixed, MapPin, Smartphone } from "lucide-react";

/** Explains and asks for precise location (and optional motion sensors). */
export default function RunPermission({
  denied,
  motion,
  onToggleMotion,
  onAllow,
  onClose,
}: {
  denied: boolean;
  motion: boolean;
  onToggleMotion: () => void;
  onAllow: () => void;
  onClose: () => void;
}) {
  return (
    <>
      {!denied && (
        <div className="run-perm">
          <div className="run-orb">
            <span className="run-pulse" aria-hidden="true" />
            <span className="run-orb-core">
              <MapPin size={44} />
            </span>
          </div>
          <h2>Activá la ubicación precisa</h2>
          <p className="run-muted">
            Así medimos cada metro: distancia, ritmo, velocidad y tu recorrido
            en el mapa. Solo mientras salís, y queda en tu celular.
          </p>
          <div className="run-options">
            <div className="run-option">
              <LocateFixed size={22} />
              <div>
                <strong>Ubicación precisa</strong>
                <span>GPS de alta precisión · necesario</span>
              </div>
            </div>
            <div className="run-option">
              <Footprints size={22} />
              <div>
                <strong>Movimiento del celular</strong>
                <span>Cuenta tus pasos por minuto · opcional</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={motion}
                aria-label="Movimiento del celular"
                className="run-toggle"
                onClick={onToggleMotion}
              >
                <i />
              </button>
            </div>
            <div className="run-option">
              <Smartphone size={22} />
              <div>
                <strong>Pantalla encendida</strong>
                <span>Dejala prendida para no perder la señal</span>
              </div>
            </div>
          </div>
          <p className="run-muted small">
            En iPhone elegí «Permitir al usar la app» con «Ubicación exacta»
            activada.
          </p>
          <div className="run-grow" />
          <button type="button" className="run-primary" onClick={onAllow}>
            Permitir y empezar
          </button>
          <button type="button" className="run-text" onClick={onClose}>
            Ahora no
          </button>
        </div>
      )}

      {denied && (
        <div className="run-perm">
          <div className="run-orb">
            <span className="run-orb-core">
              <MapPin size={44} />
            </span>
          </div>
          <h2>Necesitamos tu ubicación</h2>
          <p className="run-muted">
            La ubicación está bloqueada para NutriDuo. Activala en los ajustes
            del navegador (Ubicación → Permitir, con ubicación exacta) y volvé a
            intentar.
          </p>
          <div className="run-grow" />
          <button type="button" className="run-primary" onClick={onAllow}>
            Volver a intentar
          </button>
          <button type="button" className="run-text" onClick={onClose}>
            Cerrar
          </button>
        </div>
      )}
    </>
  );
}
