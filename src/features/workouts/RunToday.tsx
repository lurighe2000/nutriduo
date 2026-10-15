import { ArrowRight, Footprints } from "lucide-react";
import { useApp } from "../../app/context";
import { calories, type RunKind } from "../../services/runTracker";
import { latestWeight } from "./runShared";

/** Today's runs on Inicio: distance and estimated energy spent. */
export default function RunToday() {
  const { data, date, navigate } = useApp();
  const runs = data.activity.find((a) => a.date === date)?.runs ?? [];
  if (!runs.length) return null;
  const km = runs.reduce((sum, r) => sum + r.distanceKm, 0);
  const weight = latestWeight(data.weights);
  const kcal = runs.reduce(
    (sum, r) =>
      sum + (r.calories ?? calories(r.kind as RunKind, r.distanceKm, weight)),
    0,
  );
  return (
    <button
      type="button"
      className="card run-today"
      onClick={() => navigate("entreno")}
    >
      <span className="run-today-icon" aria-hidden="true">
        <Footprints size={22} />
      </span>
      <span>
        <strong>
          {km.toFixed(1).replace(".", ",")} km{" "}
          {runs.length === 1 ? "en tu salida" : `en ${runs.length} salidas`}
        </strong>
        <small>~{kcal} kcal estimadas · ver Mis salidas</small>
      </span>
      <ArrowRight size={18} />
    </button>
  );
}
