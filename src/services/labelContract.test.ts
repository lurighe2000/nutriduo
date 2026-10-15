import { describe, expect, it } from "vitest";
import { labelPer100, labelResponseSchema } from "./labelContract";

describe("lectura de etiquetas", () => {
  it("pasa una etiqueta por porción a valores cada 100 g", () => {
    const parsed = labelResponseSchema.parse({
      status: "ready",
      label: {
        name: null,
        brand: null,
        basis: "per_portion",
        portion_g: 30,
        unit: "g",
        calories: 120,
        protein_g: 3,
        carbs_g: 21,
        fat_g: 2.4,
        fiber_g: null,
        sugars_g: 9,
        saturated_fat_g: 1.2,
        sodium_mg: 60,
      },
    });
    if (parsed.status !== "ready") throw new Error("expected ready");
    const values = labelPer100(parsed.label);
    expect(values.per100).toEqual({
      calories: 400,
      protein: 10,
      carbs: 70,
      fat: 8,
      fiber: 0,
    });
    expect(values.fiberKnown).toBe(false);
    expect(values.sodiumMg).toBe(200);
    expect(values.servingSize).toBe(30);
  });

  it("acepta que la etiqueta sea ilegible", () => {
    expect(
      labelResponseSchema.parse({ status: "unreadable", reason: "borrosa" })
        .status,
    ).toBe("unreadable");
  });
});
