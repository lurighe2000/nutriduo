import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  Footprints,
  Heart,
  LocateFixed,
  MapPin,
  Pause,
  Play,
  Share2,
  Smartphone,
  Square,
  Volume2,
} from "lucide-react";
import { useApp } from "../../app/context";
import { useDialogBack } from "../../app/navigation";
import { meta } from "../../db";
import { activitySchema, type Records } from "../../schemas";
import { Celebration, haptic } from "../../components/motion";
import { localDate, niceDate } from "../../utils/date";
import {
  RunSession,
  calories,
  decodeRoute,
  distance,
  encodeRoute,
  formatClock,
  formatKm,
  formatPace,
  routeSegments,
  type RunKind,
  type RunSnapshot,
} from "../../services/runTracker";
import RouteMap from "./RouteMap";
import ShareSheet from "./ShareSheet";
import { useHeartRate } from "../../services/heartRate";

export type Run = NonNullable<Records["activity"]["runs"]>[number];
export type DatedRun = Run & { date: string };
type Step = "perm" | "denied" | "count" | "live" | "short" | "summary";

const SNAPSHOT_TTL = 6 * 60 * 60 * 1000;
const snapshotKey = (profileId: string) => `nutriduo-run-${profileId}`;

export function readSnapshot(profileId: string): RunSnapshot | undefined {
  try {
    const value = JSON.parse(
      localStorage.getItem(snapshotKey(profileId)) ?? "null",
    ) as RunSnapshot | null;
    if (value && Date.now() - value.savedAt < SNAPSHOT_TTL) return value;
  } catch {
    // Storage unavailable or corrupt: nothing to resume.
  }
  return undefined;
}
export function clearSnapshot(profileId: string) {
  try {
    localStorage.removeItem(snapshotKey(profileId));
  } catch {
    // Ignore.
  }
}
function writeSnapshot(profileId: string, snapshot: RunSnapshot) {
  try {
    localStorage.setItem(snapshotKey(profileId), JSON.stringify(snapshot));
  } catch {
    // Ignore: the run still works, it just cannot be resumed after a reload.
  }
}

export const kindVerb: Record<RunKind, string> = {
  Carrera: "correr",
  "Caminata y trote": "trotar",
  Caminata: "caminar",
};

function speak(text: string, enabled: boolean) {
  if (!enabled || !("speechSynthesis" in window)) return;
  try {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-AR";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  } catch {
    // Voice is a nicety.
  }
}

function spokenPace(seconds: number) {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)} minutos ${s % 60} segundos por kilómetro`;
}

function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | undefined;
    let alive = true;
    const acquire = async () => {
      try {
        const next = await navigator.wakeLock.request("screen");
        if (alive) lock = next;
        else void next.release();
      } catch {
        // Battery saver or unsupported: the screen may turn off.
      }
    };
    void acquire();
    const visible = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", visible);
      void lock?.release().catch(() => {});
    };
  }, [active]);
}

/** Steps per minute from the phone's accelerometer (no extra permission on Android). */
function useCadence(active: boolean) {
  const [cadence, setCadence] = useState<number>();
  useEffect(() => {
    if (!active || !("DeviceMotionEvent" in window)) return;
    const steps: number[] = [];
    let average = 9.8;
    let above = false;
    let lastStep = 0;
    const onMotion = (event: DeviceMotionEvent) => {
      const a = event.accelerationIncludingGravity;
      if (!a || a.x == null || a.y == null || a.z == null) return;
      const magnitude = Math.hypot(a.x, a.y, a.z);
      average = average * 0.95 + magnitude * 0.05;
      const now = performance.now();
      if (!above && magnitude > average + 1.6 && now - lastStep > 250) {
        above = true;
        lastStep = now;
        steps.push(now);
      } else if (above && magnitude < average) above = false;
    };
    const timer = window.setInterval(() => {
      const now = performance.now();
      while (steps.length && now - steps[0] > 15_000) steps.shift();
      setCadence(steps.length >= 20 ? steps.length * 4 : undefined);
    }, 3000);
    window.addEventListener("devicemotion", onMotion);
    return () => {
      window.removeEventListener("devicemotion", onMotion);
      window.clearInterval(timer);
    };
  }, [active]);
  return cadence;
}

type MotionPermission = { requestPermission?: () => Promise<string> };
/** iPhone asks for motion access; it must be called from a tap. */
export function askMotionPermission() {
  const request = (
    window.DeviceMotionEvent as unknown as MotionPermission | undefined
  )?.requestPermission;
  if (typeof request === "function") void request().catch(() => {});
}

function latestWeight(weights: Records["weights"][]) {
  return [...weights].sort((a, b) => b.date.localeCompare(a.date))[0]?.kg;
}

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
      {sharing && <ShareSheet run={run} onClose={() => setSharing(false)} />}
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

export default function RunScreen({
  kind,
  voice,
  resume,
  onClose,
}: {
  kind: RunKind;
  voice: boolean;
  resume?: RunSnapshot;
  onClose: () => void;
}) {
  const { profile, data, repo, run, notify } = useApp();
  const runKind = resume?.kind ?? kind;
  const [step, setStep] = useState<Step>(resume ? "live" : "perm");
  const [count, setCount] = useState(3);
  const [motion, setMotion] = useState(true);
  const [accuracy, setAccuracy] = useState<number>();
  const [here, setHere] = useState<[number, number]>();
  const [cue, setCue] = useState("");
  const [saved, setSaved] = useState<DatedRun>();
  const [busy, setBusy] = useState(false);
  const [, setVersion] = useState(0);
  const session = useRef<RunSession | undefined>(
    resume ? RunSession.restore(resume, Date.now()) : undefined,
  );
  const cadences = useRef<number[]>([]);
  const beats = useRef<number[]>([]);
  const heart = useHeartRate();
  const bpm = heart.status === "on" ? heart.bpm : undefined;
  const bpmRef = useRef(bpm);
  useEffect(() => {
    bpmRef.current = bpm;
    const s = session.current;
    if (bpm && step === "live" && s && !s.paused && !s.autoPaused)
      beats.current.push(bpm);
  }, [bpm, step]);
  const tracking = step === "count" || step === "live";
  const cadence = useCadence(step === "live" && motion);
  useWakeLock(tracking);

  const persist = () => {
    const s = session.current;
    if (s && s.distance > 0) writeSnapshot(profile.id, s.snapshot(Date.now()));
  };
  const close = useDialogBack(() => {
    if (step === "live") {
      session.current?.pause(Date.now());
      persist();
    }
    onClose();
  });

  // Skip the explanation when location is already allowed.
  useEffect(() => {
    if (resume || !navigator.permissions?.query) return;
    void navigator.permissions
      .query({ name: "geolocation" })
      .then((status) => {
        if (status.state === "granted")
          setStep((s) => (s === "perm" ? "count" : s));
      })
      .catch(() => {});
  }, [resume]);

  useEffect(() => {
    if (!tracking || !("geolocation" in navigator)) return;
    const watch = navigator.geolocation.watchPosition(
      (position) => {
        const c = position.coords;
        setAccuracy(Math.round(c.accuracy));
        setHere([c.latitude, c.longitude]);
        const s = session.current;
        const before = s?.splits.length ?? 0;
        if (
          s?.addFix({
            lat: c.latitude,
            lng: c.longitude,
            accuracy: c.accuracy,
            altitude: c.altitude,
            altitudeAccuracy: c.altitudeAccuracy,
            time: Date.now(),
          }) &&
          s.splits.length > before
        ) {
          const km = s.splits.length;
          const last = s.splits[km - 1];
          setCue(`Km ${km} · ${formatPace(last)} /km`);
          const pulse = bpmRef.current;
          speak(
            `Kilómetro ${km}. ${spokenPace(last)}.${pulse ? ` Pulso ${pulse}.` : ""}`,
            voice,
          );
          haptic([30, 60, 30]);
        }
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) setStep("denied");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [tracking, voice]);

  useEffect(() => {
    if (step !== "count") return;
    if (count <= 0) {
      session.current = new RunSession(runKind, Date.now());
      speak("Arrancamos", voice);
      haptic(40);
      setStep("live");
      return;
    }
    const t = window.setTimeout(() => setCount((n) => n - 1), 850);
    return () => window.clearTimeout(t);
  }, [step, count, runKind, voice]);

  useEffect(() => {
    if (step !== "live") return;
    let ticks = 0;
    let wasAuto = false;
    const timer = window.setInterval(() => {
      const s = session.current;
      if (!s) return;
      s.tick(Date.now());
      if (s.autoPaused !== wasAuto) {
        wasAuto = s.autoPaused;
        speak(wasAuto ? "Pausa automática" : "Seguimos", voice);
      }
      if (++ticks % 5 === 0) persist();
      setVersion((v) => v + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [step, voice]);

  useEffect(() => {
    if (cadence) cadences.current.push(cadence);
  }, [cadence]);

  useEffect(() => {
    if (!cue) return;
    const t = window.setTimeout(() => setCue(""), 3200);
    return () => window.clearTimeout(t);
  }, [cue]);

  function allow() {
    if (motion) askMotionPermission();
    if (!("geolocation" in navigator)) {
      setStep("denied");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => setStep("count"),
      (error) =>
        setStep(error.code === error.PERMISSION_DENIED ? "denied" : "count"),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }

  async function finish() {
    const s = session.current;
    if (!s || busy) return;
    s.pause(Date.now());
    if (s.distance < 50) {
      setStep("short");
      return;
    }
    setBusy(true);
    const km = Math.round(s.distance / 10) / 100;
    let route = "";
    for (const minMeters of [5, 10, 20, 40]) {
      route = encodeRoute(routeSegments(s.points, minMeters));
      if (route.length <= 80000) break;
    }
    const steps = cadences.current;
    const averageCadence = steps.length
      ? Math.round(steps.reduce((a, b) => a + b, 0) / steps.length)
      : undefined;
    const entry: Run = {
      id: crypto.randomUUID(),
      kind: runKind,
      distanceKm: km,
      durationSeconds: Math.max(1, Math.round(s.seconds)),
      calories: calories(runKind, km, latestWeight(data.weights)),
      maxSpeed: s.maxSpeed ? Math.round(s.maxSpeed * 10) / 10 : undefined,
      elevation: s.elevationGain ? Math.round(s.elevationGain) : undefined,
      source: "NutriDuo GPS",
      notes: "",
      route: route.length <= 80000 ? route : undefined,
      splits: s.splits.length ? s.splits : undefined,
      cadence:
        averageCadence && averageCadence >= 30 && averageCadence <= 260
          ? averageCadence
          : undefined,
      startedAt: new Date(s.startedAt).toISOString(),
      heartRate: beats.current.length
        ? Math.round(
            beats.current.reduce((a, b) => a + b, 0) / beats.current.length,
          )
        : undefined,
      heartRateMax: beats.current.length
        ? Math.max(...beats.current)
        : undefined,
    };
    const date = localDate(new Date(s.startedAt));
    const record = data.activity.find((a) => a.date === date);
    const next = activitySchema.safeParse({
      ...(record ?? meta(profile.id)),
      date,
      steps: record?.steps ?? 0,
      padel: record?.padel ?? false,
      runs: [...(record?.runs ?? []), entry].slice(-20),
    });
    if (!next.success) {
      setBusy(false);
      notify("No se pudo guardar la salida. Probá de nuevo.");
      return;
    }
    const ok = await run(
      () => repo.save("activity", next.data),
      "Salida guardada",
    );
    setBusy(false);
    if (!ok) return;
    clearSnapshot(profile.id);
    haptic([20, 40, 20, 40, 60]);
    speak(`Listo. ${String(km).replace(".", ",")} kilómetros.`, voice);
    setSaved({ ...entry, date });
    setStep("summary");
  }

  const s = session.current;
  const dark = document.documentElement.dataset.theme === "dark";
  const status = !s
    ? ""
    : s.paused
      ? "En pausa"
      : s.autoPaused
        ? "Pausa automática"
        : kindVerb[runKind] === "caminar"
          ? "Caminando"
          : kindVerb[runKind] === "trotar"
            ? "Trotando"
            : "Corriendo";
  const host = document.querySelector(".app-shell") ?? document.body;

  return createPortal(
    <div
      className={`run-screen run-step-${step}`}
      role="dialog"
      aria-modal="true"
      aria-label="Salida con GPS"
    >
      {step === "perm" && (
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
                onClick={() => setMotion((m) => !m)}
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
          <button type="button" className="run-primary" onClick={allow}>
            Permitir y empezar
          </button>
          <button type="button" className="run-text" onClick={close}>
            Ahora no
          </button>
        </div>
      )}

      {step === "denied" && (
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
          <button type="button" className="run-primary" onClick={allow}>
            Volver a intentar
          </button>
          <button type="button" className="run-text" onClick={close}>
            Cerrar
          </button>
        </div>
      )}

      {step === "count" && (
        <div className="run-count">
          <Footprints size={52} className="run-runner" />
          <span key={count} className="run-count-number">
            {count > 0 ? count : "¡Ya!"}
          </span>
          <span className="run-count-gps">
            {accuracy === undefined
              ? "Buscando señal GPS…"
              : `Señal GPS ±${accuracy} m`}
          </span>
          <button type="button" className="run-ghost" onClick={close}>
            Cancelar
          </button>
        </div>
      )}

      {(step === "live" || step === "short") && s && (
        <div className="run-live">
          <div className="run-live-map">
            <RouteMap
              segments={routeSegments(s.points, 3)}
              current={
                here ??
                (s.points.at(-1)
                  ? [s.points.at(-1)!.lat, s.points.at(-1)!.lng]
                  : undefined)
              }
              follow
              dark={dark}
              label="Mapa con tu recorrido en vivo"
            />
            <div className="run-chips">
              <span
                className={`run-chip ${accuracy !== undefined && accuracy <= 15 ? "good" : ""}`}
              >
                <i />
                {accuracy === undefined ? "Buscando GPS" : `GPS ±${accuracy} m`}
              </span>
              <span
                className={`run-chip ${s.paused || s.autoPaused ? "paused" : ""}`}
              >
                {status}
              </span>
            </div>
            {cue && (
              <div className="run-cue" role="status">
                <Volume2 size={18} />
                {cue}
              </div>
            )}
          </div>
          <div className="run-live-panel">
            <div className="run-big">
              <strong className="run-gradient" data-testid="run-km">
                {formatKm(s.distance)}
              </strong>
              <span>KILÓMETROS</span>
            </div>
            <div
              className={`run-metrics ${[cadence, bpm].filter(Boolean).length === 1 ? "three" : ""}`}
            >
              <div>
                <strong>{formatClock(s.seconds)}</strong>
                <span>TIEMPO</span>
              </div>
              <div>
                <strong>
                  {formatPace(s.currentPace() ?? s.averagePace())}
                </strong>
                <span>RITMO /KM</span>
              </div>
              {cadence && (
                <div>
                  <strong>{cadence}</strong>
                  <span>PASOS/MIN</span>
                </div>
              )}
              {bpm && (
                <div className="run-heart">
                  <strong>
                    <Heart size={18} fill="currentColor" /> {bpm}
                  </strong>
                  <span>PULSO</span>
                </div>
              )}
            </div>
            <div className="run-grow" />
            {step === "short" ? (
              <div className="run-short">
                <p>Todavía no llegaste a 50 metros. ¿Seguimos?</p>
                <div className="run-controls">
                  <button
                    type="button"
                    className="run-round"
                    onClick={() => {
                      clearSnapshot(profile.id);
                      close();
                    }}
                  >
                    <Square size={22} fill="currentColor" />
                    Descartar
                  </button>
                  <button
                    type="button"
                    className="run-round accent"
                    onClick={() => {
                      s.resume(Date.now());
                      setStep("live");
                    }}
                  >
                    <Play size={22} fill="currentColor" />
                    Seguir
                  </button>
                </div>
              </div>
            ) : s.paused ? (
              <div className="run-controls">
                <button
                  type="button"
                  className="run-round"
                  disabled={busy}
                  onClick={() => void finish()}
                >
                  <Square size={22} fill="currentColor" />
                  Terminar
                </button>
                <button
                  type="button"
                  className="run-round accent"
                  onClick={() => {
                    s.resume(Date.now());
                    speak("Seguimos", voice);
                    haptic(20);
                    setVersion((v) => v + 1);
                  }}
                >
                  <Play size={22} fill="currentColor" />
                  Seguir
                </button>
              </div>
            ) : (
              <div className="run-controls">
                <button
                  type="button"
                  className="run-round big"
                  aria-label="Pausar"
                  onClick={() => {
                    s.pause(Date.now());
                    persist();
                    speak("Pausa", voice);
                    haptic(20);
                    setVersion((v) => v + 1);
                  }}
                >
                  <Pause size={34} />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {step === "summary" && saved && (
        <RunSummary
          run={saved}
          celebrate
          title={`¡Bien ahí, ${profile.name}!`}
          subtitle={`${niceDate(saved.date)} · ${new Date(saved.startedAt ?? Date.now()).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`}
          onClose={close}
        />
      )}
    </div>,
    host,
  );
}
