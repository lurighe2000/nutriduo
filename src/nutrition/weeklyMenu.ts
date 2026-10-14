import { z } from "zod";
import catalog from "./menu-foods.json";
import {
  itemSchema,
  type Item,
  type Profile,
  type NutritionGoal,
} from "../schemas";
import { targets } from "./formulas";
import { shiftDate } from "../utils/date";
export const menuFoods = catalog.foods.map((f) => ({
  ...f,
  ...itemSchema
    .omit({ id: true, grams: true, cooking: true })
    .parse({ ...f, source: "database" }),
}));
type Ingredient = [key: string, start: number, min: number, max: number];
type Slot = "Desayuno" | "Almuerzo" | "Merienda" | "Cena";
type Recipe = {
  id: NonNullable<Profile["weeklyMenu"]>["meals"][number]["recipe"];
  name: string;
  slots: Slot[];
  ingredients: Ingredient[];
  preparation: string;
};
const breakfast: Slot[] = ["Desayuno", "Merienda"],
  main: Slot[] = ["Almuerzo", "Cena"];
export const menuRecipes: Recipe[] = [
  {
    id: "oats",
    name: "Avena con leche, banana y maní",
    slots: breakfast,
    ingredients: [
      ["oats", 40, 20, 100],
      ["milk", 250, 180, 400],
      ["banana", 100, 80, 150],
      ["peanuts", 15, 5, 30],
    ],
    preparation:
      "Cociná la avena con la leche o dejala hidratada en la heladera. Agregá banana y maní. Café o mate sin azúcar son opcionales; registrá aparte azúcar u otros agregados.",
  },
  {
    id: "yogurt",
    name: "Yogur con avena, manzana y maní",
    slots: breakfast,
    ingredients: [
      ["yogurt", 250, 180, 350],
      ["oats", 30, 15, 90],
      ["apple", 130, 100, 180],
      ["peanuts", 15, 5, 30],
    ],
    preparation:
      "Mezclá yogur y avena; agregá manzana en cubos y maní. Conservá refrigerado. Verificá los valores del yogur que compraste.",
  },
  {
    id: "toast",
    name: "Tostadas con huevo y fruta",
    slots: breakfast,
    ingredients: [
      ["bread", 60, 30, 150],
      ["egg", 100, 50, 150],
      ["banana", 100, 80, 150],
      ["milk", 180, 150, 300],
    ],
    preparation:
      "Tostá el pan y cociná completamente el huevo en sartén antiadherente sin aceite añadido. Acompañá con fruta y leche, sola o en el café. Si usás aceite, registralo.",
  },
  {
    id: "cream",
    name: "Tostadas con queso y yogur",
    slots: breakfast,
    ingredients: [
      ["bread", 60, 30, 150],
      ["creamCheese", 15, 10, 30],
      ["yogurt", 200, 150, 350],
      ["apple", 130, 100, 180],
    ],
    preparation:
      "Untá el queso en el pan y acompañá con yogur y manzana. La ficha es de queso crema genérico: no representa la etiqueta de Casancrem; corregila al registrar.",
  },
  {
    id: "chickenRice",
    name: "Pollo con arroz integral y ensalada",
    slots: main,
    ingredients: [
      ["chicken", 160, 90, 260],
      ["brownRice", 65, 25, 180],
      ["tomato", 120, 120, 120],
      ["lettuce", 60, 60, 60],
      ["oil", 12, 3, 25],
    ],
    preparation:
      "Pesá pollo crudo y arroz seco. Cociná el arroz, cociná completamente el pollo sin partes rosadas y lavá las verduras. Usá el aceite medido entre cocción y ensalada.",
  },
  {
    id: "beefPotato",
    name: "Carne magra con papas y zanahoria",
    slots: main,
    ingredients: [
      ["beef", 160, 90, 260],
      ["potato", 250, 150, 550],
      ["bread", 30, 0, 100],
      ["carrot", 180, 180, 180],
      ["oil", 12, 3, 25],
    ],
    preparation:
      "Pesá carne, papa pelada y zanahoria en crudo. Horneá las verduras con el aceite medido y cociná la carne. El pan completa la porción si aparece en la lista.",
  },
  {
    id: "lentils",
    name: "Guiso de lentejas, arroz y huevo",
    slots: main,
    ingredients: [
      ["lentils", 70, 40, 120],
      ["rice", 35, 15, 130],
      ["egg", 100, 50, 150],
      ["tomato", 120, 120, 120],
      ["carrot", 100, 100, 100],
      ["oil", 10, 3, 25],
    ],
    preparation:
      "Pesá lentejas y arroz secos. Herví las lentejas hasta tiernas, cociná el arroz y prepará el guiso con tomate, zanahoria y aceite medido. Agregá huevo bien cocido; repartí la preparación según los pesos de cada porción.",
  },
  {
    id: "milanesa",
    name: "Milanesa de pollo al horno con puré",
    slots: main,
    ingredients: [
      ["chicken", 160, 90, 260],
      ["bread", 25, 15, 50],
      ["egg", 25, 15, 50],
      ["potato", 230, 100, 500],
      ["milk", 50, 50, 50],
      ["lettuce", 60, 60, 60],
      ["tomato", 120, 120, 120],
      ["oil", 10, 3, 25],
    ],
    preparation:
      "Pesá pollo crudo, pan para rallar y huevo realmente usados en el rebozado. Horneá con el aceite medido hasta cocinar completamente. Herví papa y hacé el puré con la leche indicada. Acompañá con ensalada. Los restos de rebozado no consumidos no se registran.",
  },
  {
    id: "tuna",
    name: "Ensalada de atún, arroz y tomate",
    slots: main,
    ingredients: [
      ["tuna", 160, 100, 260],
      ["brownRice", 70, 25, 180],
      ["tomato", 140, 140, 140],
      ["carrot", 100, 100, 100],
      ["oil", 12, 3, 25],
    ],
    preparation:
      "Cociná el arroz pesado en seco y dejalo enfriar en heladera. Escurrí y pesá el atún. Mezclá con verduras lavadas y el aceite medido. Elegí atún al natural y corregí con la etiqueta de tu lata.",
  },
  {
    id: "chickenPotato",
    name: "Pollo al horno con papas y ensalada",
    slots: main,
    ingredients: [
      ["chicken", 170, 90, 260],
      ["potato", 260, 150, 550],
      ["bread", 30, 0, 100],
      ["lettuce", 60, 60, 60],
      ["tomato", 120, 120, 120],
      ["oil", 12, 3, 25],
    ],
    preparation:
      "Pesá pollo y papas peladas en crudo. Horneá con el aceite medido hasta cocinar completamente el pollo. Serví con ensalada y el pan indicado.",
  },
  {
    id: "beefRice",
    name: "Salteado de carne, arroz y verduras",
    slots: main,
    ingredients: [
      ["beef", 160, 90, 260],
      ["brownRice", 70, 25, 180],
      ["carrot", 100, 100, 100],
      ["tomato", 120, 120, 120],
      ["oil", 12, 3, 25],
    ],
    preparation:
      "Cociná arroz pesado en seco. Salteá carne y zanahoria pesadas en crudo con el aceite medido; agregá tomate. Cociná bien y serví. Salsas, sal y condimentos con calorías se registran aparte.",
  },
];
export type WeeklyMenu = NonNullable<Profile["weeklyMenu"]>;
const normalized = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
export function allowedRecipes(slot: Slot, excluded: string[]) {
  return menuRecipes.filter(
    (r) =>
      r.slots.includes(slot) &&
      !r.ingredients.some(([key]) => {
        const f = menuFoods.find((f) => f.key === key)!;
        return excluded.some((e) => {
          const word = normalized(e);
          return (
            word &&
            [f.name, ...f.tags].some((t) => normalized(t).includes(word))
          );
        });
      }),
  );
}
export function menuItems(portions: Record<string, number>): Item[] {
  return Object.entries(portions).map(([key, grams]) => {
    const f = menuFoods.find((f) => f.key === key);
    if (!f)
      throw new Error(
        "El menú usa un alimento que ya no está disponible. Generá otro menú.",
      );
    return itemSchema.parse({
      ...f,
      id: key,
      grams,
      source: "database",
      cooking: `Peso ${f.weighing} · preparar antes de consumir`,
    });
  });
}
export function fitPortions(recipe: Recipe, goal: NutritionGoal, slot: Slot) {
  const share = slot === "Desayuno" ? 0.22 : slot === "Merienda" ? 0.18 : 0.3;
  const proteinShare = breakfast.includes(slot) ? 0.16 : 0.34;
  const desired = {
    calories: goal.calories * share,
    protein: goal.protein * proteinShare,
    fat: goal.fat * share,
    fiber: goal.fiber * share,
  };
  const grams = Object.fromEntries(recipe.ingredients.map(([k, n]) => [k, n]));
  function loss() {
    const t = { calories: 0, protein: 0, fat: 0, fiber: 0 };
    for (const [key, g] of Object.entries(grams)) {
      const f = menuFoods.find((f) => f.key === key)!;
      for (const k of ["calories", "protein", "fat", "fiber"] as const)
        t[k] += (f.per100[k] * g) / 100;
    }
    return (
      ((t.calories - desired.calories) / desired.calories) ** 2 * 5 +
      ((t.protein - desired.protein) / desired.protein) ** 2 * 3 +
      ((t.fat - desired.fat) / desired.fat) ** 2 +
      Math.max(0, (desired.fiber - t.fiber) / desired.fiber) ** 2 * 0.5
    );
  }
  for (const step of [20, 10, 5, 1])
    for (let pass = 0; pass < 80; pass++) {
      let improved = false;
      for (const [key, , min, max] of recipe.ingredients) {
        const old = grams[key];
        let best = loss(),
          selected = old;
        for (const sign of [-1, 1]) {
          grams[key] = Math.max(min, Math.min(max, old + sign * step));
          // Optional ingredients at 0 are omitted from nutrient totals.
          const score = loss();
          if (score < best - 1e-9) {
            best = score;
            selected = grams[key];
            improved = true;
          }
        }
        grams[key] = selected;
      }
      if (!improved) break;
    }
  return Object.fromEntries(Object.entries(grams).filter(([, g]) => g > 0));
}
export function monday(date: string) {
  const day = new Date(date + "T12:00:00").getDay();
  return shiftDate(date, -((day + 6) % 7));
}
export function generateMenu(profile: Profile, date: string): WeeklyMenu {
  const goal = profile.targets ?? targets(profile, profile.initialWeight);
  return generateMenuForGoals(goal, profile.excluded, date);
}
export function generateMenuForGoals(
  goal: NutritionGoal,
  excluded: string[],
  date: string,
  dishes?: Pick<WeeklyMenu["meals"][number], "day" | "slot" | "recipe">[],
): WeeklyMenu {
  const meals: WeeklyMenu["meals"] = [];
  for (let day = 0; day < 7; day++)
    for (const slot of ["Desayuno", "Almuerzo", "Merienda", "Cena"] as Slot[]) {
      const pool = allowedRecipes(slot, excluded);
      if (!pool.length)
        throw new Error(
          `No hay opciones de ${slot.toLowerCase()} compatibles con tus exclusiones. Revisá las preferencias antes de generar.`,
        );
      const offset = slot === "Cena" ? 3 : slot === "Merienda" ? 2 : 0;
      const requested = dishes?.find((m) => m.day === day && m.slot === slot);
      const recipe = requested
        ? pool.find((r) => r.id === requested.recipe)
        : pool[(day + offset) % pool.length];
      if (!recipe)
        throw new Error(
          "El plato no respeta las preferencias compartidas. Prepará otro menú.",
        );
      meals.push({
        day,
        slot,
        recipe: recipe.id,
        portions: fitPortions(recipe, goal, slot),
      });
    }
  return { week: monday(date), targets: goal, meals };
}
export function shoppingList(menu: WeeklyMenu) {
  return combinedShoppingList([menu]);
}
export function combinedShoppingList(menus: WeeklyMenu[]) {
  const amounts: Record<string, number> = {};
  for (const meal of menus.flatMap((menu) => menu.meals))
    for (const [key, grams] of Object.entries(meal.portions))
      amounts[key] = (amounts[key] ?? 0) + grams;
  return menuFoods
    .filter((f) => amounts[f.key] > 0)
    .map((f) => ({ ...f, grams: amounts[f.key] }))
    .sort(
      (a, b) =>
        a.category.localeCompare(b.category) || a.name.localeCompare(b.name),
    );
}
export const groceryPackageSchema = z.object({
  app: z.literal("NutriDuo-compras"),
  week: z.string(),
  amounts: z.record(z.string(), z.number().finite().positive().max(100000)),
});
