import { useState } from "react";
import { useApp } from "../../app/context";
import { meta } from "../../db";
import { dateSchema } from "../../schemas";
import { Button, Field, NumberField } from "../../components/ui";
import {
  readFemmtoPDF,
  reportFeedback,
  type FemmtoReading,
} from "../../services/femmto";
import { niceDate, today } from "../../utils/date";
export default function FemmtoReports() {
  const { profile: p, data, repo, run, date, setDate } = useApp();
  const [reading, setReading] = useState<FemmtoReading>(),
    [fileName, setFileName] = useState(""),
    [busy, setBusy] = useState(false),
    [reviewed, setReviewed] = useState(false);
  const rows = data.weights.filter(
    (w) => w.date <= date && w.composition?.reportFile,
  );
  const feedback = reportFeedback(rows);
  return (
    <>
      <section className="card">
        <h2>Informe semanal de Femmto</h2>
        <p>
          Los domingos, exportá el informe desde Femmto y elegí el PDF acá. La
          lectura y la devolución se hacen en este dispositivo; el PDF no se
          envía a Groq ni se conserva. Guardamos únicamente los datos que
          confirmes.
        </p>
        <Field
          label="Subir PDF de Femmto"
          type="file"
          disabled={busy}
          accept="application/pdf,.pdf"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setReading(undefined);
            setReviewed(false);
            setBusy(true);
            void run(async () => {
              const value = await readFemmtoPDF(file);
              setReading(value);
              setFileName(file.name.slice(0, 200));
            }, "Informe leído: revisá antes de guardar").finally(() =>
              setBusy(false),
            );
            e.target.value = "";
          }}
        />
        {busy && <p role="status">Leyendo informe…</p>}
        <p className="muted small">
          Formato compatible: peso, IMC, grasa corporal, músculo esquelético y
          agua cuando puedan leerse. Un PDF escaneado u otro formato puede
          requerir carga manual en Balanza. Los datos no detectados no se
          inventan.
        </p>
        {reading && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!reviewed) return;
              setBusy(true);
              void run(async () => {
                const validDate = dateSchema.parse(reading.date);
                if (validDate > today())
                  throw new Error("La fecha de medición no puede ser futura");
                const old = data.weights.find((w) => w.date === validDate);
                const existing = old?.composition?.metrics ?? [];
                const metrics = [
                  ...existing.filter(
                    (m) =>
                      !reading.metrics.some(
                        (r) => r.name === m.name && r.unit === m.unit,
                      ),
                  ),
                  ...reading.metrics,
                ];
                await repo.save("weights", {
                  ...(old ?? meta(p.id)),
                  date: validDate,
                  kg: reading.kg,
                  composition: {
                    source: "Femmto",
                    reportFile: fileName,
                    notes:
                      old?.composition?.notes ??
                      "Importado de un informe Femmto; valores revisados.",
                    metrics,
                  },
                });
                setReading(undefined);
                setReviewed(false);
                setDate(validDate);
              }, "Informe guardado: consultá la devolución abajo").finally(() =>
                setBusy(false),
              );
            }}
          >
            <h3>Revisar antes de guardar · {p.name}</h3>
            <p>
              Nombre detectado: {reading.name || "No disponible"}. Comprobá que
              sea el perfil correcto.
            </p>
            <div className="form-grid">
              <Field
                label="Fecha de la medición del informe"
                type="date"
                required
                max={today()}
                value={reading.date}
                onChange={(e) =>
                  setReading({ ...reading, date: e.target.value })
                }
              />
              <NumberField
                label="Peso detectado (kg)"
                value={reading.kg}
                min={25}
                max={350}
                onChange={(kg) => setReading({ ...reading, kg })}
              />
            </div>
            {reading.metrics.map((m, i) => (
              <div className="history-row" key={`${m.name}:${m.unit}`}>
                <NumberField
                  label={`${m.name} (${m.unit})`}
                  value={m.value}
                  max={m.unit === "%" ? 100 : 10000}
                  onChange={(value) =>
                    setReading({
                      ...reading,
                      metrics: reading.metrics.map((x, j) =>
                        i === j ? { ...x, value } : x,
                      ),
                    })
                  }
                />
                <Button
                  secondary
                  onClick={() =>
                    setReading({
                      ...reading,
                      metrics: reading.metrics.filter((_, j) => i !== j),
                    })
                  }
                >
                  Omitir
                </Button>
              </div>
            ))}
            {data.weights.some((w) => w.date === reading.date) && (
              <p className="notice">
                Ya hay un pesaje en esta fecha. Se reemplaza el peso y se
                actualizan los datos detectados; los otros datos de la balanza
                se conservan.
              </p>
            )}
            <label className="checkbox">
              <input
                type="checkbox"
                required
                checked={reviewed}
                onChange={(e) => setReviewed(e.target.checked)}
              />
              Revisé el perfil, la fecha y los valores del PDF.
            </label>
            <Button type="submit" disabled={!reviewed || busy}>
              Confirmar informe
            </Button>
          </form>
        )}
      </section>
      <section className="card">
        <h3>Tu devolución</h3>
        {feedback.map((line) => (
          <p key={line}>{line}</p>
        ))}
        <p className="muted small">
          Compara informes hasta la fecha seleccionada. Para los ajustes de
          alimentación, seguí usando Progreso → Mi análisis, que también
          considera comidas completas, pesajes y entrenamiento.
        </p>
      </section>
      <section className="card">
        <h3>Informes guardados</h3>
        {[...rows]
          .sort((a, b) => b.date.localeCompare(a.date))
          .map((w) => (
            <details className="session-history" key={w.id}>
              <summary>
                {niceDate(w.date)} · {w.kg} kg
              </summary>
              <p>{w.composition?.reportFile}</p>
              {w.composition?.metrics.map((m) => (
                <p key={`${m.name}:${m.unit}`}>
                  {m.name}: {m.value} {m.unit}
                </p>
              ))}
            </details>
          ))}
        {!rows.length && (
          <p className="muted">Todavía no hay informes guardados.</p>
        )}
      </section>
    </>
  );
}
