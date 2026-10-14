import type { Item, Micronutrients } from "../schemas";
export const MICRONUTRIENTS = {
  sodium_mg: ["Sodio", "mg"],
  potassium_mg: ["Potasio", "mg"],
  calcium_mg: ["Calcio", "mg"],
  iron_mg: ["Hierro", "mg"],
  magnesium_mg: ["Magnesio", "mg"],
  zinc_mg: ["Zinc", "mg"],
  vitamin_a_ug: ["Vitamina A (RAE)", "µg"],
  vitamin_c_mg: ["Vitamina C", "mg"],
  vitamin_d_ug: ["Vitamina D", "µg"],
  vitamin_e_mg: ["Vitamina E", "mg"],
  vitamin_b12_ug: ["Vitamina B12", "µg"],
  folate_ug: ["Folato total", "µg"],
} as const;
export type MicroKey = keyof typeof MICRONUTRIENTS;
export function micronutrientTotals(items: Item[]) {
  const values: Micronutrients = {},
    coverage: Partial<Record<MicroKey, number>> = {};
  for (const key of Object.keys(MICRONUTRIENTS) as MicroKey[]) {
    const known = items.filter(
      (i) => i.micronutrientsPer100?.[key] !== undefined,
    );
    if (known.length) {
      values[key] = known.reduce(
        (n, i) => n + (i.micronutrientsPer100![key]! * i.grams) / 100,
        0,
      );
      coverage[key] = known.length;
    }
  }
  return { values, coverage, count: items.length };
}
export function micronutrientExport(item: Item) {
  return Object.fromEntries(
    Object.entries(item.micronutrientsPer100 ?? {}).map(([key, value]) => [
      key,
      value === undefined ? undefined : (value * item.grams) / 100,
    ]),
  );
}
