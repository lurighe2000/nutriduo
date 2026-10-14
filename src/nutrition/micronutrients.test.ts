import { it, expect } from "vitest";
import { micronutrientTotals, micronutrientExport } from "./micronutrients";
import { itemSchema } from "../schemas";
import { zero } from "./formulas";
const item = (
  grams: number,
  micronutrientsPer100?: { sodium_mg?: number; iron_mg?: number },
) =>
  itemSchema.parse({
    id: "fixture",
    name: "Fixture",
    grams,
    per100: zero(),
    source: "database",
    micronutrientsPer100,
  });
it("los micros se escalan por porción y no convierten ausencia en cero", () => {
  const result = micronutrientTotals([
    item(150, { sodium_mg: 20, iron_mg: 0 }),
    item(100),
  ]);
  expect(result.values).toEqual({ sodium_mg: 30, iron_mg: 0 });
  expect(result.coverage.sodium_mg).toBe(1);
  expect(result.count).toBe(2);
  expect(micronutrientTotals([item(100)]).values).toEqual({});
  expect(micronutrientExport(item(150, { sodium_mg: 20 }))).toEqual({
    sodium_mg: 30,
  });
});
