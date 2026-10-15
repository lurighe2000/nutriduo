import { mealPhotos } from "../../services/photos";
import {
  ArrowUpRight,
  Plus,
  Droplets,
  Dumbbell,
  ArrowRight,
  Leaf,
  Check,
  Flame,
  TrendingUp,
} from "lucide-react";
import { useApp } from "../../app/context";
import {
  dailyTotals,
  weightTrend,
  mealTotal,
  mealSuggestions,
  zero,
  average,
} from "../../nutrition/formulas";
import { adaptiveCoach } from "../../nutrition/adaptive";
import { rounded, rangeDates, today } from "../../utils/date";
import { meta } from "../../db";
import { Button, Empty, SectionTitle } from "../../components/ui";
import { SOURCE_LABELS } from "../../nutrition/constants";
import { useEffect, useState } from "react";
import {
  Celebration,
  DuoBuddy,
  haptic,
  useCountUp,
} from "../../components/motion";
const WEEKDAY = ["D", "L", "M", "M", "J", "V", "S"];
function greetingFor(date: string) {
  if (date !== today()) return "TU REGISTRO";
  const hour = new Date().getHours();
  return hour < 12 ? "BUEN DÍA" : hour < 20 ? "BUENAS TARDES" : "BUENAS NOCHES";
}
export default function Dashboard() {
  const { profile: p, data, date, addMeal, navigate, repo, run } = useApp();
  const total = dailyTotals(data.meals, date),
    goal = p.targets!;
  const remaining = {
    ...zero(),
    calories: Math.max(0, goal.calories - total.calories),
    protein: Math.max(0, goal.protein - total.protein),
  };
  const trend = weightTrend(data.weights, date);
  const water = data.hydration
    .filter((w) => w.date === date)
    .reduce((s, w) => s + w.ml, 0);
  const meals = data.meals
    .filter((m) => m.date === date)
    .sort((a, b) => a.time.localeCompare(b.time));
  const suggestions = mealSuggestions(p, remaining);
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
  const week = rangeDates(date, 7);
  const sessions = data.sessions.filter((s) => week.includes(s.date));
  const avgCal = average(
    week
      .filter((d) => data.settings.some((s) => s.date === d && s.complete))
      .map((d) => dailyTotals(data.meals, d).calories),
  );
  const completed = data.settings.find((s) => s.date === date);
  const ratio = Math.min(1, total.calories / goal.calories);
  // Rings start empty and fill once the screen is on.
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(t);
  }, []);
  const [party, setParty] = useState(false);
  useEffect(() => {
    if (!party) return;
    const t = setTimeout(() => setParty(false), 1800);
    return () => clearTimeout(t);
  }, [party]);
  const shownCalories = useCountUp(total.calories);
  const [savingWater, setSavingWater] = useState(false);
  const isComplete = (d: string) =>
    data.settings.some((s) => s.date === d && s.complete);
  let streak = 0;
  for (
    let d = isComplete(date) ? date : rangeDates(date, 2)[0];
    isComplete(d) && streak < 365;
    d = rangeDates(d, 2)[0]
  )
    streak++;
  const closedThisWeek = week.filter(isComplete).length;
  const score = Math.round((closedThisWeek / 7) * 100);
  const shownScore = useCountUp(score);
  const proteinRatio = Math.min(1, total.protein / Math.max(1, goal.protein));
  const waterRatio = Math.min(1, water / Math.max(1, goal.water));
  const fiberRatio = Math.min(1, total.fiber / Math.max(1, goal.fiber));
  const headline = !meals.length
    ? `Arranquemos, ${p.name}.`
    : remaining.protein > 0
      ? `Vas muy bien, ${p.name}.`
      : `¡Proteína cumplida, ${p.name}!`;
  const message = !meals.length
    ? "Registrá tu primera comida del día. No hace falta que sea perfecta."
    : remaining.protein > 0
      ? `Te faltan ${rounded(remaining.protein)} g de proteína para tu objetivo de hoy.`
      : "Ya llegaste a tu objetivo de proteína. Lo que sigue suma igual.";
  return (
    <>
      <SectionTitle eyebrow="RESUMEN DIARIO" title={`Hoy, ${p.name}`}>
        <Button onClick={addMeal}>
          <Plus size={18} />
          Registrar comida
        </Button>
      </SectionTitle>
      <p className="page-subtitle">
        {p.goal === "gain"
          ? "Ganancia muscular controlada"
          : "Reducción de grasa y entrenamiento de fuerza"}
      </p>
      <div className="duo-hero">
        <section className="duo-greeting">
          <div>
            <span className="eyebrow">{greetingFor(date)}</span>
            <h2>{headline}</h2>
            <p>{message}</p>
          </div>
          <DuoBuddy />
        </section>
        <section className="duo-rings-card">
          <svg
            className="duo-rings"
            viewBox="0 0 132 132"
            role="img"
            aria-label={`Proteína ${Math.round(proteinRatio * 100)}%, agua ${Math.round(waterRatio * 100)}%, fibra ${Math.round(fiberRatio * 100)}% del objetivo`}
          >
            {[
              { r: 58, value: proteinRatio, tone: "r1" },
              { r: 41, value: waterRatio, tone: "r2" },
              { r: 24, value: fiberRatio, tone: "r3" },
            ].map((ring) => {
              const length = 2 * Math.PI * ring.r;
              return (
                <g key={ring.tone}>
                  <circle
                    className="duo-ring-track"
                    cx="66"
                    cy="66"
                    r={ring.r}
                  />
                  <circle
                    className={`duo-ring ${ring.tone}`}
                    opacity={ring.value > 0 ? 1 : 0}
                    cx="66"
                    cy="66"
                    r={ring.r}
                    strokeDasharray={`${(filled ? ring.value : 0) * length} ${length}`}
                  />
                </g>
              );
            })}
          </svg>
          <dl>
            <div>
              <dt className="r1">PROTEÍNA</dt>
              <dd>
                {rounded(total.protein)}
                <small> / {goal.protein} g</small>
              </dd>
            </div>
            <div>
              <dt className="r2">AGUA</dt>
              <dd>
                {(water / 1000).toLocaleString("es-AR")}
                <small> / {goal.water / 1000} L</small>
              </dd>
            </div>
            <div>
              <dt className="r3">FIBRA</dt>
              <dd>
                {rounded(total.fiber)}
                <small> / {goal.fiber} g</small>
              </dd>
            </div>
          </dl>
        </section>
        <section className="duo-score">
          <div className="duo-score-top">
            <div>
              <span className="eyebrow">CONSTANCIA</span>
              <strong>{Math.round(shownScore)}</strong>
            </div>
            <span className="duo-chip">
              {streak
                ? `Racha de ${streak} ${streak === 1 ? "día" : "días"}`
                : "Empezá tu racha hoy"}
            </span>
          </div>
          <p>
            Cerraste el registro {closedThisWeek} de los últimos 7 días y
            entrenaste {sessions.length}{" "}
            {sessions.length === 1 ? "vez" : "veces"}.
          </p>
          <ol className="duo-week" aria-label="Días cerrados de la semana">
            {week.map((d, i) => (
              <li
                key={d}
                className={isComplete(d) ? "done" : ""}
                style={{ animationDelay: `${0.35 + i * 0.06}s` }}
              >
                <i />
                <span>{WEEKDAY[new Date(`${d}T12:00:00`).getDay()]}</span>
                <span className="sr-only">
                  {isComplete(d) ? " cerrado" : " sin cerrar"}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
      <div className="dashboard-grid">
        <section className="energy-card">
          <div className="card-heading">
            <h2>Tu energía de hoy</h2>
            <span className="pill">Objetivo estimado</span>
          </div>
          <div className="energy-body">
            <div className="energy-ring">
              <svg viewBox="0 0 200 200" aria-hidden="true">
                <circle className="ring-track" cx="100" cy="100" r="84" />
                <defs>
                  <linearGradient id="duoEnergy" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="var(--duo-3, #efd085)" />
                    <stop offset="1" stopColor="var(--duo-2, #efd085)" />
                  </linearGradient>
                </defs>
                <circle
                  className="ring-value"
                  cx="100"
                  cy="100"
                  r="84"
                  strokeDasharray={`${(filled ? ratio : 0) * 528} 528`}
                  opacity={ratio > 0 ? 1 : 0}
                />
              </svg>
              <div className="ring-text">
                <Flame size={21} />
                <strong>{rounded(shownCalories)}</strong>
                <span>de {rounded(goal.calories)} kcal</span>
              </div>
            </div>
            <div className="energy-copy">
              <span className="eyebrow">
                {total.calories <= goal.calories
                  ? "TE QUEDAN APROX."
                  : "POR ENCIMA DEL OBJETIVO"}
              </span>
              <strong>
                {rounded(Math.abs(goal.calories - total.calories))}{" "}
                <small>kcal</small>
              </strong>
              <p>
                {total.calories <= goal.calories
                  ? "Cada comida es una oportunidad para cuidarte."
                  : "Una jornada no define tu progreso. Miremos la tendencia semanal."}
              </p>
              <div className="energy-note">
                <Leaf size={15} /> Tu objetivo es una guía, no un examen.
              </div>
            </div>
          </div>
          <div className="macro-row">
            {(
              [
                { key: "protein", label: "Proteínas", color: "gold" },
                { key: "carbs", label: "Carbohidratos", color: "blue" },
                { key: "fat", label: "Grasas", color: "peach" },
              ] as const
            ).map((m) => (
              <div className="macro" key={m.key}>
                <span>
                  <i className={m.color} />
                  {m.label}
                </span>
                <strong>
                  {rounded(total[m.key])}
                  <small> / {goal[m.key]} g</small>
                </strong>
                <div className="progress-track">
                  <div
                    className={m.color}
                    style={{
                      width: `${Math.min(100, (total[m.key] / goal[m.key]) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="card hydration-card">
          <div className="card-heading">
            <h2>
              <Droplets size={19} /> Hidratación
            </h2>
            <span className="muted small">HOY</span>
          </div>
          <div
            className="water-number"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {(water / 1000).toLocaleString("es-AR")}{" "}
            <small>/ {goal.water / 1000} L</small>
          </div>
          <div
            className="water-glasses"
            aria-label={`${water} de ${goal.water} ml`}
          >
            {Array.from({ length: 8 }, (_, i) => (
              <div
                key={i}
                className={water / goal.water > i / 8 ? "filled" : ""}
              >
                <Droplets size={26} />
              </div>
            ))}
          </div>
          <p className="muted small">
            {water
              ? `${water.toLocaleString("es-AR")} ml registrados en este día.`
              : "Una pausa. Un vaso de agua."}
          </p>
          <div className="water-actions">
            {[250, 500].map((ml) => (
              <Button
                secondary
                key={ml}
                disabled={savingWater}
                onClick={() => {
                  if (savingWater) return;
                  setSavingWater(true);
                  haptic(12);
                  void run(
                    () => repo.save("hydration", { ...meta(p.id), date, ml }),
                    "Agua registrada",
                  ).finally(() => setSavingWater(false));
                }}
              >
                <Plus size={14} />
                {ml} ml
              </Button>
            ))}
          </div>
          <button className="text-button small" onClick={() => navigate("mas")}>
            Personalizar cantidad y objetivo <ArrowRight size={14} />
          </button>
          <div className="fiber">
            <span>Fibra</span>
            <strong>
              {rounded(total.fiber)} <small>/ {goal.fiber} g</small>
            </strong>
          </div>
        </section>
        <section className="card meals-today">
          <div className="card-heading">
            <h2>Tus comidas</h2>
            <button className="text-button" onClick={() => navigate("comidas")}>
              Ver todas <ArrowUpRight size={16} />
            </button>
          </div>
          {!meals.length ? (
            <Empty
              title="El día empieza acá"
              detail="Registrá tu primera comida. No hace falta que sea perfecta."
              action="Agregar una comida"
              onAction={addMeal}
            />
          ) : (
            <div className="meal-list">
              {meals.slice(0, 4).map((m) => (
                <button
                  className="meal-row"
                  key={m.id}
                  onClick={() => navigate("comidas")}
                >
                  <span className="meal-emoji">
                    {mealPhotos(m)[0] ? (
                      <img src={mealPhotos(m)[0]} alt="" />
                    ) : (
                      <Leaf size={21} />
                    )}
                  </span>
                  <span>
                    <small>
                      {m.type} · {m.time}
                    </small>
                    <strong>{m.name}</strong>
                    <small>{SOURCE_LABELS[m.items[0].source]}</small>
                  </span>
                  <b>
                    ≈ {rounded(mealTotal(m.items).calories)}
                    <small>kcal</small>
                  </b>
                </button>
              ))}
            </div>
          )}
          <div className="duo-burst-anchor">
            <Celebration show={party} />
            <button
              className={`day-complete ${completed?.complete ? "checked" : ""}`}
              onClick={() => {
                if (!completed?.complete) {
                  haptic([12, 60, 18]);
                  setParty(true);
                }
                void run(
                  () =>
                    repo.save("settings", {
                      ...(completed ?? meta(p.id)),
                      date,
                      complete: !completed?.complete,
                    }),
                  !completed?.complete
                    ? "Día cerrado. ¡Bien ahí!"
                    : "Día abierto para seguir registrando",
                );
              }}
            >
              <span>{completed?.complete ? <Check size={14} /> : null}</span>
              {completed?.complete
                ? "Registro del día completo"
                : "Ya registré todo lo que comí hoy"}
            </button>
          </div>
        </section>
        <section className="training-preview">
          <div className="card-heading">
            <span className="eyebrow">FUERZA</span>
            <Dumbbell size={24} />
          </div>
          <h2>Entrenamiento</h2>
          <p>
            {p.gymDays} días de fuerza por semana,
            <br />a tu ritmo y con buena técnica.
          </p>
          <div className="training-footer">
            <span>
              {sessions.length} sesiones
              <br />
              <small>en los últimos 7 días</small>
            </span>
            <button
              aria-label="Ver entrenamiento"
              onClick={() => navigate("entreno")}
            >
              <ArrowUpRight size={23} />
            </button>
          </div>
        </section>
      </div>
      <div className="section-heading">
        <h2>Para tu próxima comida</h2>
        <span className="muted small">IDEAS PARA VOS</span>
      </div>
      {p.reminders && (
        <div className="reminder-row">
          {!data.weights.some((w) => w.date === date) && (
            <button
              className="text-button"
              onClick={() => navigate("progreso")}
            >
              Tu peso de hoy, cuando puedas <ArrowRight size={15} />
            </button>
          )}
          {!data.checkins.some((c) => week.includes(c.date)) && (
            <button
              className="text-button"
              onClick={() => navigate("progreso")}
            >
              Esta semana: un check-in para vos <ArrowRight size={15} />
            </button>
          )}
        </div>
      )}
      <div className="suggestions">
        {suggestions.map((s, i) => (
          <div className="suggestion card" key={s.name}>
            <span className={`suggestion-icon s${i}`}>
              <Leaf size={21} />
            </span>
            <div>
              <h3>{s.name}</h3>
              <p>{s.detail}</p>
              <small>Adaptá la porción a tu hambre y a tu día.</small>
            </div>
          </div>
        ))}
      </div>
      <div className="dashboard-bottom">
        <section className="card trend-card">
          <div className="card-heading">
            <h2>
              <TrendingUp size={18} /> Mirá la tendencia
            </h2>
            <button
              className="text-button"
              onClick={() => navigate("progreso")}
            >
              <ArrowUpRight size={18} />
              <span className="sr-only">Ver progreso</span>
            </button>
          </div>
          <div className="stats-inline">
            <div>
              <strong>
                {trend.current?.toFixed(1) ?? "—"} <small>kg</small>
              </strong>
              <span>Promedio de 7 días</span>
            </div>
            <div>
              <strong>
                {trend.change === null
                  ? "—"
                  : `${trend.change >= 0 ? "+" : ""}${trend.change.toFixed(2)}`}
                <small> kg</small>
              </strong>
              <span>Vs. semana anterior</span>
            </div>
            <div>
              <strong>{avgCal === null ? "—" : rounded(avgCal)}</strong>
              <span>kcal · días completos</span>
            </div>
          </div>
        </section>
        <section className="coach-note">
          <span className="coach-icon">N</span>
          <div>
            <span className="eyebrow">TU COMPAÑERO DE PROGRESO</span>
            <h3>{coach.observation}</h3>
            <p>{coach.explanation}</p>
            <button
              className="text-button"
              onClick={() => navigate("progreso")}
            >
              Ver análisis <ArrowRight size={15} />
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
