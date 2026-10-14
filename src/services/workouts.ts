import { meta } from "../db";
import type { Exercise, Profile, Records } from "../schemas";
function exercise(name: string, minReps = 8, maxReps = 12): Exercise {
  return { id: crypto.randomUUID(), name, sets: 3, minReps, maxReps };
}
export function initialPlan(p: Profile): Records["plans"] {
  return {
    ...meta(p.id),
    name: "Fuerza · base de 3 días",
    days: [
      {
        id: "a",
        name: "Día A · Base y empuje",
        exercises: [
          "Prensa o sentadilla goblet",
          "Press de pecho con mancuernas",
          "Remo sentado",
          "Peso muerto rumano",
          "Plancha (repeticiones de 10 s)",
        ].map((n) => exercise(n)),
      },
      {
        id: "b",
        name: "Día B · Espalda y piernas",
        exercises: [
          "Sentadilla goblet",
          "Jalón al pecho",
          "Press de hombros",
          "Puente de glúteos",
          "Curl de bíceps",
        ].map((n) => exercise(n)),
      },
      {
        id: "c",
        name: "Día C · Cuerpo completo",
        exercises: [
          "Prensa",
          "Remo con mancuerna",
          "Press inclinado",
          "Curl femoral",
          "Extensión de tríceps",
          "Dead bug",
        ].map((n) => exercise(n)),
      },
    ],
  };
}
export function progression(ex: Exercise, sessions: Records["sessions"][]) {
  const recent = [...sessions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((s) => s.sets.some((v) => v.exerciseId === ex.id))
    .slice(0, 2);
  if (recent.length < 2) return false;
  const sets = recent.map((s) => s.sets.filter((v) => v.exerciseId === ex.id));
  const loads = sets.flat().map((s) => s.kg);
  return (
    new Set(loads).size === 1 &&
    sets.every(
      (s) =>
        s.length >= ex.sets &&
        s.every((v) => v.reps >= ex.maxReps && (v.rir ?? 0) >= 2),
    )
  );
}
export function homePlan(p: Profile): Records["plans"] {
  return {
    ...meta(p.id),
    name: "Fuerza en casa · 2 días",
    days: [
      {
        id: crypto.randomUUID(),
        name: "Casa A · Cuerpo completo",
        exercises: [
          "Sentarse y levantarse de una silla estable",
          "Flexiones contra pared o apoyo alto estable",
          "Remo con mochila liviana · por lado",
          "Puente de glúteos",
          "Bird-dog · por lado",
        ].map((name) => ({ ...exercise(name), sets: 2 })),
      },
      {
        id: crypto.randomUUID(),
        name: "Casa B · Cuerpo completo",
        exercises: [
          "Sentadilla a silla estable",
          "Flexiones contra pared o apoyo alto estable",
          "Remo con mochila liviana · por lado",
          "Elevaciones de talones con apoyo",
          "Dead bug · por lado",
        ].map((name) => ({ ...exercise(name), sets: 2 })),
      },
    ],
  };
}
