import { useState } from "react";
import { Plus, Camera, TrendingUp, Trash2 } from "lucide-react";
import { useApp } from "../../app/context";
import { db, meta } from "../../db";
import {
  Button,
  Empty,
  Field,
  NumberField,
  Modal,
  Select,
  SectionTitle,
  Confirm,
} from "../../components/ui";
import { weightTrend, weightAverage } from "../../nutrition/formulas";
import { adaptiveCoach } from "../../nutrition/adaptive";
import { compressPhoto } from "../../services/photos";
import { niceDate, shiftDate, today } from "../../utils/date";
import type { Records } from "../../schemas";
export default function Progress() {
  const { profile: p, data, date, repo, run, notify } = useApp();
  const [tab, setTab] = useState("Peso"),
    [form, setForm] = useState(""),
    [kg, setKg] = useState(
      [...data.weights].sort((a, b) => b.date.localeCompare(a.date))[0]?.kg ??
        p.initialWeight,
    ),
    [cm, setCm] = useState(80),
    [measure, setMeasure] = useState("Cintura"),
    [custom, setCustom] = useState(""),
    [view, setView] = useState<Records["photos"]["view"]>("Frente"),
    [days, setDays] = useState("30"),
    [photo, setPhoto] = useState<{ image: string; thumbnail: string }>(),
    [photoBusy, setPhotoBusy] = useState(false),
    [compare, setCompare] = useState<string[]>([]),
    [adjust, setAdjust] = useState(false),
    [deletePhoto, setDeletePhoto] = useState<Records["photos"]>(),
    [check, setCheck] = useState({
      hunger: 3,
      energy: 3,
      sleep: 3,
      performance: 3,
      difficulty: 3,
      training: 3,
    });
  const sorted = data.weights
    .filter((w) => w.date <= date)
    .sort((a, b) => a.date.localeCompare(b.date));
  const trend = weightTrend(sorted, date);
  const chart = sorted.filter(
    (w) => days === "Todo" || w.date >= shiftDate(date, -Number(days) + 1),
  );
  const coach = adaptiveCoach(
    p,
    data.weights,
    data.meals,
    data.sessions,
    data.settings,
    data.adjustments,
    data.checkins,
    date,
  );
  const photos = data.photos
    .filter((ph) => ph.view === view)
    .sort((a, b) => a.date.localeCompare(b.date));
  const lastCheck = [...data.checkins].sort((a, b) =>
    b.date.localeCompare(a.date),
  )[0];
  async function save() {
    await run(async () => {
      if (form === "peso") {
        const old = data.weights.find((w) => w.date === date);
        await repo.save("weights", { ...(old ?? meta(p.id)), date, kg });
      } else if (form === "medida") {
        const label = measure === "Personalizada" ? custom : measure;
        const old = data.measurements.find(
          (m) => m.date === date && m.name === label,
        );
        await repo.save("measurements", {
          ...(old ?? meta(p.id)),
          date,
          name: label,
          cm,
        });
      } else if (form === "foto") {
        if (!photo) throw new Error("Elegí una foto primero.");
        await repo.save("photos", {
          ...meta(p.id),
          date,
          view,
          ...photo,
          weight: sorted.at(-1)?.kg,
        });
      } else {
        const old = data.checkins.find((c) => c.date === date);
        await repo.save("checkins", { ...(old ?? meta(p.id)), date, ...check });
      }
      setForm("");
      setPhoto(undefined);
    }, "Registro guardado");
  }
  return (
    <>
      <SectionTitle eyebrow="MÁS ALLÁ DE UN NÚMERO" title="Progreso">
        <Button onClick={() => setForm("peso")}>
          <Plus size={18} />
          Registrar peso
        </Button>
      </SectionTitle>
      <p className="page-subtitle">
        Las tendencias cuentan una historia. Un día solo, no.
      </p>
      <div className="tabs">
        {["Peso", "Medidas", "Fotos", "Mi análisis"].map((t) => (
          <button
            key={t}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "Peso" ? (
        <>
          <div className="metric-grid">
            <div className="card metric">
              <span>Último registro</span>
              <strong>
                {sorted.at(-1)?.kg ?? "—"} <small>kg</small>
              </strong>
              <small>
                {sorted.at(-1)
                  ? niceDate(sorted.at(-1)!.date, true)
                  : "Tu punto de partida"}
              </small>
            </div>
            <div className="card metric">
              <span>Promedio de 7 días</span>
              <strong>
                {trend.current?.toFixed(2) ?? "—"} <small>kg</small>
              </strong>
              <small>Suavizamos las fluctuaciones</small>
            </div>
            <div className="card metric">
              <span>Cambio semanal</span>
              <strong>
                {trend.change === null
                  ? "—"
                  : `${trend.change >= 0 ? "+" : ""}${trend.change.toFixed(2)}`}{" "}
                <small>kg</small>
              </strong>
              <small>Respecto a la semana anterior</small>
            </div>
          </div>
          <section className="card chart-card">
            <div className="card-heading">
              <h2>Evolución del peso</h2>
              <div className="segmented">
                {["30", "90", "Todo"].map((d) => (
                  <button
                    key={d}
                    className={days === d ? "active" : ""}
                    onClick={() => setDays(d)}
                  >
                    {d === "Todo" ? d : `${d} días`}
                  </button>
                ))}
              </div>
            </div>
            {chart.length > 1 ? (
              <LineChart
                rows={chart.map((w) => ({
                  date: w.date,
                  value: w.kg,
                  average: weightAverage(sorted, w.date) ?? w.kg,
                }))}
                unit="kg"
              />
            ) : (
              <Empty
                title="Cada registro suma perspectiva"
                detail="Con dos pesajes vas a empezar a ver tu gráfico. Si podés, pesate en condiciones similares."
              />
            )}
            <p className="muted small">
              Línea clara: registro diario · Línea oscura: promedio móvil de los
              últimos 7 días.
            </p>
          </section>
          <div className="card">
            <h2>Últimos registros</h2>
            {sorted
              .slice(-10)
              .reverse()
              .map((w) => (
                <div className="history-row" key={w.id}>
                  <span>{niceDate(w.date)}</span>
                  <strong>{w.kg} kg</strong>
                </div>
              ))}
          </div>
        </>
      ) : tab === "Medidas" ? (
        <>
          <Button secondary onClick={() => setForm("medida")}>
            <Plus size={17} />
            Registrar medida
          </Button>
          {!data.measurements.length ? (
            <Empty
              title="El cambio también está en las medidas"
              detail="Cintura, cadera, brazos… elegí las que te ayuden a ver tu evolución."
            />
          ) : (
            <div className="record-grid">
              {[...new Set(data.measurements.map((m) => m.name))].map(
                (name) => {
                  const rows = data.measurements
                    .filter((m) => m.name === name)
                    .sort((a, b) => a.date.localeCompare(b.date));
                  return (
                    <section className="card" key={name}>
                      <h2>{name}</h2>
                      <strong className="calorie-label">
                        {rows.at(-1)?.cm} <small>cm</small>
                      </strong>
                      {rows.length > 1 && (
                        <LineChart
                          rows={rows.map((m) => ({
                            date: m.date,
                            value: m.cm,
                          }))}
                          unit="cm"
                        />
                      )}
                      {rows.slice(-4).map((m) => (
                        <div className="history-row" key={m.id}>
                          <span>{niceDate(m.date, true)}</span>
                          <strong>{m.cm} cm</strong>
                        </div>
                      ))}
                    </section>
                  );
                },
              )}
            </div>
          )}
        </>
      ) : tab === "Fotos" ? (
        <>
          <div className="actions">
            <Button secondary onClick={() => setForm("foto")}>
              <Camera size={17} />
              Agregar foto
            </Button>
            <Select
              label="Vista"
              value={view}
              onChange={(v) => {
                setView(v as typeof view);
                setCompare([]);
              }}
              options={[
                "Frente",
                "Lateral izquierdo",
                "Lateral derecho",
                "Espalda",
                "Libre",
              ]}
            />
          </div>
          <p className="muted">
            Sólo en este dispositivo. Sin filtros ni estimación de grasa
            corporal.
          </p>
          {!photos.length ? (
            <Empty
              title="Una mirada a tu recorrido"
              detail="Guardá una foto de referencia. Volvé cuando quieras comparar, sin apuro."
            />
          ) : (
            <>
              <p className="small muted">
                Seleccioná dos fotos de la misma vista para compararlas.
              </p>
              <div className="photo-grid">
                {photos.map((ph) => (
                  <div className="photo-tile" key={ph.id}>
                    <button
                      className={compare.includes(ph.id) ? "selected" : ""}
                      onClick={() =>
                        setCompare((v) =>
                          v.includes(ph.id)
                            ? v.filter((id) => id !== ph.id)
                            : [...v.slice(-1), ph.id],
                        )
                      }
                    >
                      <img
                        src={ph.thumbnail}
                        alt={`${ph.view}, ${niceDate(ph.date, true)}`}
                      />
                      <span>
                        {niceDate(ph.date, true)} · {ph.weight ?? "—"} kg
                      </span>
                    </button>
                    <button
                      className="icon-button danger"
                      aria-label="Eliminar foto"
                      onClick={() => setDeletePhoto(ph)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              {compare.length === 2 && (
                <div className="card">
                  <h2>Antes y ahora</h2>
                  <div className="comparison">
                    {photos
                      .filter((ph) => compare.includes(ph.id))
                      .map((ph) => (
                        <figure key={ph.id}>
                          <img src={ph.image} alt={ph.view} />
                          <figcaption>
                            {niceDate(ph.date)} · {ph.weight ?? "—"} kg
                          </figcaption>
                        </figure>
                      ))}
                  </div>
                  <ComparisonDetails
                    photos={photos.filter((ph) => compare.includes(ph.id))}
                    measures={data.measurements}
                  />
                </div>
              )}
            </>
          )}
        </>
      ) : (
        <>
          <div className="card coach-analysis">
            <span className="eyebrow">
              <TrendingUp size={16} /> TU COMPAÑERO DE PROGRESO
            </span>
            <h2>{coach.observation}</h2>
            <p>{coach.explanation}</p>
            <div className="summary-strip">
              <span>
                Confianza: {coach.confidence === "low" ? "baja" : "media"}
              </span>
              <span>Energía: {Math.round(coach.calorieAdherence * 100)}%</span>
              <span>Proteína: {Math.round(coach.proteinAdherence * 100)}%</span>
              <span>Fuerza: {Math.round(coach.trainingAdherence * 100)}%</span>
            </div>
            {coach.suggestedAction.amount !== 0 && (
              <div className="actions">
                <Button onClick={() => setAdjust(true)}>
                  Revisar ajuste de{" "}
                  {coach.suggestedAction.amount > 0 ? "+" : ""}
                  {coach.suggestedAction.amount} kcal
                </Button>
                <Button
                  secondary
                  onClick={() => notify("Mantenemos tu objetivo actual.")}
                >
                  Mantener objetivo
                </Button>
              </div>
            )}
            <p className="muted small">
              Ventanas de 14 días. Sólo contamos días de comida marcados como
              completos. Las medidas y fotos aportan contexto visual, no una
              estimación de composición corporal.
            </p>
          </div>
          <div className="card">
            <h2>Tu check-in semanal</h2>
            <p>
              Hambre, energía, descanso y rendimiento: también son parte del
              progreso.
            </p>
            <Button secondary onClick={() => setForm("check")}>
              {lastCheck ? "Hacer otro check-in" : "Hacer mi primer check-in"}
            </Button>
            {lastCheck && (
              <p className="muted small">
                Último: {niceDate(lastCheck.date)} · energía {lastCheck.energy}
                /5 · descanso {lastCheck.sleep}/5
              </p>
            )}
          </div>
          <div className="card">
            <h2>Constancia que suma</h2>
            <div className="achievement-grid">
              <span className={data.sessions.length >= 10 ? "earned" : ""}>
                ✦ 10 entrenamientos
                <br />
                <small>{Math.min(10, data.sessions.length)}/10</small>
              </span>
              <span className={data.weights.length >= 30 ? "earned" : ""}>
                ✦ 30 días de peso
                <br />
                <small>{Math.min(30, data.weights.length)}/30</small>
              </span>
              <span
                className={
                  data.settings.filter((s) => s.complete).length >= 7
                    ? "earned"
                    : ""
                }
              >
                ✦ Una semana registrada
                <br />
                <small>
                  {Math.min(7, data.settings.filter((s) => s.complete).length)}
                  /7
                </small>
              </span>
            </div>
          </div>
        </>
      )}
      {form && (
        <Modal
          title={
            form === "peso"
              ? "Registrar peso"
              : form === "medida"
                ? "Registrar medida"
                : form === "foto"
                  ? "Una foto de tu progreso"
                  : "Check-in semanal"
          }
          onClose={() => setForm("")}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <p className="muted">{niceDate(date)}</p>
            {form === "peso" ? (
              <>
                <NumberField
                  label="Peso (kg)"
                  value={kg}
                  min={25}
                  max={350}
                  onChange={setKg}
                />
                <p className="muted small">
                  Si ya hay un registro en esta fecha, se actualizará.
                </p>
              </>
            ) : form === "medida" ? (
              <>
                <Select
                  label="Medida"
                  value={measure}
                  onChange={setMeasure}
                  options={[
                    "Cintura",
                    "Cadera",
                    "Pecho",
                    "Brazo izquierdo",
                    "Brazo derecho",
                    "Muslo izquierdo",
                    "Muslo derecho",
                    "Cuello",
                    "Personalizada",
                  ]}
                />
                {measure === "Personalizada" && (
                  <Field
                    label="Nombre de la medida"
                    required
                    value={custom}
                    onChange={(e) => setCustom(e.target.value)}
                  />
                )}
                <NumberField
                  label="Centímetros"
                  value={cm}
                  min={1}
                  max={400}
                  onChange={setCm}
                />
              </>
            ) : form === "foto" ? (
              <>
                <Select
                  label="Vista de la foto"
                  value={view}
                  onChange={(v) => setView(v as typeof view)}
                  options={[
                    "Frente",
                    "Lateral izquierdo",
                    "Lateral derecho",
                    "Espalda",
                    "Libre",
                  ]}
                />
                <Field
                  label="Elegir foto de progreso"
                  type="file"
                  accept="image/*"
                  required
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setPhotoBusy(true);
                      void run(async () =>
                        setPhoto(await compressPhoto(f)),
                      ).finally(() => setPhotoBusy(false));
                    }
                  }}
                />
                {photo && (
                  <img
                    className="upload-preview"
                    src={photo.thumbnail}
                    alt="Vista previa"
                  />
                )}
                <p className="muted small">
                  Guardamos una versión comprimida y una miniatura. El original
                  queda en tu galería; NutriDuo no lo guarda ni lo elimina.
                </p>
              </>
            ) : (
              <>
                {(Object.keys(check) as (keyof typeof check)[]).map(
                  (key, i) => (
                    <label className="field" key={key}>
                      <span>
                        {
                          [
                            "Hambre (1 poca · 5 mucha)",
                            "Energía (1 baja · 5 alta)",
                            "Sueño (1 malo · 5 bueno)",
                            "Rendimiento (1 bajo · 5 alto)",
                            "Dificultad con la alimentación (1 poca · 5 mucha)",
                            "Cumplimiento del entrenamiento (1 bajo · 5 alto)",
                          ][i]
                        }
                      </span>
                      <select
                        value={check[key]}
                        onChange={(e) =>
                          setCheck({ ...check, [key]: Number(e.target.value) })
                        }
                      >
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n}>{n}</option>
                        ))}
                      </select>
                    </label>
                  ),
                )}
              </>
            )}
            <Button type="submit" disabled={photoBusy}>
              {photoBusy ? "Procesando foto…" : "Guardar registro"}
            </Button>
          </form>
        </Modal>
      )}
      {adjust && (
        <Confirm
          title="Confirmar cambio de objetivo"
          onClose={() => setAdjust(false)}
          onConfirm={() =>
            void run(async () => {
              await db.transaction(
                "rw",
                db.profiles,
                db.table("adjustments"),
                async () => {
                  const current = await db.profiles.get(p.id);
                  if (!current?.targets)
                    throw new Error("No se encontró el objetivo.");
                  const amount = coach.suggestedAction.amount;
                  await db.profiles.update(p.id, {
                    targets: {
                      ...current.targets,
                      calories: current.targets.calories + amount,
                      carbs: Math.max(0, current.targets.carbs + amount / 4),
                    },
                  });
                  await repo.save("adjustments", {
                    ...meta(p.id),
                    date: today(),
                    amount,
                    explanation: coach.explanation,
                    previousCalories: current.targets.calories,
                  });
                },
              );
              setAdjust(false);
            }, "Objetivo actualizado")
          }
        >
          Vas a pasar de {p.targets!.calories} a{" "}
          {p.targets!.calories + coach.suggestedAction.amount} kcal diarias.
          Conservamos proteína y grasas, y ajustamos carbohidratos. Volveremos a
          observar al menos 14 días.
        </Confirm>
      )}
      {deletePhoto && (
        <Confirm
          title="¿Eliminar la foto?"
          onClose={() => setDeletePhoto(undefined)}
          onConfirm={() =>
            void run(async () => {
              await repo.remove("photos", deletePhoto.id);
              setDeletePhoto(undefined);
            }, "Foto eliminada")
          }
        >
          Se eliminará la copia de NutriDuo. La foto original de tu galería no
          se modifica.
        </Confirm>
      )}
    </>
  );
}
function ComparisonDetails({
  photos,
  measures,
}: {
  photos: Records["photos"][];
  measures: Records["measurements"][];
}) {
  const [a, b] = photos;
  const days = Math.round((Date.parse(b.date) - Date.parse(a.date)) / 86400000);
  const waist = (date: string) =>
    measures
      .filter((m) => m.name === "Cintura" && m.date <= date)
      .sort((a, b) => b.date.localeCompare(a.date))[0]?.cm;
  const w1 = waist(a.date),
    w2 = waist(b.date);
  return (
    <p className="muted">
      {days} días · Cambio de peso:{" "}
      {a.weight && b.weight
        ? (b.weight - a.weight).toFixed(1) + " kg"
        : "sin datos asociados"}{" "}
      · Cintura:{" "}
      {w1 && w2 ? (w2 - w1).toFixed(1) + " cm" : "sin medidas asociadas"}
    </p>
  );
}
export function LineChart({
  rows,
  unit,
}: {
  rows: { date: string; value: number; average?: number }[];
  unit: string;
}) {
  if (rows.length < 2) return null;
  const vals = rows.flatMap((r) => [r.value, r.average ?? r.value]);
  const min = Math.min(...vals) - 0.3,
    max = Math.max(...vals) + 0.3;
  const first = Date.parse(rows[0].date),
    last = Date.parse(rows.at(-1)!.date);
  const x = (date: string) =>
    45 + ((Date.parse(date) - first) / Math.max(86400000, last - first)) * 600;
  const y = (v: number) => 165 - ((v - min) / (max - min)) * 135;
  const points = (average = false) =>
    rows
      .map(
        (r) => `${x(r.date)},${y(average ? (r.average ?? r.value) : r.value)}`,
      )
      .join(" ");
  return (
    <svg
      className="line-chart"
      viewBox="0 0 680 210"
      role="img"
      aria-label={`Evolución: ${rows[0].value} a ${rows.at(-1)!.value} ${unit}`}
    >
      <title>Evolución en {unit}</title>
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <line
            x1="45"
            x2="650"
            y1={30 + i * 45}
            y2={30 + i * 45}
            stroke="currentColor"
            opacity=".1"
          />
          <text x="0" y={35 + i * 45}>
            {(max - ((max - min) * i) / 3).toFixed(1)}
          </text>
        </g>
      ))}
      <polyline
        fill="none"
        stroke="var(--accent)"
        opacity=".6"
        strokeWidth="2"
        points={points()}
      />
      {rows.some((r) => r.average !== undefined) && (
        <polyline
          fill="none"
          stroke="var(--primary)"
          strokeWidth="3"
          points={points(true)}
        />
      )}
      {rows.map((r) => (
        <circle
          key={r.date}
          cx={x(r.date)}
          cy={y(r.value)}
          r="3"
          fill="var(--accent)"
        >
          <title>
            {r.date}: {r.value} {unit}
          </title>
        </circle>
      ))}
      <text x="45" y="199">
        {niceDate(rows[0].date, true)}
      </text>
      <text x="590" y="199">
        {niceDate(rows.at(-1)!.date, true)}
      </text>
    </svg>
  );
}
