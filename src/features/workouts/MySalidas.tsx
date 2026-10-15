import { useRef, useState } from "react";
import {
  Footprints,
  Heart,
  Minus,
  Play,
  Plus,
  Upload,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useApp } from "../../app/context";
import { meta } from "../../db";
import { activitySchema } from "../../schemas";
import { Celebration, haptic } from "../../components/motion";
import { Button, Confirm, Modal } from "../../components/ui";
import { localDate, niceDate, rangeDates, today } from "../../utils/date";
import { importRunFiles, type ImportedRun } from "../../services/runImport";
import {
  connectHeartRate,
  disconnectHeartRate,
  heartRateSupported,
  useHeartRate,
} from "../../services/heartRate";
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

const DEFAULT_GOAL_KM = 20;
const goalKey = (profileId: string) => `nutriduo-run-goal-${profileId}`;
function readGoal(profileId: string) {
  try {
    const v = Number(localStorage.getItem(goalKey(profileId)));
    if (v >= 1 && v <= 300) return v;
  } catch {
    // Default below.
  }
  return DEFAULT_GOAL_KM;
}
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
  const { profile, data, repo, run, notify } = useApp();
  const [prefs, setPrefs] = useState(readPrefs);
  const [goal, setGoal] = useState(() => readGoal(profile.id));
  const [editingGoal, setEditingGoal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const heart = useHeartRate();
  const [open, setOpen] = useState<{ resume?: RunSnapshot }>();
  const [viewing, setViewing] = useState<DatedRun>();
  const [removing, setRemoving] = useState<DatedRun>();
  const pending = open ? undefined : readSnapshot(profile.id);
  const week = new Set(rangeDates(today(), 7));
  const weekRuns = data.activity
    .filter((a) => week.has(a.date))
    .flatMap((a) => a.runs ?? []);
  const weekKm = weekRuns.reduce((sum, r) => sum + r.distanceKm, 0);
  const progress = Math.min(1, weekKm / goal);
  const reached = weekKm >= goal && weekKm > 0;
  // Suggested goal: last four weeks' average plus 10 %.
  const fourWeeks = new Set(rangeDates(today(), 28));
  const monthKm = data.activity
    .filter((a) => fourWeeks.has(a.date))
    .flatMap((a) => a.runs ?? [])
    .reduce((sum, r) => sum + r.distanceKm, 0);
  const suggested = Math.max(5, Math.round((monthKm / 4) * 1.1));
  const changeGoal = (value: number) => {
    const next = Math.max(1, Math.min(300, Math.round(value)));
    setGoal(next);
    haptic(6);
    try {
      localStorage.setItem(goalKey(profile.id), String(next));
    } catch {
      // Ignore.
    }
  };

  async function saveImported(list: ImportedRun[], skipped: number) {
    const existing = data.activity.flatMap((a) =>
      (a.runs ?? []).map((r) => ({ ...r, date: a.date })),
    );
    const fresh = list.filter(
      (i) =>
        !existing.some(
          (r) =>
            (r.startedAt &&
              Math.abs(Date.parse(r.startedAt) - i.startedAt) < 120_000) ||
            (r.date === localDate(new Date(i.startedAt)) &&
              Math.abs(r.distanceKm - i.distanceKm) < 0.05 &&
              Math.abs(r.durationSeconds - i.durationSeconds) < 90),
        ),
    );
    const byDate = new Map<string, ImportedRun[]>();
    for (const i of fresh) {
      const date = localDate(new Date(i.startedAt));
      byDate.set(date, [...(byDate.get(date) ?? []), i]);
    }
    let saved = 0;
    const ok = await run(async () => {
      for (const [date, items] of byDate) {
        const record = data.activity.find((a) => a.date === date);
        const runs = items.map((i) => ({
          id: crypto.randomUUID(),
          kind: i.kind,
          distanceKm: i.distanceKm,
          durationSeconds: i.durationSeconds,
          calories: i.calories,
          maxSpeed: i.maxSpeed && i.maxSpeed <= 100 ? i.maxSpeed : undefined,
          elevation: i.elevation,
          heartRate:
            i.heartRate && i.heartRate >= 30 && i.heartRate <= 240
              ? i.heartRate
              : undefined,
          heartRateMax:
            i.heartRateMax && i.heartRateMax >= 30 && i.heartRateMax <= 250
              ? i.heartRateMax
              : undefined,
          source: i.source,
          notes: "",
          route: i.route,
          splits: i.splits?.every((x) => x <= 7200) ? i.splits : undefined,
          startedAt: new Date(i.startedAt).toISOString(),
        }));
        const next = activitySchema.safeParse({
          ...(record ?? meta(profile.id)),
          date,
          steps: record?.steps ?? 0,
          padel: record?.padel ?? false,
          runs: [...(record?.runs ?? []), ...runs].slice(-20),
        });
        if (!next.success) continue;
        await repo.save("activity", next.data);
        saved += runs.length;
      }
    });
    if (!ok) return;
    const repeated = list.length - fresh.length;
    notify(
      saved
        ? `Importé ${saved} ${saved === 1 ? "salida" : "salidas"}${repeated ? ` · ${repeated} ya estaban` : ""}`
        : repeated
          ? "Esas salidas ya estaban en NutriDuo"
          : `No encontré salidas para importar${skipped ? " (solo caminatas y carreras)" : ""}`,
    );
    if (saved) setImporting(false);
  }
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

      <button
        type="button"
        className={`my-runs-week duo-burst-anchor ${reached ? "reached" : ""}`}
        aria-expanded={editingGoal}
        aria-label={`Meta semanal: ${weekKm.toFixed(1)} de ${goal} km. Tocá para cambiarla`}
        onClick={() => setEditingGoal((v) => !v)}
      >
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
            {reached
              ? "¡Meta cumplida!"
              : `de ${goal} km · ${weekRuns.length} ${weekRuns.length === 1 ? "salida" : "salidas"}`}
          </span>
        </div>
        <Celebration show={reached} />
      </button>
      {editingGoal && (
        <div className="my-runs-goal">
          <span className="run-label">META SEMANAL</span>
          <div className="my-runs-goal-row">
            <button
              type="button"
              className="run-round small"
              aria-label="Bajar la meta"
              onClick={() => changeGoal(goal - 1)}
            >
              <Minus size={18} />
            </button>
            <strong>{goal} km</strong>
            <button
              type="button"
              className="run-round small"
              aria-label="Subir la meta"
              onClick={() => changeGoal(goal + 1)}
            >
              <Plus size={18} />
            </button>
          </div>
          {suggested !== goal && (
            <button
              type="button"
              className="run-voice on"
              onClick={() => changeGoal(suggested)}
            >
              Sugerida para vos: {suggested} km
            </button>
          )}
        </div>
      )}

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
        {heartRateSupported() && (
          <div className="run-heart-link">
            <button
              type="button"
              className={`run-voice ${heart.status === "on" ? "on" : ""}`}
              disabled={heart.status === "connecting"}
              onClick={() => {
                if (heart.status === "on" || heart.status === "lost") {
                  disconnectHeartRate();
                  return;
                }
                void connectHeartRate().catch((error: Error) => {
                  if (error.name !== "NotFoundError")
                    notify("No pude conectar el pulsómetro. Probá de nuevo.");
                });
              }}
            >
              <Heart
                size={16}
                fill={heart.status === "on" ? "currentColor" : "none"}
              />
              {heart.status === "on"
                ? `${heart.bpm ?? "--"} lpm · ${heart.name ?? "Pulsómetro"}`
                : heart.status === "lost"
                  ? "Reconectando pulsómetro…"
                  : heart.status === "connecting"
                    ? "Buscando pulsómetro…"
                    : "Conectar pulsómetro"}
            </button>
            {heart.status === "off" && (
              <span className="run-muted small">
                Galaxy Watch: abrí en el reloj una app que comparta el pulso por
                Bluetooth.
              </span>
            )}
          </div>
        )}
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

      <button
        type="button"
        className="my-runs-import"
        onClick={() => setImporting(true)}
      >
        <Upload size={18} />
        Importar salidas de adidas Running o GPX
      </button>
      {importing && (
        <Modal title="Importar salidas" onClose={() => setImporting(false)}>
          <ol className="my-runs-steps">
            <li>
              En la web de adidas Running entrá a tu cuenta y pedí la
              exportación de tus datos (está en la configuración de la cuenta o
              en privacidad).
            </li>
            <li>Te llega un mail con un archivo .zip: descargalo.</li>
            <li>Elegilo acá. Traigo cada salida con su recorrido.</li>
          </ol>
          <p className="muted small">
            También sirven archivos .gpx de Strava, Samsung Health, Garmin u
            otras apps. Las salidas repetidas no se duplican.
          </p>
          <div className="actions">
            <Button
              disabled={importBusy}
              onClick={() => fileInput.current?.click()}
            >
              {importBusy ? "Importando…" : "Elegir archivo"}
            </Button>
          </div>
          <input
            ref={fileInput}
            type="file"
            hidden
            multiple
            accept=".zip,.gpx,.json,application/zip,application/gpx+xml,application/json"
            aria-label="Archivo de salidas"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              if (!files.length) return;
              setImportBusy(true);
              void importRunFiles(files)
                .then((result) => saveImported(result.runs, result.skipped))
                .catch(() =>
                  notify(
                    "No pude leer ese archivo. Probá con el .zip o un .gpx.",
                  ),
                )
                .finally(() => setImportBusy(false));
            }}
          />
        </Modal>
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
