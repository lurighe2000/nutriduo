import ProfileAvatar from "../../components/ProfileAvatar";
import BrandIcon from "../../components/BrandIcon";
import { useState, useRef } from "react";
import { useProfileBack } from "../../app/profileBack";
import {
  ArrowUpRight,
  LockKeyhole,
  ArrowLeft,
  ShieldCheck,
  Check,
} from "lucide-react";
import { db, meta, repository } from "../../db";
import { setPin, verifyPin } from "../../services/pin";
import { initialPlan } from "../../services/workouts";
import { targets, age } from "../../nutrition/formulas";
import { profileSchema, type Profile } from "../../schemas";
import { today, rounded } from "../../utils/date";
import { Button, Field, NumberField } from "../../components/ui";
export default function Gate({
  profiles,
  onUnlock,
}: {
  profiles: Profile[];
  onUnlock: (id: Profile["id"]) => void;
}) {
  const [selected, setSelected] = useState<Profile | null>(null),
    [pin, setPinValue] = useState(""),
    [repeat, setRepeat] = useState(""),
    [verified, setVerified] = useState(false),
    [stage, setStage] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const p = selected;
  const verifiedHere = useRef(false);
  useProfileBack(
    !p ? "profiles" : !verified ? "pin" : stage === 0 ? "setup" : "proposal",
    (step) => {
      setError("");
      setPinValue("");
      setRepeat("");
      if (step === "profiles" || !p) {
        verifiedHere.current = false;
        setSelected(null);
        setVerified(false);
        setStage(0);
        return;
      }
      if (step === "pin") {
        const stored = profiles.find((profile) => profile.id === p.id);
        setSelected({
          ...p,
          pinHash: stored?.pinHash,
          pinSalt: stored?.pinSalt,
        });
        setVerified(false);
        setStage(0);
        return;
      }
      if (verifiedHere.current) {
        setVerified(true);
        setStage(step === "proposal" ? 1 : 0);
      }
    },
  );
  async function enter() {
    if (!p) return;
    setBusy(true);
    setError("");
    try {
      if (p.pinHash) await verifyPin(p.id, pin);
      else {
        if (pin !== repeat) throw new Error("Los dos PIN deben coincidir.");
        await setPin(p.id, pin);
      }
      if (p.onboarded) onUnlock(p.id);
      else {
        verifiedHere.current = true;
        setVerified(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo abrir el perfil.");
    } finally {
      setBusy(false);
    }
  }
  async function finish() {
    if (!p) return;
    setBusy(true);
    setError("");
    try {
      const stored = await db.profiles.get(p.id);
      if (!stored) throw new Error("Perfil no encontrado.");
      const profile = profileSchema.parse({
        ...p,
        pinHash: stored.pinHash,
        pinSalt: stored.pinSalt,
        targets: targets(p, p.initialWeight),
        onboarded: true,
      });
      await db.transaction("rw", db.tables, async () => {
        await db.profiles.put(profile);
        const repo = repository(p.id);
        await repo.save("weights", {
          ...meta(p.id),
          date: today(),
          kg: p.initialWeight,
        });
        await repo.save("plans", initialPlan(p));
      });
      void navigator.storage?.persist?.();
      onUnlock(p.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className={`welcome ${p?.id === "ari" ? "theme-ari" : ""}`}>
      <div className="brand">
        <BrandIcon />
        nutri<span>duo</span>
        <small>NUTRICIÓN Y ENTRENAMIENTO</small>
      </div>
      {!p ? (
        <section className="welcome-content">
          <span className="eyebrow">NUTRIDUO</span>
          <h1>Elegí tu perfil</h1>
          <p>Comidas, entrenamiento y progreso, en un solo lugar.</p>
          <div className="profile-grid">
            {profiles.map((profile) => (
              <button
                key={profile.id}
                className={`profile-card ${profile.id}`}
                onClick={() => {
                  setSelected(profile);
                  setError("");
                  setPinValue("");
                  setRepeat("");
                }}
              >
                <ProfileAvatar profile={profile} />
                <span>
                  <strong>{profile.name}</strong>
                  <small>
                    {profile.goal === "gain"
                      ? "Construir fuerza. Ganar músculo."
                      : "Sentirte fuerte. Avanzar a tu ritmo."}
                  </small>
                </span>
                <ArrowUpRight />
              </button>
            ))}
          </div>
          <p className="privacy">
            <LockKeyhole size={15} /> Un espacio para cada uno. Tus datos, en tu
            dispositivo.
          </p>
        </section>
      ) : (
        <section className="gate-panel">
          <button
            className="text-button"
            onClick={() => {
              setSelected(null);
              setVerified(false);
              setStage(0);
            }}
          >
            <ArrowLeft size={16} /> Cambiar perfil
          </button>
          {!verified ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void enter();
              }}
            >
              <ProfileAvatar profile={p} className={`avatar ${p.id}`} />
              <h1>
                {p.pinHash
                  ? `Qué bueno verte, ${p.name}.`
                  : `Tu espacio, ${p.name}.`}
              </h1>
              <p>
                {p.pinHash
                  ? "Ingresá tu PIN para continuar."
                  : "Elegí un PIN de 4 dígitos para evitar entrar al perfil equivocado."}
              </p>
              <Field
                label={p.pinHash ? "PIN" : "Crear PIN"}
                type="password"
                inputMode="numeric"
                pattern="[0-9]{4}"
                maxLength={4}
                autoComplete="off"
                value={pin}
                required
                onChange={(e) => setPinValue(e.target.value)}
              />
              {!p.pinHash && (
                <Field
                  label="Repetir PIN"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  autoComplete="off"
                  value={repeat}
                  required
                  onChange={(e) => setRepeat(e.target.value)}
                />
              )}
              <p className="muted small">
                <ShieldCheck size={14} /> El PIN no cifra tus archivos. Protegé
                también el acceso a tu celular.
              </p>
              {error && (
                <p role="alert" className="error">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={busy}>
                {busy
                  ? "Un momento…"
                  : p.pinHash
                    ? "Entrar a mi espacio"
                    : "Crear mi PIN"}
                <ArrowUpRight size={18} />
              </Button>
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (stage === 0) {
                  try {
                    profileSchema.parse(p);
                    if (
                      !p.birthDate ||
                      p.height < 100 ||
                      p.initialWeight < 25 ||
                      age(p.birthDate) < 18
                    )
                      throw new Error("Revisá los datos.");
                    setError("");
                    setStage(1);
                  } catch {
                    setError("Revisá los datos ingresados.");
                  }
                } else void finish();
              }}
            >
              <span className="eyebrow">EMPECEMOS POR VOS · {stage + 1}/2</span>
              <h1>
                {stage === 0
                  ? "Tu punto de partida."
                  : "Un objetivo para empezar."}
              </h1>
              {stage === 0 ? (
                <>
                  <p>Confirmá tus datos de hoy. Después los podés ajustar.</p>
                  <div className="form-grid">
                    <NumberField
                      label="Peso actual (kg)"
                      value={p.initialWeight}
                      min={25}
                      max={350}
                      onChange={(n) => setSelected({ ...p, initialWeight: n })}
                    />
                    <NumberField
                      label="Altura (cm)"
                      value={p.height}
                      min={100}
                      max={230}
                      onChange={(n) => setSelected({ ...p, height: n })}
                    />
                    <Field
                      label="Fecha de nacimiento"
                      type="date"
                      required
                      max={today()}
                      value={p.birthDate}
                      onChange={(e) =>
                        setSelected({ ...p, birthDate: e.target.value })
                      }
                    />
                    <label className="field">
                      <span>Actividad actual</span>
                      <select
                        value={p.activity}
                        onChange={(e) =>
                          setSelected({
                            ...p,
                            activity: Number(e.target.value),
                          })
                        }
                      >
                        <option value={1.2}>Poco movimiento</option>
                        <option value={1.375}>
                          Ligera · 1–2 días por semana
                        </option>
                        <option value={1.55}>Moderada · 3–4 días</option>
                        <option value={1.725}>
                          Alta · casi todos los días
                        </option>
                      </select>
                    </label>
                    <NumberField
                      label="Días disponibles para fuerza"
                      value={p.gymDays}
                      min={0}
                      max={6}
                      step={1}
                      onChange={(n) => setSelected({ ...p, gymDays: n })}
                    />
                  </div>
                  {age(p.birthDate) < 18 && (
                    <p className="error">
                      Esta versión está pensada para adultos.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p>
                    Esta es una estimación inicial para{" "}
                    {p.goal === "gain"
                      ? "ganar músculo gradualmente"
                      : "reducir grasa cuidando tu fuerza"}
                    . La tendencia de varias semanas nos va a dar más
                    información.
                  </p>
                  <div className="goal-preview">
                    <strong>
                      ≈ {rounded(targets(p, p.initialWeight).calories)}{" "}
                      <small>kcal / día</small>
                    </strong>
                    <div>
                      {targets(p, p.initialWeight).protein} g proteína ·{" "}
                      {targets(p, p.initialWeight).carbs} g carbos ·{" "}
                      {targets(p, p.initialWeight).fat} g grasas
                    </div>
                  </div>
                  <p className="muted">
                    Fuerza: {p.gymDays} días disponibles. La rutina base tiene
                    tres sesiones que podés distribuir y editar. No hace falta
                    fijar un peso final.
                  </p>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setStage(0)}
                  >
                    Revisar mis datos
                  </button>
                </>
              )}
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={busy || age(p.birthDate) < 18}>
                {stage === 0 ? "Ver propuesta" : "Confirmar y empezar"}
                <Check size={18} />
              </Button>
            </form>
          )}
        </section>
      )}
      <footer>
        Nutrición + movimiento + constancia <span>Hecho para ustedes.</span>
      </footer>
    </main>
  );
}
