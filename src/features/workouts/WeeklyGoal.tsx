import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { useApp } from "../../app/context";
import { Celebration, haptic } from "../../components/motion";
import { rangeDates, today } from "../../utils/date";

const DEFAULT_GOAL_KM = 20;
const goalKey = (profileId: string) => `nutriduo-run-goal-${profileId}`;
function readGoal(profileId: string) {
  try {
    const v = Number(localStorage.getItem(goalKey(profileId)));
    if (v >= 1 && v <= 300) return v;
  } catch {
    // Default below.
  }
  return DEFAULT_GOAL_KM;
}

/** Weekly km ring; tap it to change the goal. */
export default function WeeklyGoal() {
  const { profile, data } = useApp();
  const [goal, setGoal] = useState(() => readGoal(profile.id));
  const [editingGoal, setEditingGoal] = useState(false);
  const week = new Set(rangeDates(today(), 7));
  const weekRuns = data.activity
    .filter((a) => week.has(a.date))
    .flatMap((a) => a.runs ?? []);
  const weekKm = weekRuns.reduce((sum, r) => sum + r.distanceKm, 0);
  const progress = Math.min(1, weekKm / goal);
  const reached = weekKm >= goal && weekKm > 0;
  // Suggested goal: last four weeks' average plus 10 %.
  const fourWeeks = new Set(rangeDates(today(), 28));
  const monthKm = data.activity
    .filter((a) => fourWeeks.has(a.date))
    .flatMap((a) => a.runs ?? [])
    .reduce((sum, r) => sum + r.distanceKm, 0);
  const suggested = Math.max(5, Math.round((monthKm / 4) * 1.1));
  const changeGoal = (value: number) => {
    const next = Math.max(1, Math.min(300, Math.round(value)));
    setGoal(next);
    haptic(6);
    try {
      localStorage.setItem(goalKey(profile.id), String(next));
    } catch {
      // Ignore.
    }
  };

  return (
    <>
      <button
        type="button"
        className={`my-runs-week duo-burst-anchor ${reached ? "reached" : ""}`}
        aria-expanded={editingGoal}
        aria-label={`Meta semanal: ${weekKm.toFixed(1)} de ${goal} km. Tocá para cambiarla`}
        onClick={() => setEditingGoal((v) => !v)}
      >
        <svg viewBox="0 0 112 112" aria-hidden="true">
          <circle className="track" cx="56" cy="56" r="48" />
          <circle
            className="fill"
            cx="56"
            cy="56"
            r="48"
            style={{ strokeDashoffset: 301.6 * (1 - progress) }}
          />
        </svg>
        <div>
          <span className="run-label">ESTA SEMANA</span>
          <strong className="run-gradient">
            {weekKm.toFixed(1).replace(".", ",")} km
          </strong>
          <span className="run-muted">
            {reached
              ? "¡Meta cumplida!"
              : `de ${goal} km · ${weekRuns.length} ${weekRuns.length === 1 ? "salida" : "salidas"}`}
          </span>
        </div>
        <Celebration show={reached} />
      </button>
      {editingGoal && (
        <div className="my-runs-goal">
          <span className="run-label">META SEMANAL</span>
          <div className="my-runs-goal-row">
            <button
              type="button"
              className="run-round small"
              aria-label="Bajar la meta"
              onClick={() => changeGoal(goal - 1)}
            >
              <Minus size={18} />
            </button>
            <strong>{goal} km</strong>
            <button
              type="button"
              className="run-round small"
              aria-label="Subir la meta"
              onClick={() => changeGoal(goal + 1)}
            >
              <Plus size={18} />
            </button>
          </div>
          {suggested !== goal && (
            <button
              type="button"
              className="run-voice on"
              onClick={() => changeGoal(suggested)}
            >
              Sugerida para vos: {suggested} km
            </button>
          )}
        </div>
      )}
    </>
  );
}
