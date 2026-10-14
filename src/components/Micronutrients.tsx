import type { Item } from "../schemas";
import {
  MICRONUTRIENTS,
  micronutrientTotals,
  type MicroKey,
} from "../nutrition/micronutrients";
export default function Micronutrients({ items }: { items: Item[] }) {
  const { values, coverage, count } = micronutrientTotals(items);
  return (
    <details className="micronutrients">
      <summary>Sodio, vitaminas y minerales</summary>
      <p className="muted small">
        Se muestran los datos de etiquetas o fichas seleccionadas. Las
        cantidades consumidas siguen siendo aproximadas. Sin dato no equivale a
        cero.
      </p>
      {!Object.keys(values).length ? (
        <p className="muted small">
          Sin datos adicionales para estos componentes.
        </p>
      ) : (
        <dl className="micro-grid">
          {(Object.keys(values) as MicroKey[]).map((key) => (
            <div key={key}>
              <dt>{MICRONUTRIENTS[key][0]}</dt>
              <dd>
                ≈{" "}
                {values[key]!.toLocaleString("es-AR", {
                  maximumFractionDigits: 2,
                })}{" "}
                {MICRONUTRIENTS[key][1]}
                <small>
                  {coverage[key] === count
                    ? "Todos los componentes"
                    : `Parcial: ${coverage[key]} de ${count} componentes`}
                </small>
              </dd>
            </div>
          ))}
        </dl>
      )}
    </details>
  );
}
