import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import MealPhotos from "./MealPhotos";
import { Button } from "../../components/ui";
import { useApp } from "../../app/context";
import { aiSchema } from "../../schemas";
import { analyzeMeal, currentAIConnection } from "../../services/integratedAI";
import { type AnalysisResponse } from "../../services/aiContract";
import AIConnectionForm from "./AIConnectionForm";
export default function AIAnalyzer({
  photos,
  photosBusy,
  description,
  setDescription,
  onPhoto,
  onRemovePhoto,
  onReview,
}: {
  photos: string[];
  photosBusy: boolean;
  description: string;
  setDescription: (v: string) => void;
  onPhoto: (files: File[]) => Promise<void>;
  onRemovePhoto: (index: number) => void;
  onReview: (analysis: z.infer<typeof aiSchema>) => void;
}) {
  const { profile } = useApp();
  const [connected, setConnected] = useState(() =>
    Boolean(currentAIConnection(profile.id)),
  );
  const [configuring, setConfiguring] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  const changed = () => {
    request.current?.abort();
    setBusy(false);
    setResult(null);
    setError("");
  };
  return (
    <section className="ai-analyzer">
      <h3>Tu plato, con contexto</h3>
      <p className="muted">
        Fotos + descripción para estimar los componentes. Después revisás los
        datos y decidís qué guardar.
      </p>
      {!connected && (
        <div className="notice">
          <strong>Análisis pendiente de conexión</strong>
          <p>
            El servicio gratuito necesita configurarse una vez. Mientras tanto
            podés registrar componentes o una etiqueta.
          </p>
          <Button secondary onClick={() => setConfiguring(!configuring)}>
            Configurar conexión
          </Button>
        </div>
      )}
      {configuring && (
        <AIConnectionForm
          onConnected={() => {
            setConnected(true);
            setConfiguring(false);
          }}
        />
      )}
      {connected && (
        <p className="muted small">
          Groq conectado ·{" "}
          <button
            type="button"
            className="text-button"
            onClick={() => setConfiguring(!configuring)}
          >
            Cambiar conexión
          </button>
        </p>
      )}
      <MealPhotos
        photos={photos}
        loading={photosBusy}
        disabled={busy}
        analysis
        onAdd={async (files) => {
          changed();
          await onPhoto(files);
        }}
        onRemove={(index) => {
          changed();
          onRemovePhoto(index);
        }}
      />
      <label className="field">
        <span>Descripción, cantidades, cocción y marcas</span>
        <textarea
          rows={4}
          maxLength={3000}
          disabled={busy}
          value={description}
          placeholder="Qué comiste y cuánto, si estaba crudo o cocido, aceite/salsas y marcas. Ej.: arroz cocido, un plato chico; pollo al horno; una cucharadita de aceite."
          onChange={(e) => {
            changed();
            setDescription(e.target.value);
          }}
        />
      </label>
      <p className="muted small">
        Al analizar se envían todas las fotos adjuntas y la descripción a Groq a
        través de tu servicio. No se envían el PIN, peso, objetivos ni otros
        registros. La comida se guarda sólo al confirmar.
      </p>
      <div className="actions">
        <Button
          disabled={
            !connected ||
            !photos.length ||
            description.trim().length < 5 ||
            busy ||
            photosBusy
          }
          onClick={() => {
            const controller = new AbortController();
            request.current = controller;
            setBusy(true);
            setError("");
            setResult(null);
            void analyzeMeal(profile.id, photos, description, controller.signal)
              .then((value) => {
                if (!controller.signal.aborted) setResult(value);
              })
              .catch((e) => {
                if (!controller.signal.aborted)
                  setError(
                    e instanceof Error
                      ? e.message
                      : "No se pudo analizar la comida.",
                  );
              })
              .finally(() => {
                if (!controller.signal.aborted) setBusy(false);
              });
          }}
        >
          {busy ? "Analizando comida…" : "Analizar fotos y descripción"}
        </Button>
        {busy && (
          <Button secondary onClick={changed}>
            Cancelar análisis
          </Button>
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {result?.status === "needs_details" && (
        <div className="notice" role="status">
          <strong>Necesitamos un poco más de información</strong>
          {result.questions.map((q) => (
            <p key={q}>{q}</p>
          ))}
          <p>Añadí las respuestas a la descripción y volvé a analizar.</p>
        </div>
      )}
      {result?.status === "ready" && (
        <div className="card ai-result">
          <h3>{result.analysis.meal_name}</h3>
          <p className="muted small">
            Estimación IA · confianza declarada{" "}
            {Math.round(result.analysis.confidence * 100)}%.
          </p>
          {result.analysis.foods.map((f, i) => (
            <p key={i}>
              {f.name} · ≈ {f.estimated_grams} g · {f.calories} kcal
            </p>
          ))}
          {result.analysis.questions.map((q) => (
            <p key={q}>{q}</p>
          ))}
          <Button onClick={() => onReview(result.analysis)}>
            Revisar componentes
          </Button>
          <p className="muted small">
            El resultado reemplaza los componentes de este formulario. Todavía
            no registra la comida.
          </p>
        </div>
      )}
    </section>
  );
}
