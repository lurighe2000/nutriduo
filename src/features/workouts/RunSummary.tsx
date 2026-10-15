import { lazy, Suspense, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, Share2 } from "lucide-react";
import { useDialogBack } from "../../app/navigation";
import { Celebration } from "../../components/motion";
import { niceDate } from "../../utils/date";
import {
  decodeRoute,
  distance,
  formatClock,
  formatPace,
} from "../../services/runTracker";
import RouteMap from "./RouteMap";
import RunRecovery from "./RunRecovery";
import type { DatedRun } from "./runShared";

const ShareSheet = lazy(() => import("./ShareSheet"));

function paceColors(segments: [number, number][][], splits?: number[]) {
  if (!splits || splits.length < 2) return undefined;
  const sorted = [...splits].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  let walked = 0;
  return segments.map((segment) =>
    segment.map((p, i) => {
      if (i > 0)
        walked += distance(
          { lat: segment[i - 1][0], lng: segment[i - 1][1] },
          { lat: p[0], lng: p[1] },
        );
      const pace =
        splits[Math.min(splits.length - 1, Math.floor(walked / 1000))];
      return pace < median * 0.97
        ? "var(--duo-1)"
        : pace > median * 1.03
          ? "var(--duo-3)"
          : "var(--duo-2)";
    }),
  );
}

export function RunSummary({
  run,
  title,
  subtitle,
  celebrate = false,
  onClose,
  onDelete,
}: {
  run: DatedRun;
  title: string;
  subtitle: string;
  celebrate?: boolean;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const [sharing, setSharing] = useState(false);
  const dark = document.documentElement.dataset.theme === "dark";
  const segments = run.route ? decodeRoute(run.route) : [];
  const pace = run.durationSeconds / run.distanceKm;
  const fastest = run.splits?.length ? Math.min(...run.splits) : 0;
  const slowest = run.splits?.length ? Math.max(...run.splits) : 0;
  const extras = [
    run.calories !== undefined && { label: "kcal", value: run.calories },
    run.elevation !== undefined && {
      label: "m de desnivel",
      value: run.elevation,
    },
    run.cadence !== undefined && { label: "pasos/min", value: run.cadence },
    run.heartRate !== undefined && {
      label: run.heartRateMax
        ? `lpm prom. · ${run.heartRateMax} máx.`
        : "lpm prom.",
      value: run.heartRate,
    },
    run.maxSpeed !== undefined && {
      label: "km/h máx.",
      value: run.maxSpeed.toFixed(1).replace(".", ","),
    },
  ].filter(Boolean) as { label: string; value: string | number }[];
  return (
    <div className="run-summary">
      <div className="run-top">
        <button
          type="button"
          className="run-round small"
          aria-label="Volver a Mis salidas"
          onClick={onClose}
        >
          <ChevronLeft size={22} />
        </button>
        <span className="run-muted">{subtitle}</span>
        <span className="run-top-spacer" />
      </div>
      <div className="duo-burst-anchor run-summary-head">
        <h2>{title}</h2>
        <Celebration show={celebrate} />
      </div>
      {segments.length > 0 ? (
        <RouteMap
          className="run-summary-map"
          segments={segments}
          colors={paceColors(segments, run.splits)}
          dark={dark}
          label="Recorrido de la salida coloreado por ritmo"
        />
      ) : (
        <p className="run-muted">Salida cargada a mano, sin recorrido.</p>
      )}
      <div className="run-stats">
        <div>
          <strong>{String(run.distanceKm.toFixed(2)).replace(".", ",")}</strong>
          <span>KM</span>
        </div>
        <div>
          <strong>{formatClock(run.durationSeconds)}</strong>
          <span>TIEMPO</span>
        </div>
        <div>
          <strong>{formatPace(pace)}</strong>
          <span>RITMO</span>
        </div>
      </div>
      {extras.length > 0 && (
        <p className="run-extras">
          {extras.map((e) => (
            <span key={e.label}>
              <b>{e.value}</b> {e.label}
            </span>
          ))}
        </p>
      )}
      <RunRecovery run={run} />
      {run.splits && run.splits.length > 0 && (
        <div className="run-splits">
          <span className="run-label">PARCIALES</span>
          {run.splits.map((s, i) => (
            <div className="run-split" key={i}>
              <span>Km {i + 1}</span>
              <span className="run-split-track">
                <i
                  className={s === fastest ? "fast" : ""}
                  style={{
                    width: `${slowest === fastest ? 80 : 45 + ((slowest - s) / (slowest - fastest)) * 55}%`,
                    animationDelay: `${0.3 + i * 0.08}s`,
                  }}
                />
              </span>
              <span>{formatPace(s)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="run-summary-actions">
        <button
          type="button"
          className="run-primary"
          onClick={() => setSharing(true)}
        >
          <Share2 size={18} /> Compartir
        </button>
        {onDelete && (
          <button type="button" className="run-text" onClick={onDelete}>
            Eliminar salida
          </button>
        )}
      </div>
      {sharing && (
        <Suspense fallback={null}>
          <ShareSheet run={run} onClose={() => setSharing(false)} />
        </Suspense>
      )}
    </div>
  );
}

/** A saved run, full screen, with back-button support. */
export function RunDetail({
  run,
  onClose,
  onDelete,
}: {
  run: DatedRun;
  onClose: () => void;
  onDelete: () => void;
}) {
  const close = useDialogBack(onClose);
  return createPortal(
    <div
      className="run-screen run-step-summary"
      role="dialog"
      aria-modal="true"
      aria-label="Detalle de la salida"
    >
      <RunSummary
        run={run}
        title={`${run.distanceKm.toFixed(2).replace(".", ",")} km`}
        subtitle={niceDate(run.date)}
        onClose={close}
        onDelete={onDelete}
      />
    </div>,
    document.querySelector(".app-shell") ?? document.body,
  );
}
