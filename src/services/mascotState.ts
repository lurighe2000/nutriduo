export type CompanionFocus =
  "meal" | "water" | "protein" | "progress" | "training";
export type CompanionMood = "neutral" | "happy" | "celebrate" | "support";
export function companionState(input: {
  meals: number;
  protein: number;
  water: number;
  calories: number;
  complete: boolean;
  currentDay: boolean;
  trained?: boolean;
  logOverdue?: boolean;
}): {
  mood: CompanionMood;
  focus: CompanionFocus;
  message: string;
  action: string;
} {
  const ratio = (value: number) =>
    Number.isFinite(value) ? Math.max(0, value) : 0;
  const protein = ratio(input.protein),
    water = ratio(input.water);
  if (!input.currentDay)
    return {
      mood: "neutral",
      focus: "progress",
      message: "Cada día cuenta en tu recorrido.",
      action: "Ver mi progreso",
    };
  if (input.logOverdue && !input.complete)
    return {
      mood: "support",
      focus: "meal",
      message: "Quedaron comidas sin registrar. Las retomamos cuando puedas.",
      action: "Registrar una comida",
    };
  if (input.trained && !input.complete)
    return {
      mood: "celebrate",
      focus: "training",
      message: "¡Movimiento registrado! Ahora también toca recuperar.",
      action: "Ver mi entrenamiento",
    };
  if (!input.meals)
    return {
      mood: "neutral",
      focus: "meal",
      message: "Vamos a tu ritmo. Estoy con vos.",
      action: "Registrar una comida",
    };
  // Missing entries are not evidence of failure. Support is shown only after closing a day.
  if (input.complete && (protein < 0.65 || water < 0.5))
    return {
      mood: "support",
      focus: water < 0.5 ? "water" : "protein",
      message: "Hoy fue un paso. Mañana seguimos juntos.",
      action: water < 0.5 ? "Ver mi agua" : "Revisar mis comidas",
    };
  // Extra food or exercise is never needed to earn a celebration.
  if (
    input.complete &&
    protein >= 0.9 &&
    water >= 0.9 &&
    ratio(input.calories) <= 1.2
  )
    return {
      mood: "celebrate",
      focus: "progress",
      message: "¡Bien ahí! Tu constancia se nota.",
      action: "Ver mi progreso",
    };
  if (input.meals >= 2 && water < 0.5)
    return {
      mood: "happy",
      focus: "water",
      message: "Una pausa y un poco de agua, cuando puedas.",
      action: "Ir a hidratación",
    };
  if (input.meals >= 2 && protein < 0.6)
    return {
      mood: "happy",
      focus: "protein",
      message: "Tu próxima comida puede sumar proteína.",
      action: "Ver mis comidas",
    };
  return {
    mood: "happy",
    focus: "progress",
    message: "Lo que hacés cada día va sumando.",
    action: "Ver mi progreso",
  };
}
