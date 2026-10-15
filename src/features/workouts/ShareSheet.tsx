import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, ImagePlus, Share2, X } from "lucide-react";
import { useDialogBack } from "../../app/navigation";
import { useApp } from "../../app/context";
import {
  decodeRoute,
  formatClock,
  formatPace,
} from "../../services/runTracker";
import {
  canvasBlob,
  renderShareCard,
  type ShareTemplate,
} from "../../services/runShare";
import type { DatedRun } from "./runShared";

const LABELS: Record<string, string> = {
  Carrera: "Corrida",
  "Caminata y trote": "Trote",
  Caminata: "Caminata",
};
const TEMPLATES: { id: ShareTemplate; label: string }[] = [
  { id: "foto", label: "Con foto" },
  { id: "mapa", label: "Mapa" },
  { id: "color", label: "Color" },
  { id: "sticker", label: "Sticker" },
];

type Photo = CanvasImageSource & { width: number; height: number };

async function loadPhoto(file: File): Promise<Photo> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  }
}

export default function ShareSheet({
  run,
  onClose,
}: {
  run: DatedRun;
  onClose: () => void;
}) {
  const { notify } = useApp();
  const close = useDialogBack(onClose);
  const input = useRef<HTMLInputElement>(null);
  const [template, setTemplate] = useState<ShareTemplate>("color");
  const [photo, setPhoto] = useState<Photo>();
  const [preview, setPreview] = useState<{ url: string; blob: Blob }>();
  const [busy, setBusy] = useState(false);
  const shell = document.querySelector(".app-shell") ?? document.body;

  useEffect(() => {
    let alive = true;
    let url = "";
    const css = getComputedStyle(shell);
    const color = (name: string, fallback: string) =>
      css.getPropertyValue(name).trim() || fallback;
    void (async () => {
      const canvas = await renderShareCard(
        template === "foto" && !photo ? "color" : template,
        {
          label: LABELS[run.kind] ?? "Salida",
          stats: [
            {
              value: run.distanceKm.toFixed(2).replace(".", ","),
              unit: "km",
              label: "Distancia",
            },
            { value: formatClock(run.durationSeconds), label: "Duración" },
            {
              value: formatPace(run.durationSeconds / run.distanceKm),
              unit: "/km",
              label: "Ritmo medio",
            },
          ],
          date: new Date(
            run.startedAt ?? `${run.date}T12:00:00`,
          ).toLocaleDateString("es-AR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          }),
          segments: run.route ? decodeRoute(run.route) : [],
          colors: {
            c1: color("--duo-1", "#2f7bff"),
            c2: color("--duo-2", "#4aa8ff"),
            c3: color("--duo-3", "#8fd3ff"),
          },
          dark: document.documentElement.dataset.theme === "dark",
          photo,
        },
      );
      const blob = await canvasBlob(canvas);
      if (!alive) return;
      url = URL.createObjectURL(blob);
      setPreview({ url, blob });
    })();
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [template, photo, run, shell]);

  const file = () =>
    preview &&
    new File([preview.blob], `nutriduo-salida-${run.date}.png`, {
      type: "image/png",
    });
  function save() {
    if (!preview) return;
    const a = document.createElement("a");
    a.href = preview.url;
    a.download = `nutriduo-salida-${run.date}.png`;
    a.click();
  }
  async function share() {
    const f = file();
    if (!f || busy) return;
    setBusy(true);
    try {
      if (navigator.canShare?.({ files: [f] }))
        await navigator.share({ files: [f], title: "Mi salida" });
      else {
        save();
        notify("Imagen guardada");
      }
    } catch {
      // Share sheet closed.
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div
      className="run-screen run-share"
      role="dialog"
      aria-modal="true"
      aria-label="Compartir salida"
    >
      <div className="run-top">
        <span className="run-top-spacer" />
        <strong>Compartir</strong>
        <button
          type="button"
          className="run-round small"
          aria-label="Cerrar"
          onClick={close}
        >
          <X size={20} />
        </button>
      </div>
      <div className={`run-share-preview ${template}`}>
        {preview ? (
          <img
            src={preview.url}
            alt="Vista previa de la imagen para compartir"
          />
        ) : (
          <span className="run-muted">Armando la imagen…</span>
        )}
      </div>
      <div className="run-segmented" role="group" aria-label="Estilo">
        {TEMPLATES.map((t) => (
          <button
            type="button"
            key={t.id}
            aria-pressed={template === t.id}
            onClick={() => {
              setTemplate(t.id);
              if (t.id === "foto" && !photo) input.current?.click();
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {template === "foto" && (
        <button
          type="button"
          className="run-voice on"
          onClick={() => input.current?.click()}
        >
          <ImagePlus size={16} />
          {photo ? "Cambiar foto" : "Sacar o elegir foto"}
        </button>
      )}
      {template === "sticker" && (
        <p className="run-muted small">
          Fondo transparente: pegalo encima de tu foto en la historia.
        </p>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const picked = e.target.files?.[0];
          e.target.value = "";
          if (picked)
            void loadPhoto(picked)
              .then((p) => {
                setPhoto(p);
                setTemplate("foto");
              })
              .catch(() => notify("No se pudo abrir la foto"));
        }}
      />
      <div className="run-share-actions">
        <button
          type="button"
          className="run-primary"
          disabled={!preview || busy}
          onClick={() => void share()}
        >
          <Share2 size={18} /> Compartir
        </button>
        <button
          type="button"
          className="run-text"
          disabled={!preview}
          onClick={save}
        >
          <Download size={16} /> Guardar imagen
        </button>
      </div>
    </div>,
    shell,
  );
}
