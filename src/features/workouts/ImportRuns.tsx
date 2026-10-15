import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { useApp } from "../../app/context";
import { meta } from "../../db";
import { activitySchema } from "../../schemas";
import { Button, Modal } from "../../components/ui";
import { localDate } from "../../utils/date";
import type { ImportedRun } from "../../services/runImport";

/** Imports adidas Running exports and GPX files, skipping repeated runs. */
export default function ImportRuns() {
  const { profile, data, repo, run, notify } = useApp();
  const [importing, setImporting] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function saveImported(list: ImportedRun[], skipped: number) {
    const existing = data.activity.flatMap((a) =>
      (a.runs ?? []).map((r) => ({ ...r, date: a.date })),
    );
    const fresh = list.filter(
      (i) =>
        !existing.some(
          (r) =>
            (r.startedAt &&
              Math.abs(Date.parse(r.startedAt) - i.startedAt) < 120_000) ||
            (r.date === localDate(new Date(i.startedAt)) &&
              Math.abs(r.distanceKm - i.distanceKm) < 0.05 &&
              Math.abs(r.durationSeconds - i.durationSeconds) < 90),
        ),
    );
    const byDate = new Map<string, ImportedRun[]>();
    for (const i of fresh) {
      const date = localDate(new Date(i.startedAt));
      byDate.set(date, [...(byDate.get(date) ?? []), i]);
    }
    let saved = 0;
    const ok = await run(async () => {
      for (const [date, items] of byDate) {
        const record = data.activity.find((a) => a.date === date);
        const runs = items.map((i) => ({
          id: crypto.randomUUID(),
          kind: i.kind,
          distanceKm: i.distanceKm,
          durationSeconds: i.durationSeconds,
          calories: i.calories,
          maxSpeed: i.maxSpeed && i.maxSpeed <= 100 ? i.maxSpeed : undefined,
          elevation: i.elevation,
          heartRate:
            i.heartRate && i.heartRate >= 30 && i.heartRate <= 240
              ? i.heartRate
              : undefined,
          heartRateMax:
            i.heartRateMax && i.heartRateMax >= 30 && i.heartRateMax <= 250
              ? i.heartRateMax
              : undefined,
          source: i.source,
          notes: "",
          route: i.route,
          splits: i.splits?.every((x) => x <= 7200) ? i.splits : undefined,
          startedAt: new Date(i.startedAt).toISOString(),
        }));
        const next = activitySchema.safeParse({
          ...(record ?? meta(profile.id)),
          date,
          steps: record?.steps ?? 0,
          padel: record?.padel ?? false,
          runs: [...(record?.runs ?? []), ...runs].slice(-20),
        });
        if (!next.success) continue;
        await repo.save("activity", next.data);
        saved += runs.length;
      }
    });
    if (!ok) return;
    const repeated = list.length - fresh.length;
    notify(
      saved
        ? `Importé ${saved} ${saved === 1 ? "salida" : "salidas"}${repeated ? ` · ${repeated} ya estaban` : ""}`
        : repeated
          ? "Esas salidas ya estaban en NutriDuo"
          : `No encontré salidas para importar${skipped ? " (solo caminatas y carreras)" : ""}`,
    );
    if (saved) setImporting(false);
  }

  return (
    <>
      <button
        type="button"
        className="my-runs-import"
        onClick={() => setImporting(true)}
      >
        <Upload size={18} />
        Importar salidas de adidas Running o GPX
      </button>
      {importing && (
        <Modal title="Importar salidas" onClose={() => setImporting(false)}>
          <ol className="my-runs-steps">
            <li>
              En la web de adidas Running entrá a tu cuenta y pedí la
              exportación de tus datos (está en la configuración de la cuenta o
              en privacidad).
            </li>
            <li>Te llega un mail con un archivo .zip: descargalo.</li>
            <li>Elegilo acá. Traigo cada salida con su recorrido.</li>
          </ol>
          <p className="muted small">
            También sirven archivos .gpx de Strava, Samsung Health, Garmin u
            otras apps. Las salidas repetidas no se duplican.
          </p>
          <div className="actions">
            <Button
              disabled={importBusy}
              onClick={() => fileInput.current?.click()}
            >
              {importBusy ? "Importando…" : "Elegir archivo"}
            </Button>
          </div>
          <input
            ref={fileInput}
            type="file"
            hidden
            multiple
            accept=".zip,.gpx,.json,application/zip,application/gpx+xml,application/json"
            aria-label="Archivo de salidas"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              if (!files.length) return;
              setImportBusy(true);
              void import("../../services/runImport")
                .then(({ importRunFiles }) => importRunFiles(files))
                .then((result) => saveImported(result.runs, result.skipped))
                .catch(() =>
                  notify(
                    "No pude leer ese archivo. Probá con el .zip o un .gpx.",
                  ),
                )
                .finally(() => setImportBusy(false));
            }}
          />
        </Modal>
      )}
    </>
  );
}
