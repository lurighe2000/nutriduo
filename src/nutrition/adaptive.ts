import type { Profile, Records } from "../schemas";
import { dailyTotals, weightTrend } from "./formulas";
import { rangeDates, shiftDate, today } from "../utils/date";
export interface CoachResult {
  observation: string;
  confidence: "low" | "medium";
  suggestedAction: {
    type: "maintain" | "increase_calories" | "decrease_calories";
    amount: number;
  };
  explanation: string;
  requiresConfirmation: true;
  calorieAdherence: number;
  proteinAdherence: number;
  trainingAdherence: number;
}
export function adaptiveCoach(
  p: Profile,
  weights: Records["weights"][],
  meals: Records["meals"][],
  sessions: Records["sessions"][],
  completed: Records["settings"][],
  adjustments: Records["adjustments"][],
  checkins: Records["checkins"][],
  end = today(),
): CoachResult {
  const dates = rangeDates(end, 14),
    first = dates.slice(0, 7),
    second = dates.slice(7);
  const target = p.targets;
  const full = completed.filter((x) => x.complete && dates.includes(x.date));
  const cal = target
    ? full.filter(
        (x) =>
          Math.abs(dailyTotals(meals, x.date).calories / target.calories - 1) <=
          0.15,
      ).length / 14
    : 0;
  const prot = target
    ? full.filter(
        (x) => dailyTotals(meals, x.date).protein >= target.protein * 0.85,
      ).length / 14
    : 0;
  const train = p.gymDays
    ? Math.min(
        1,
        new Set(
          sessions.filter((s) => dates.includes(s.date)).map((s) => s.date),
        ).size /
          (p.gymDays * 2),
      )
    : 0;
  const result: CoachResult = {
    observation: "Primero, conozcamos tu ritmo.",
    confidence: "low",
    suggestedAction: { type: "maintain", amount: 0 },
    explanation:
      "Necesitamos dos semanas, al menos 4 pesajes por semana y 12 días de alimentación marcados como completos. Un día aislado no define tu progreso.",
    requiresConfirmation: true,
    calorieAdherence: cal,
    proteinAdherence: prot,
    trainingAdherence: train,
  };
  if (
    !target ||
    weights.filter((w) => first.includes(w.date)).length < 4 ||
    weights.filter((w) => second.includes(w.date)).length < 4 ||
    full.length < 12
  )
    return result;
  const trend = weightTrend(weights, end);
  if (trend.change === null || trend.previous === null) return result;
  result.observation = `Tu promedio semanal ${trend.change >= 0 ? "subió" : "bajó"} ${Math.abs(trend.change).toFixed(2)} kg.`;
  result.confidence = "medium";
  const latest = [...checkins]
    .filter((c) => dates.includes(c.date))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (
    latest &&
    (latest.energy <= 2 ||
      latest.sleep <= 2 ||
      latest.hunger >= 4 ||
      latest.difficulty >= 4)
  ) {
    result.explanation =
      "Tu check-in indica hambre alta, cansancio o dificultad. Revisá descanso, recuperación y sostenibilidad antes de reducir calorías. Si persiste, consultá con un profesional.";
    return result;
  }
  if (adjustments.some((a) => a.date >= shiftDate(end, -14))) {
    result.explanation =
      "Hay un ajuste reciente. Démosle al menos 14 días antes de volver a cambiar.";
    return result;
  }
  const rate = (trend.change / trend.previous) * 100;
  if (Math.abs(rate) > 1) {
    result.observation = "La tendencia está cambiando rápido.";
    result.explanation =
      "No haremos un ajuste automático. Revisá las mediciones y consultá con un profesional si el cambio rápido persiste o tenés síntomas.";
    return result;
  }
  if (cal < 0.8 || prot < 0.8) {
    result.explanation =
      "Antes de mover el objetivo, busquemos constancia en energía y proteína. Aún no hay adherencia suficiente para interpretar el cambio.";
    return result;
  }
  if (p.goal === "gain" && rate < 0.1 && train >= 0.8) {
    result.suggestedAction = { type: "increase_calories", amount: 120 };
    result.explanation =
      "Con alimentación y fuerza sostenidas, un aumento pequeño puede ayudar. Es una propuesta para revisar, no una indicación médica.";
  } else if (p.goal === "gain" && rate > 0.5) {
    result.suggestedAction = { type: "decrease_calories", amount: -100 };
    result.explanation =
      "El aumento es más rápido que el ritmo conservador elegido. Podés revisar un ajuste pequeño.";
  } else if (p.goal === "loss" && rate < -0.75) {
    result.suggestedAction = { type: "increase_calories", amount: 120 };
    result.explanation =
      "Para cuidar recuperación y masa muscular, conviene revisar una ingesta un poco mayor.";
  } else if (
    p.goal === "loss" &&
    rate > -0.1 &&
    target.calories - 100 >= Math.max(1400, target.calories * 0.8)
  ) {
    result.suggestedAction = { type: "decrease_calories", amount: -100 };
    result.explanation =
      "Con registros completos y una tendencia estable, podés evaluar un cambio pequeño o caminar un poco más. No es necesario hacer ambos.";
  } else
    result.explanation =
      "Por ahora, mantener el objetivo y observar las próximas semanas parece razonable. La fuerza, las medidas y cómo te sentís también importan.";
  return result;
}
