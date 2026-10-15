import { describe, expect, it } from "vitest";
import { companionState } from "./mascotState";
const base = {
  meals: 3,
  protein: 1,
  water: 1,
  calories: 1,
  complete: false,
  currentDay: true,
};
describe("compañero según registros", () => {
  it("no interpreta datos ausentes ni un día histórico como un fracaso", () => {
    expect(
      companionState({
        ...base,
        meals: 0,
        protein: 0,
        water: 0,
        complete: true,
      }).mood,
    ).toBe("neutral");
    expect(companionState({ ...base, protein: 0, water: 0 }).mood).toBe(
      "happy",
    );
    expect(
      companionState({ ...base, currentDay: false, complete: true, water: 0 })
        .mood,
    ).toBe("neutral");
  });
  it("acompaña un día cerrado incompleto y enlaza el área que falta", () => {
    expect(
      companionState({ ...base, complete: true, water: 0.2 }),
    ).toMatchObject({ mood: "support", focus: "water" });
    expect(
      companionState({ ...base, complete: true, protein: 0.4 }),
    ).toMatchObject({ mood: "support", focus: "protein" });
  });
  it("celebra llegar sin pedir exceder las metas", () => {
    expect(companionState({ ...base, complete: true }).mood).toBe("celebrate");
    expect(companionState({ ...base, complete: true, calories: 2 }).mood).toBe(
      "happy",
    );
  });
  it("trata valores no finitos como datos faltantes", () => {
    expect(
      companionState({ ...base, water: NaN, protein: Infinity }).focus,
    ).toBe("water");
  });
  it("reconoce un entrenamiento sin exigir más ejercicio y respeta el descanso", () => {
    expect(companionState({ ...base, trained: true })).toMatchObject({
      mood: "celebrate",
      focus: "training",
    });
    expect(companionState({ ...base, trained: false }).mood).toBe("happy");
    expect(
      companionState({ ...base, trained: true, currentDay: false }).mood,
    ).toBe("neutral");
  });
});
