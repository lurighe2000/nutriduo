import { useState } from "react";
import { Footprints, Play, Volume2, VolumeX } from "lucide-react";
import { useApp } from "../../app/context";
import { haptic } from "../../components/motion";
import { Confirm } from "../../components/ui";
import { niceDate, rangeDates, today } from "../../utils/date";
import {
  decodeRoute,
  formatClock,
  type RunKind,
  type RunSnapshot,
} from "../../services/runTracker";
import RunScreen, {
  RunDetail,
  askMotionPermission,
  clearSnapshot,
  readSnapshot,
  type DatedRun,
} from "./RunScreen";

const WEEK_GOAL_KM = 20;
const KINDS: { kind: RunKind; label: string; start: string }[] = [
  { kind: "Carrera", label: "Correr", start: "Salir a correr" },
  { kind: "Caminata y trote", label: "Trotar", start: "Salir a trotar" },
  { kind: "Caminata", label: "Caminar", start: "Salir a caminar" },
];
const PREFS = "nutriduo-run-prefs";

function readPrefs(): { kind: RunKind; voice: boolean } {
  try {
    const v = JSON.parse(localStorage.getItem(PREFS) ?? "null");
    if (v && KINDS.some((k) => k.kind === v.kind))
      return { kind: v.kind, voice: v.voice !== false };
  } catch {
    // Defaults below.
  }
  return { kind: "Carrera", voice: true };
}
function savePrefs(prefs: { kind: RunKind; voice: boolean }) {
  try {
    localStorage.setItem(PREFS, JSON.stringify(prefs));
  } catch {
    // Ignore.
  }
}

function RouteThumb({ route }: { route?: string }) {
  const points = route ? decodeRoute(route).flat() : [];
  if (points.length < 2)
    return (
      <span className="run-thumb empty" aria-hidden="true">
        <Footprints size={20} />
      </span>
    );
  const lats = points.map((p) => p[0]);
  const lngs = points.map((p) => p[1]);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const scaleX = Math.cos((minLat * Math.PI) / 180);
  const w = (maxLng - minLng) * scaleX || 1e-6;
  const h = maxLat - minLat || 1e-6;
  const k = Math.min(40 / w, 32 / h);
  const line = points
    .map(
      ([lat, lng]) =>
        `${(6 + (40 - w * k) / 2 + (lng - minLng) * scaleX * k).toFixed(1)},${(6 + (32 - h * k) / 2 + (maxLat - lat) * k).toFixed(1)}`,
    )
    .join(" ");
  return (
    <svg className="run-thumb" viewBox="0 0 52 44" aria-hidden="true">
      <polyline points={line} />
    </svg>
  );
}

export default function MySalidas({ onManual }: { onManual: () => void }) {
  const { profile, data, repo, run } = useApp();
  const [prefs, setPrefs] = useState(readPrefs);
  const [open, setOpen] = useState<{ resume?: RunSnapshot }>();
  const [viewing, setViewing] = useState<DatedRun>();
  const [removing, setRemoving] = useState<DatedRun>();
  const pending = open ? undefined : readSnapshot(profile.id);
  const week = new Set(rangeDates(today(), 7));
  const weekRuns = data.activity
    .filter((a) => week.has(a.date))
    .flatMap((a) => a.runs ?? []);
  const weekKm = weekRuns.reduce((sum, r) => sum + r.distanceKm, 0);
  const progress = Math.min(1, weekKm / WEEK_GOAL_KM);
  const recent = data.activity
    .flatMap((a) => (a.runs ?? []).map((r) => ({ ...r, date: a.date })))
    .sort((a, b) =>
      (b.startedAt ?? b.date).localeCompare(a.startedAt ?? a.date),
    )
    .slice(0, 3);
  const current = KINDS.find((k) => k.kind === prefs.kind) ?? KINDS[0];
  const update = (next: Partial<typeof prefs>) => {
    const value = { ...prefs, ...next };
    setPrefs(value);
    savePrefs(value);
  };

  return (
    <section className="my-runs" aria-labelledby="my-runs-title">
      <div className="my-runs-head">
        <h2 id="my-runs-title">Mis salidas</h2>
        <button type="button" className="run-text small" onClick={onManual}>
          Cargar a mano
        </button>
      </div>

      <div className="my-runs-week">
        <svg viewBox="0 0 112 112" aria-hidden="true">
          <circle className="track" cx="56" cy="56" r="48" />
          <circle
            className="fill"
            cx="56"
            cy="56"
            r="48"
            style={{ strokeDashoffset: 301.6 * (1 - progress) }}
          />
        </svg>
        <div>
          <span className="run-label">ESTA SEMANA</span>
          <strong className="run-gradient">
            {weekKm.toFixed(1).replace(".", ",")} km
          </strong>
          <span className="run-muted">
            de {WEEK_GOAL_KM} km · {weekRuns.length}{" "}
            {weekRuns.length === 1 ? "salida" : "salidas"}
          </span>
        </div>
      </div>

      {pending && (
        <div className="my-runs-resume" role="status">
          <span>
            Tenés una salida sin terminar ·{" "}
            {(pending.distance / 1000).toFixed(2).replace(".", ",")} km
          </span>
          <div>
            <button
              type="button"
              className="run-text small"
              onClick={() => {
                clearSnapshot(profile.id);
                setPrefs({ ...prefs });
              }}
            >
              Descartar
            </button>
            <button
              type="button"
              className="run-primary small"
              onClick={() => setOpen({ resume: pending })}
            >
              Seguir
            </button>
          </div>
        </div>
      )}

      <div className="my-runs-start">
        <div className="run-segmented" role="group" aria-label="Tipo de salida">
          {KINDS.map((k) => (
            <button
              type="button"
              key={k.kind}
              aria-pressed={k.kind === prefs.kind}
              onClick={() => update({ kind: k.kind })}
            >
              {k.label}
            </button>
          ))}
        </div>
        <div className="run-start-wrap">
          <span className="run-pulse" aria-hidden="true" />
          <button
            type="button"
            className="run-start"
            onClick={() => {
              haptic(15);
              askMotionPermission();
              setOpen({});
            }}
          >
            <Play size={34} fill="currentColor" />
            <span>{current.start}</span>
          </button>
        </div>
        <button
          type="button"
          className={`run-voice ${prefs.voice ? "on" : ""}`}
          aria-pressed={prefs.voice}
          onClick={() => update({ voice: !prefs.voice })}
        >
          {prefs.voice ? <Volume2 size={16} /> : <VolumeX size={16} />}
          {prefs.voice ? "Voz cada 1 km" : "Voz apagada"}
        </button>
      </div>

      {recent.length > 0 && (
        <div className="my-runs-list">
          {recent.map((r) => (
            <button
              type="button"
              key={r.id}
              className="my-runs-item"
              onClick={() => setViewing(r)}
            >
              <RouteThumb route={r.route} />
              <span>
                <small>
                  {niceDate(r.date, true)} · {r.kind}
                </small>
                <strong>
                  {r.distanceKm.toFixed(2).replace(".", ",")} km ·{" "}
                  {formatClock(r.durationSeconds)}
                </strong>
              </span>
            </button>
          ))}
        </div>
      )}

      {open && (
        <RunScreen
          kind={prefs.kind}
          voice={prefs.voice}
          resume={open.resume}
          onClose={() => setOpen(undefined)}
        />
      )}
      {viewing && (
        <RunDetail
          run={viewing}
          onClose={() => setViewing(undefined)}
          onDelete={() => setRemoving(viewing)}
        />
      )}
      {removing && (
        <Confirm
          title="¿Eliminar esta salida?"
          onClose={() => setRemoving(undefined)}
          onConfirm={() => {
            const record = data.activity.find((a) => a.date === removing.date);
            if (!record) return;
            void run(
              () =>
                repo.save("activity", {
                  ...record,
                  runs: (record.runs ?? []).filter((x) => x.id !== removing.id),
                }),
              "Salida eliminada",
            ).then((ok) => {
              if (ok) {
                setRemoving(undefined);
                setViewing(undefined);
              }
            });
          }}
        >
          Se borra la salida y su recorrido.
        </Confirm>
      )}
    </section>
  );
}
