import { describe, it, expect } from "vitest";
import { meta } from "../db";
import { testProfiles as defaults } from "../test-profiles";
import {
  age,
  bmr,
  tdee,
  targets,
  scale,
  mealTotal,
  recipePortion,
  weightTrend,
  weightAverage,
  zero,
} from "./formulas";
import { adaptiveCoach } from "./adaptive";
import { aiItems, parseAnalysis } from "../services/ai";
import { csv } from "../services/export";
import { progression } from "../services/workouts";
import { type Item, type Records } from "../schemas";
import { rangeDates } from "../utils/date";
const p = defaults[0];
const item: Item = {
  id: "1",
  name: "Fixture",
  grams: 150,
  per100: { calories: 200, protein: 10, carbs: 20, fat: 8, fiber: 2 },
  source: "manual",
  cooking: "",
};
describe("motor nutricional", () => {
  it("calcula edad alrededor del cumpleaños", () => {
    expect(age(p.birthDate, "2026-06-14")).toBe(25);
    expect(age(p.birthDate, "2026-06-15")).toBe(26);
  });
  it("Mifflin para ambos perfiles", () => {
    expect(bmr(p, 60, "2026-09-17")).toBe(1531.25);
    expect(bmr(defaults[1], 69, "2026-09-17")).toBe(1450.25);
  });
  it("TDEE aplica actividad", () =>
    expect(tdee(p, 60, "2026-09-17")).toBeCloseTo(2105.46875));
  it("macros reproducen energía y conservan un punto inicial moderado", () => {
    const t = targets(p, 60, "2026-09-17");
    expect(t.calories).toBe(2255);
    expect(t.protein).toBe(108);
    expect(
      Math.abs(t.protein * 4 + t.carbs * 4 + t.fat * 9 - t.calories),
    ).toBeLessThanOrEqual(2);
    expect(targets(defaults[1], 69, "2026-09-17").calories).toBe(1566);
  });
  it("recalcula por gramos y porciones", () => {
    expect(mealTotal([item]).calories).toBe(300);
    expect(mealTotal([{ ...item, grams: 200 }]).protein).toBe(20);
    expect(
      recipePortion({
        ...meta("luca"),
        name: "Fixture",
        servings: 3,
        items: [item],
      }).calories,
    ).toBe(100);
    expect(scale(item.per100, 0.5).fiber).toBe(1);
  });
  it("promedios usan ventanas calendario sin interpolación", () => {
    const weights = [
      { ...meta("luca"), date: "2026-09-03", kg: 59 },
      { ...meta("luca"), date: "2026-09-04", kg: 60 },
      { ...meta("luca"), date: "2026-09-10", kg: 60 },
      { ...meta("luca"), date: "2026-09-17", kg: 61 },
    ];
    expect(weightAverage(weights, "2026-09-17")).toBe(61);
    expect(weightTrend(weights, "2026-09-17").change).toBe(1);
    expect(weightAverage([])).toBeNull();
  });
});
describe("IA externa", () => {
  const ai = {
    meal_name: "Fixture",
    confidence: 0.7,
    foods: [
      {
        name: "Fixture",
        estimated_grams: 200,
        calories: 300,
        protein_g: 20,
        carbs_g: 40,
        fat_g: 8,
        confidence: 0.7,
      },
    ],
    questions: [],
  };
  it("convierte totales de porción a base 100", () =>
    expect(aiItems(parseAnalysis(JSON.stringify(ai)))[0].per100.calories).toBe(
      150,
    ));
  it("rechaza negativos, faltantes y confianza inválida", () => {
    expect(() =>
      parseAnalysis(JSON.stringify({ ...ai, confidence: 2 })),
    ).toThrow();
    expect(() =>
      parseAnalysis(
        JSON.stringify({ ...ai, foods: [{ ...ai.foods[0], calories: -1 }] }),
      ),
    ).toThrow();
    expect(() => parseAnalysis('{"meal_name":"x"}')).toThrow();
  });
  it("repara sintaxis pero no inventa valores", () => {
    expect(
      parseAnalysis("```json\n" + JSON.stringify(ai) + "\n```", true).meal_name,
    ).toBe("Fixture");
    expect(() => parseAnalysis('{"meal_name":"x",}', true)).toThrow();
  });
});
describe("coach conservador", () => {
  const end = "2026-09-17",
    dates = rangeDates(end, 14),
    profile = { ...p, targets: targets(p, 60, end) };
  const weights = dates.map((date) => ({ ...meta("luca"), date, kg: 60 }));
  const meals: Records["meals"][] = dates.map((date) => ({
    ...meta("luca"),
    date,
    time: "12:00",
    name: "Fixture",
    type: "Almuerzo",
    notes: "",
    items: [
      {
        ...item,
        grams: 100,
        per100: {
          ...zero(),
          calories: profile.targets.calories,
          protein: profile.targets.protein,
        },
      },
    ],
  }));
  const full = dates.map((date) => ({ ...meta("luca"), date, complete: true }));
  const sessions: Records["sessions"][] = dates
    .filter((_, i) => i % 2 === 0)
    .map((date) => ({
      ...meta("luca"),
      date,
      dayId: "a",
      name: "Fixture",
      sets: [
        {
          exerciseId: "ex",
          exerciseName: "Fixture",
          kg: 20,
          reps: 12,
          rir: 2,
          notes: "",
        },
      ],
      notes: "",
    }));
  it("no reacciona a un solo peso", () =>
    expect(
      adaptiveCoach(
        profile,
        weights.slice(0, 1),
        meals,
        sessions,
        full,
        [],
        [],
        end,
      ).suggestedAction.amount,
    ).toBe(0));
  it("exige días completos explícitos", () =>
    expect(
      adaptiveCoach(profile, weights, meals, sessions, [], [], [], end)
        .suggestedAction.amount,
    ).toBe(0));
  it("propone +120 ante estancamiento con adherencia y fuerza", () => {
    const c = adaptiveCoach(
      profile,
      weights,
      meals,
      sessions,
      full,
      [],
      [],
      end,
    );
    expect(c.suggestedAction.amount).toBe(120);
    expect(c.requiresConfirmation).toBe(true);
  });
  it("no ajusta después de ajuste reciente", () =>
    expect(
      adaptiveCoach(
        profile,
        weights,
        meals,
        sessions,
        full,
        [
          {
            ...meta("luca"),
            date: end,
            amount: 120,
            previousCalories: 2000,
            explanation: "fixture",
          },
        ],
        [],
        end,
      ).suggestedAction.amount,
    ).toBe(0));
  it("toma en cuenta fatiga del check-in", () =>
    expect(
      adaptiveCoach(
        profile,
        weights,
        meals,
        sessions,
        full,
        [],
        [
          {
            ...meta("luca"),
            date: end,
            hunger: 3,
            energy: 1,
            sleep: 3,
            performance: 3,
            difficulty: 3,
            training: 3,
          },
        ],
        end,
      ).suggestedAction.amount,
    ).toBe(0));
  it("no propone subir carga con una sola sesión", () =>
    expect(
      progression(
        { id: "ex", name: "Fixture", sets: 1, minReps: 8, maxReps: 12 },
        sessions.slice(0, 1),
      ),
    ).toBe(false));
  it("propone progresión sólo con dos sesiones y RIR", () =>
    expect(
      progression(
        { id: "ex", name: "Fixture", sets: 1, minReps: 8, maxReps: 12 },
        sessions,
      ),
    ).toBe(true));
});
it("CSV escapa comillas y fórmulas de planilla", () => {
  const out = csv([{ Nombre: '=HYPERLINK("evil")', Kg: 60 }]);
  expect(out).toContain("'=HYPERLINK");
  expect(out).toContain('""evil""');
});
