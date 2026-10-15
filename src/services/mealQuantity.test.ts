import { describe, expect, it } from "vitest";
import { foodSchema, itemSchema } from "../schemas";
import { itemTotal, recipePortion } from "../nutrition/formulas";
import {
  measurementOf,
  quantityFactor,
  quantityLabel,
  quantityReady,
  rebaseQuantity,
} from "./mealQuantity";

const egg = () =>
  itemSchema.parse({
    id: "egg",
    name: "Huevos",
    grams: 100,
    source: "manual",
    per100: { calories: 140, protein: 12, carbs: 1, fat: 10, fiber: 0 },
    measurement: { basis: "g", mode: "units", unitSize: 50 },
    micronutrientsPer100: { sodium_mg: 100 },
  });
describe("cantidades de comidas", () => {
  it("preserva dos huevos, su peso y sus nutrientes al guardar y editar", () => {
    const item = egg();
    expect(quantityLabel(item)).toBe("2 unidades · 100 g");
    expect(itemTotal(item).protein).toBe(12);
    const edited = itemSchema.parse(
      JSON.parse(JSON.stringify({ ...item, grams: 150 })),
    );
    expect(quantityLabel(edited)).toBe("3 unidades · 150 g");
    expect(itemTotal(edited)).toMatchObject({ calories: 210, protein: 18 });
  });
  it("no cambia los registros anteriores ni requiere una migración", () => {
    const { measurement: _measurement, ...legacy } = egg();
    expect(measurementOf(legacy)).toEqual({ basis: "g", mode: "g" });
    expect(quantityLabel(itemSchema.parse(legacy))).toBe("100 g");
  });
  it("trabaja directamente con etiquetas por 100 ml", () => {
    const item = {
      ...egg(),
      grams: 250,
      measurement: { basis: "ml", mode: "ml" } as const,
    };
    expect(quantityFactor(item.measurement)).toBe(1);
    expect(quantityLabel(item)).toBe("250 ml");
    expect(itemTotal(item).calories).toBe(350);
  });
  it("exige una equivalencia y no adivina el peso de una unidad o un mililitro", () => {
    const item = egg();
    expect(
      quantityReady({ ...item, measurement: { basis: "g", mode: "units" } }),
    ).toBe(false);
    expect(
      quantityReady({ ...item, measurement: { basis: "g", mode: "ml" } }),
    ).toBe(false);
    expect(
      itemSchema.safeParse({
        ...item,
        measurement: { basis: "g", mode: "units", unitSize: -1 },
      }).success,
    ).toBe(false);
    expect(quantityReady({ ...item, grams: NaN })).toBe(false);
    expect(quantityReady({ ...item, grams: 10001 })).toBe(false);
    expect(
      rebaseQuantity(
        { ...item, measurement: { basis: "ml", mode: "ml" } },
        "g",
      ),
    ).toBeUndefined();
  });
  it("convierte peso y volumen con la densidad indicada, en ambas direcciones", () => {
    expect(quantityFactor({ basis: "g", mode: "ml", gramsPerMl: 1.2 })).toBe(
      1.2,
    );
    expect(
      quantityFactor({ basis: "ml", mode: "g", gramsPerMl: 1.2 }),
    ).toBeCloseTo(1 / 1.2);
    const item = {
      ...egg(),
      grams: 100,
      measurement: {
        basis: "ml",
        mode: "units",
        unitSize: 50,
        gramsPerMl: 1.2,
      } as const,
    };
    const rebased = rebaseQuantity(item, "g")!;
    expect(rebased.grams).toBe(120);
    expect(rebased.measurement?.unitSize).toBe(60);
    expect(quantityLabel(rebased)).toBe("2 unidades · 120 g");
    expect(rebaseQuantity(rebased, "ml")?.grams).toBe(100);
  });
  it("fracciona recetas sin perder las unidades y recuerda la medida del alimento", () => {
    const item = egg();
    const portion = { ...item, grams: item.grams / 2 };
    expect(quantityLabel(portion)).toBe("1 unidad · 50 g");
    expect(
      recipePortion({
        id: "r",
        profileId: "luca",
        version: 1,
        createdAt: "",
        updatedAt: "",
        name: "Huevos",
        servings: 2,
        items: [item],
      }).protein,
    ).toBe(6);
    const food = foodSchema.parse({
      id: "f",
      profileId: "luca",
      version: 1,
      createdAt: "",
      updatedAt: "",
      name: item.name,
      source: "manual",
      per100: item.per100,
      servingSize: item.grams,
      measurement: item.measurement,
    });
    expect(food.measurement?.unitSize).toBe(50);
  });
});
