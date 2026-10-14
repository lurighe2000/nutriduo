import { useState } from "react";
import { useApp } from "../../app/context";
import { meta } from "../../db";
import { type Records } from "../../schemas";
import { Button, Field, Modal, NumberField, Select } from "../../components/ui";
import { niceDate } from "../../utils/date";

type Metric = NonNullable<Records["weights"]["composition"]>["metrics"][number];
const defaultUnit = (name: string): Metric["unit"] =>
  ["IMC", "Grasa visceral"].includes(name)
    ? "índice"
    : name === "Metabolismo basal"
      ? "kcal/día"
      : name === "Edad metabólica"
        ? "años"
        : name === "Masa de grasa corporal"
          ? "kg"
          : "%";
const names = [
  "Grasa corporal",
  "IMC",
  "Tejido magro",
  "Tejido óseo",
  "Masa de grasa corporal",
  "Masa muscular",
  "Músculo esquelético",
  "Agua corporal",
  "Masa ósea",
  "Masa libre de grasa",
  "Grasa visceral",
  "Metabolismo basal",
  "Edad metabólica",
];
export default function WeightEntry({ onClose }: { onClose: () => void }) {
  const { profile, date, data, repo, run } = useApp();
  const old = data.weights.find((w) => w.date === date);
  const [kg, setKg] = useState(
    old?.kg ??
      [...data.weights].sort((a, b) => b.date.localeCompare(a.date))[0]?.kg ??
      profile.initialWeight,
  );
  const [metrics, setMetrics] = useState<Metric[]>(
    old?.composition?.metrics ?? [],
  );
  const [source, setSource] = useState(old?.composition?.source ?? "Femmto");
  const [notes, setNotes] = useState(old?.composition?.notes ?? "");
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Peso y datos de la balanza" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          void run(async () => {
            if (
              new Set(metrics.map((m) => `${m.name}:${m.unit}`)).size !==
              metrics.length
            )
              throw new Error("Hay un dato repetido. Revisá los campos.");
            await repo.save("weights", {
              ...(old ?? meta(profile.id)),
              date,
              kg,
              composition:
                metrics.length || notes
                  ? {
                      source,
                      notes,
                      metrics,
                      reportFile: old?.composition?.reportFile,
                    }
                  : undefined,
            });
            onClose();
          }, "Pesaje guardado").finally(() => setBusy(false));
        }}
      >
        <p>
          {niceDate(date)} · {profile.name}
        </p>
        <NumberField
          label="Peso (kg)"
          value={kg}
          min={25}
          max={350}
          onChange={setKg}
        />
        <h3>Otros datos de la balanza · opcionales</h3>
        <p className="muted small">
          Copiá sólo los datos que muestre Femmto y elegí la misma unidad. Dejá
          sin agregar los datos ausentes. No se importan por Bluetooth.
        </p>
        {metrics.map((m, i) => (
          <div className="card" key={i}>
            <Select
              label="Dato"
              value={m.name}
              options={names}
              onChange={(name) =>
                setMetrics((v) =>
                  v.map((x, j) =>
                    j === i ? { ...x, name, unit: defaultUnit(name) } : x,
                  ),
                )
              }
            />
            <div className="form-grid">
              <NumberField
                label={`Valor de ${m.name}`}
                value={m.value}
                max={m.unit === "%" ? 100 : 10000}
                onChange={(value) =>
                  setMetrics((v) =>
                    v.map((x, j) => (j === i ? { ...x, value } : x)),
                  )
                }
              />
              <Select
                label="Unidad"
                value={m.unit}
                options={["%", "kg", "L", "kcal/día", "índice", "años"]}
                onChange={(unit) =>
                  setMetrics((v) =>
                    v.map((x, j) =>
                      j === i ? { ...x, unit: unit as Metric["unit"] } : x,
                    ),
                  )
                }
              />
            </div>
            <Button
              secondary
              onClick={() => setMetrics((v) => v.filter((_, j) => j !== i))}
            >
              Quitar dato
            </Button>
          </div>
        ))}
        <Button
          secondary
          disabled={metrics.length >= 20}
          onClick={() =>
            setMetrics((v) => {
              const name =
                names.find((n) => !v.some((m) => m.name === n)) ?? names[0];
              return [
                ...v,
                {
                  name,
                  value: NaN,
                  unit: defaultUnit(name),
                },
              ];
            })
          }
        >
          Agregar dato de la balanza
        </Button>
        {metrics.length > 0 && (
          <Field
            label="Balanza / fuente"
            value={source}
            maxLength={80}
            onChange={(e) => setSource(e.target.value)}
          />
        )}
        <Field
          label="Notas del pesaje (opcional)"
          value={notes}
          maxLength={500}
          placeholder="Por la mañana, antes de desayunar…"
          onChange={(e) => setNotes(e.target.value)}
        />
        <p className="notice small">
          La composición por bioimpedancia es una estimación sensible a la
          hidratación. Compará mediciones en condiciones similares: misma
          balanza, horario y antes de entrenar. NutriDuo ajusta sus sugerencias
          con la tendencia del peso y tu seguimiento; estos valores no cambian
          las calorías automáticamente.
        </p>
        <p className="muted small">
          Un registro por día. Al guardar de nuevo esta fecha, se reemplazan el
          peso y los datos que revisaste.
        </p>
        <Button type="submit" disabled={busy}>
          {busy ? "Guardando…" : "Guardar pesaje"}
        </Button>
      </form>
    </Modal>
  );
}
