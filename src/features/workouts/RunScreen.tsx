import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Footprints, Heart, Pause, Play, Square, Volume2 } from "lucide-react";
import { useApp } from "../../app/context";
import { useDialogBack } from "../../app/navigation";
import { meta } from "../../db";
import { activitySchema } from "../../schemas";
import { haptic } from "../../components/motion";
import { localDate, niceDate } from "../../utils/date";
import {
  RunSession,
  calories,
  encodeRoute,
  formatClock,
  formatKm,
  formatPace,
  routeSegments,
  type RunKind,
  type RunSnapshot,
} from "../../services/runTracker";
import { useHeartRate } from "../../services/heartRate";
import RouteMap from "./RouteMap";
import RunPermission from "./RunPermission";
import { RunSummary } from "./RunSummary";
import {
  askMotionPermission,
  speak,
  spokenPace,
  useCadence,
  useWakeLock,
} from "./runDevice";
import {
  clearSnapshot,
  kindVerb,
  latestWeight,
  writeSnapshot,
  type DatedRun,
  type Run,
} from "./runShared";

type Step = "perm" | "denied" | "count" | "live" | "short" | "summary";

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
      {(step === "perm" || step === "denied") && (
        <RunPermission
          denied={step === "denied"}
          motion={motion}
          onToggleMotion={() => setMotion((m) => !m)}
          onAllow={allow}
          onClose={close}
        />
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
