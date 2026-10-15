import { useState } from "react";
import type { Item } from "../../schemas";
import { ChoicePicker, NumberField } from "../../components/ui";
import {
  measurementOf,
  quantityFactor,
  quantityReady,
  type Measurement,
} from "../../services/mealQuantity";
import "./quantity.css";

export default function MealQuantity({
  item,
  onChange,
}: {
  item: Item;
  onChange: (item: Item) => void;
}) {
  const m = measurementOf(item);
  const factor = quantityFactor(m);
  const [pendingAmount, setPendingAmount] = useState(1);
  const amount = factor ? item.grams / factor : pendingAmount;
  function update(next: Measurement, value = amount) {
    const multiplier = quantityFactor(next);
    setPendingAmount(value);
    onChange({
      ...item,
      grams: multiplier ? value * multiplier : item.grams,
      measurement: next,
    });
  }
  return (
    <div className="meal-quantity">
      <div className="meal-quantity-fields">
        <NumberField
          label={m.mode === "units" ? "Unidades" : `Cantidad (${m.mode})`}
          value={amount}
          min={0.01}
          max={factor ? Math.min(10000, 10000 / factor) : 10000}
          onChange={(n) => update(m, n)}
        />
        <ChoicePicker
          label="Medida"
          value={m.mode}
          options={[
            { value: "g", label: "Gramos (g)" },
            { value: "ml", label: "Mililitros (ml)" },
            { value: "units", label: "Unidades" },
          ]}
          onChange={(value) => {
            const mode = value as Measurement["mode"];
            // No nutrition has been entered yet: choose the label's basis too.
            const blank =
              item.source === "manual" &&
              !item.foodId &&
              Object.values(item.per100).every((n) => n === 0);
            const next = {
              ...m,
              mode,
              ...(blank && mode !== "units" ? { basis: mode } : {}),
            };
            const nextFactor = quantityFactor(next);
            update(next, nextFactor ? item.grams / nextFactor : 1);
          }}
        />
      </div>
      {m.mode === "units" && (
        <div className="meal-equivalence">
          <NumberField
            label={`Una unidad equivale a (${m.basis})`}
            value={m.unitSize ?? NaN}
            min={0.01}
            max={10000}
            onChange={(n) =>
              update({ ...m, unitSize: Number.isFinite(n) ? n : undefined })
            }
          />
          <p className="muted small">
            Usá el peso o volumen de una sola unidad, según la etiqueta o la
            balanza. Se guarda con este alimento.
          </p>
        </div>
      )}
      {m.mode !== "units" && m.mode !== m.basis && (
        <div className="meal-equivalence">
          <NumberField
            label="Peso de 100 ml (g)"
            value={m.gramsPerMl === undefined ? NaN : m.gramsPerMl * 100}
            min={0.01}
            max={10000}
            onChange={(n) =>
              update({
                ...m,
                gramsPerMl: Number.isFinite(n) ? n / 100 : undefined,
              })
            }
          />
          <p className="muted small">
            La ficha está por 100 {m.basis}. Necesitamos esta equivalencia para
            convertir entre gramos y mililitros.
          </p>
        </div>
      )}
      <p className="muted small meal-quantity-summary" aria-live="polite">
        {quantityReady(item)
          ? `Se calcula sobre ${item.grams.toLocaleString("es-AR", { maximumFractionDigits: 3 })} ${m.basis}.`
          : "Completá la cantidad y su equivalencia para calcular los nutrientes."}
      </p>
    </div>
  );
}
