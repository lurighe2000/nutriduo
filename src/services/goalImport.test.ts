import { expect, it } from "vitest";
import { importGoals } from "./goalImport";
import { testProfiles as defaults } from "../test-profiles";
import { targets } from "../nutrition/formulas";
it("importa únicamente el perfil activo y preserva cumpleaños, PIN e historial planificado", () => {
  const p = { ...defaults[0], pinHash: "fixture-pin" };
  const text = JSON.stringify({
    app: "NutriDuo-objetivos",
    profiles: defaults.map((x) => ({
      id: x.id,
      assessmentAge: 30,
      height: 170,
      initialWeight: 70,
      activity: 1.375,
      gymDays: 2,
      goal: x.goal,
      excluded: [],
      targets: targets(x, x.initialWeight),
    })),
  });
  const result = importGoals(text, p);
  expect(result.profile.pinHash).toBe("fixture-pin");
  expect(result.profile.birthDate).toBe(p.birthDate);
  expect(result.profile.id).toBe(p.id);
  expect(result.profile.initialWeight).toBe(70);
});
