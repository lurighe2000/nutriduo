import { useState } from "react";
import { Droplets, Utensils } from "lucide-react";
import { useApp } from "../../app/context";
import { meta } from "../../db";
import { haptic } from "../../components/motion";
import { dailyTotals } from "../../nutrition/formulas";
import { today } from "../../utils/date";
import { latestWeight, type DatedRun } from "./runShared";

/** What to eat and drink after today's run, tied to the day's targets. */
export default function RunRecovery({ run: entry }: { run: DatedRun }) {
  const { profile, data, repo, run, addMeal } = useApp();
  const [added, setAdded] = useState(false);
  const [busy, setBusy] = useState(false);
  if (entry.date !== today()) return null;
  const weight = latestWeight(data.weights) ?? 70;
  const minutes = entry.durationSeconds / 60;
  const protein = Math.round(Math.min(40, Math.max(15, weight * 0.3)));
  const carbs = minutes >= 45 ? Math.round(weight * 0.8) : 0;
  const ml = Math.min(
    1000,
    Math.max(250, Math.round((minutes * 10) / 50) * 50),
  );
  const goal = profile.targets?.protein ?? 0;
  const left = Math.max(
    0,
    Math.round(goal - dailyTotals(data.meals, entry.date).protein),
  );
  return (
    <section className="run-recovery" aria-label="Para recuperar">
      <span className="run-label">PARA RECUPERAR</span>
      <p>
        En las próximas 2 horas: <b>{protein} g de proteína</b>
        {carbs > 0 && (
          <>
            , <b>{carbs} g de carbohidratos</b>
          </>
        )}{" "}
        y <b>{ml} ml de agua</b>.
      </p>
      <span className="run-muted small">
        {goal
          ? left > 0
            ? `Hoy te quedan ${left} g de proteína para tu objetivo.`
            : "Ya cumpliste la proteína de hoy: con agua alcanza."
          : "Una comida con proteína y agua te ayudan a recuperar."}
      </span>
      <div className="run-recovery-actions">
        <button
          type="button"
          className="run-voice on"
          disabled={added || busy}
          onClick={() => {
            setBusy(true);
            haptic(12);
            void run(
              () =>
                repo.save("hydration", {
                  ...meta(profile.id),
                  date: entry.date,
                  ml,
                }),
              "Agua registrada",
            )
              .then((ok) => setAdded(ok))
              .finally(() => setBusy(false));
          }}
        >
          <Droplets size={16} />
          {added ? "Agua sumada" : `Sumar ${ml} ml`}
        </button>
        <button type="button" className="run-voice on" onClick={addMeal}>
          <Utensils size={16} />
          Registrar comida
        </button>
      </div>
    </section>
  );
}
