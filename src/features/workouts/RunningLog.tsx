import { useState } from "react";
import { useApp } from "../../app/context";
import { meta } from "../../db";
import { activitySchema, type Records } from "../../schemas";
import {
  Button,
  Field,
  Modal,
  Confirm,
  ChoicePicker,
} from "../../components/ui";
type Run = NonNullable<Records["activity"]["runs"]>[number];
const formatPace = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
export const formatDuration = (seconds: number) =>
  [
    Math.floor(seconds / 3600),
    Math.floor((seconds % 3600) / 60),
    Math.round(seconds % 60),
  ]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
export default function RunningLog({ onClose }: { onClose: () => void }) {
  const { profile, date, data, repo, run } = useApp();
  const [kind, setKind] = useState<Run["kind"]>("Caminata y trote");
  const [distance, setDistance] = useState("");
  const [duration, setDuration] = useState("");
  const [calories, setCalories] = useState("");
  const [speed, setSpeed] = useState("");
  const [elevation, setElevation] = useState("");
  const [pulse, setPulse] = useState("");
  const [source, setSource] = useState("Adidas Running");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string>();
  const [remove, setRemove] = useState<string>();
  const [busy, setBusy] = useState(false);
  const record = data.activity.find((a) => a.date === date);
  const runs = record?.runs ?? [];
  const number = (value: string) => Number(value.trim().replace(",", "."));
  const optional = (value: string) =>
    value.trim() ? number(value) : undefined;
  function reset() {
    setEditing(undefined);
    setDistance("");
    setDuration("");
    setCalories("");
    setSpeed("");
    setElevation("");
    setPulse("");
    setNotes("");
    setError("");
  }
  return (
    <Modal title="Salidas: caminata y trote" onClose={onClose}>
      <p>
        Cargá los datos de tu salida en la fecha seleccionada. Ritmo y velocidad
        media se calculan con distancia y duración.
      </p>
      {runs.map((r) => (
        <article className="card" key={r.id}>
          <strong>
            {r.kind} · {r.distanceKm} km · {formatDuration(r.durationSeconds)}
          </strong>
          <p>
            Ritmo: {formatPace(Math.round(r.durationSeconds / r.distanceKm))}{" "}
            min/km · Velocidad media:{" "}
            {((r.distanceKm * 3600) / r.durationSeconds).toFixed(1)} km/h
          </p>
          {r.calories !== undefined && (
            <p>
              {r.calories} kcal estimadas · {r.source}
            </p>
          )}
          {r.elevation !== undefined && <p>Desnivel: {r.elevation} m</p>}
          {r.maxSpeed !== undefined && (
            <p>Velocidad máxima: {r.maxSpeed} km/h</p>
          )}
          {r.heartRate !== undefined && <p>Pulso medio: {r.heartRate} lpm</p>}
          {r.notes && <p>{r.notes}</p>}
          <div className="actions">
            <Button
              secondary
              onClick={() => {
                setEditing(r.id);
                setKind(r.kind);
                setDistance(String(r.distanceKm));
                setDuration(formatDuration(r.durationSeconds));
                setCalories(r.calories === undefined ? "" : String(r.calories));
                setSpeed(r.maxSpeed === undefined ? "" : String(r.maxSpeed));
                setElevation(
                  r.elevation === undefined ? "" : String(r.elevation),
                );
                setPulse(r.heartRate === undefined ? "" : String(r.heartRate));
                setSource(r.source);
                setNotes(r.notes);
                setError("");
              }}
            >
              Editar salida
            </Button>
            <Button secondary onClick={() => setRemove(r.id)}>
              Eliminar salida
            </Button>
          </div>
        </article>
      ))}
      <h3>{editing ? "Editar registro" : "Agregar salida"}</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (busy) return;
          setError("");
          const match = /^(\d{1,2}):([0-5]\d):([0-5]\d)$/.exec(duration.trim());
          if (!match) {
            setError(
              "Ingresá la duración como hh:mm:ss, por ejemplo 00:46:44.",
            );
            return;
          }
          const seconds =
            Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
          const entry = {
            // Keep GPS route, splits and cadence when editing a tracked run.
            ...runs.find((r) => r.id === editing),
            id: editing ?? crypto.randomUUID(),
            kind,
            distanceKm: number(distance),
            durationSeconds: seconds,
            calories: optional(calories),
            maxSpeed: optional(speed),
            elevation: optional(elevation),
            heartRate: optional(pulse),
            source,
            notes,
          };
          const next = {
            ...(record ?? meta(profile.id)),
            date,
            steps: record?.steps ?? 0,
            padel: record?.padel ?? false,
            runs: editing
              ? runs.map((r) => (r.id === editing ? entry : r))
              : [...runs, entry],
          };
          const valid = activitySchema.safeParse(next);
          if (!valid.success) {
            setError(
              "Revisá distancia, duración y los datos opcionales: deben ser valores válidos.",
            );
            return;
          }
          setBusy(true);
          void run(() => repo.save("activity", valid.data), "Salida guardada")
            .then((ok) => {
              if (ok) reset();
            })
            .finally(() => setBusy(false));
        }}
      >
        <ChoicePicker
          label="Tipo de salida"
          value={kind}
          onChange={(value) => setKind(value as Run["kind"])}
          options={["Caminata", "Caminata y trote", "Carrera"].map((value) => ({
            value,
            label: value,
          }))}
        />
        <div className="form-grid">
          <Field
            label="Distancia (km)"
            inputMode="decimal"
            required
            value={distance}
            onChange={(e) => setDistance(e.target.value)}
          />
          <Field
            label="Duración (hh:mm:ss)"
            placeholder="00:46:44"
            required
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          />
          <Field
            label="Calorías estimadas (opcional)"
            inputMode="decimal"
            value={calories}
            onChange={(e) => setCalories(e.target.value)}
          />
          <Field
            label="Velocidad máxima km/h (opcional)"
            inputMode="decimal"
            value={speed}
            onChange={(e) => setSpeed(e.target.value)}
          />
          <Field
            label="Desnivel ganado m (opcional)"
            inputMode="decimal"
            value={elevation}
            onChange={(e) => setElevation(e.target.value)}
          />
          <Field
            label="Pulso medio lpm (opcional)"
            inputMode="numeric"
            value={pulse}
            onChange={(e) => setPulse(e.target.value)}
          />
        </div>
        <Field
          label="Fuente del registro"
          maxLength={80}
          value={source}
          onChange={(e) => setSource(e.target.value)}
        />
        <Field
          label="Notas de la salida"
          maxLength={1000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <p className="muted small">
          Copiás estos datos manualmente desde Adidas Running u otra app. Las
          calorías son estimadas y no se suman a tu objetivo de comida.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="actions">
          <Button type="submit" disabled={busy}>
            {busy ? "Guardando…" : "Guardar salida"}
          </Button>
          {editing && (
            <Button secondary onClick={reset}>
              Cancelar edición
            </Button>
          )}
        </div>
      </form>
      {remove && (
        <Confirm
          title="¿Eliminar esta salida?"
          onClose={() => setRemove(undefined)}
          onConfirm={() => {
            if (!record) return;
            void run(
              () =>
                repo.save("activity", {
                  ...record,
                  runs: runs.filter((r) => r.id !== remove),
                }),
              "Salida eliminada",
            ).then((ok) => {
              if (ok) {
                if (editing === remove) reset();
                setRemove(undefined);
              }
            });
          }}
        >
          Se elimina este registro de la fecha seleccionada.
        </Confirm>
      )}
    </Modal>
  );
}
