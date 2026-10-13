import type { Item, Macros, Profile, Records, NutritionGoal } from "../schemas";
import { rangeDates, shiftDate, today } from "../utils/date";
export const zero = (): Macros => ({
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
});
export function age(birth: string, on = today()) {
  const b = new Date(birth + "T12:00:00"),
    d = new Date(on + "T12:00:00");
  return (
    d.getFullYear() -
    b.getFullYear() -
    (d.getMonth() < b.getMonth() ||
    (d.getMonth() === b.getMonth() && d.getDate() < b.getDate())
      ? 1
      : 0)
  );
}
export function bmr(p: Profile, kg: number, on = today()) {
  return (
    10 * kg +
    6.25 * p.height -
    5 * age(p.birthDate, on) +
    (p.sex === "male" ? 5 : -161)
  );
}
export function tdee(p: Profile, kg: number, on = today()) {
  return bmr(p, kg, on) * p.activity;
}
export function targets(p: Profile, kg: number, on = today()): NutritionGoal {
  const energy = tdee(p, kg, on);
  const calories = Math.round(p.goal === "gain" ? energy + 150 : energy * 0.9);
  const protein = Math.round(kg * (p.gymDays > 0 ? 1.8 : 1.6));
  const fat = Math.round(kg * 0.9);
  return {
    calories,
    protein,
    fat,
    carbs: Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4)),
    fiber: Math.round((calories / 1000) * 14),
    water: 2500,
    steps: 5000,
  };
}
export function scale(m: Macros, factor: number): Macros {
  return {
    calories: m.calories * factor,
    protein: m.protein * factor,
    carbs: m.carbs * factor,
    fat: m.fat * factor,
    fiber: m.fiber * factor,
  };
}
export function sum(values: Macros[]): Macros {
  return values.reduce(
    (a, v) => ({
      calories: a.calories + v.calories,
      protein: a.protein + v.protein,
      carbs: a.carbs + v.carbs,
      fat: a.fat + v.fat,
      fiber: a.fiber + v.fiber,
    }),
    zero(),
  );
}
export const itemTotal = (i: Item) => scale(i.per100, i.grams / 100);
export const mealTotal = (items: Item[]) => sum(items.map(itemTotal));
export const recipePortion = (r: Records["recipes"]) =>
  scale(mealTotal(r.items), 1 / r.servings);
export function average(values: number[]) {
  return values.length
    ? values.reduce((a, b) => a + b, 0) / values.length
    : null;
}
export function weightAverage(
  rows: Records["weights"][],
  end = today(),
  days = 7,
) {
  const dates = new Set(rangeDates(end, days));
  return average(rows.filter((w) => dates.has(w.date)).map((w) => w.kg));
}
export function weightTrend(rows: Records["weights"][], end = today()) {
  const current = weightAverage(rows, end),
    previous = weightAverage(rows, shiftDate(end, -7));
  return {
    current,
    previous,
    change: current !== null && previous !== null ? current - previous : null,
  };
}
export function dailyTotals(meals: Records["meals"][], date: string) {
  return sum(
    meals.filter((m) => m.date === date).map((m) => mealTotal(m.items)),
  );
}
export function mealSuggestions(p: Profile, remaining: Macros) {
  const options =
    p.goal === "gain"
      ? [
          {
            name: "Un plato que suma",
            detail: "Arroz, pollo y aceite de oliva",
            tags: ["arroz", "pollo", "aceite"],
          },
          {
            name: "Una merienda práctica",
            detail: "Yogur, avena, banana y frutos secos",
            tags: ["yogur", "avena", "banana", "frutos secos"],
          },
          {
            name: "Clásico de casa",
            detail: "Pasta con carne y tomate",
            tags: ["pasta", "carne", "tomate"],
          },
        ]
      : [
          {
            name: "Simple y completo",
            detail: "Pollo, papa al horno y ensalada",
            tags: ["pollo", "papa", "ensalada"],
          },
          {
            name: "Para la próxima pausa",
            detail: "Yogur con fruta y avena",
            tags: ["yogur", "fruta", "avena"],
          },
          {
            name: "Algo casero",
            detail: "Ensalada de lentejas, huevo y tomate",
            tags: ["lentejas", "huevo", "tomate"],
          },
        ];
  return options
    .filter(
      (o) =>
        !p.excluded.some((e) =>
          o.tags.some((t) => t.includes(e.toLowerCase().trim())),
        ),
    )
    .slice(0, remaining.protein > 25 ? 3 : 2);
}
