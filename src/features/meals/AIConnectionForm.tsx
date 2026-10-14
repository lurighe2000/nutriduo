import { useEffect, useState } from "react";
import { Button, Field } from "../../components/ui";
import { useApp } from "../../app/context";
import {
  connectAI,
  currentAIConnection,
  savedAIEndpoint,
  verifyAIConnection,
  disconnectAI,
} from "../../services/integratedAI";
export default function AIConnectionForm({
  onConnected,
}: {
  onConnected?: () => void;
}) {
  const { profile, notify } = useApp();
  const [endpoint, setEndpoint] = useState(() => savedAIEndpoint(profile.id));
  const [code, setCode] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [connected, setConnected] = useState(() =>
    Boolean(currentAIConnection(profile.id)),
  );
  const [checking, setChecking] = useState(connected);
  const [editing, setEditing] = useState(!connected);
  useEffect(() => {
    if (!currentAIConnection(profile.id)) return;
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);
    void verifyAIConnection(profile.id, controller.signal)
      .then(() => {
        if (!active) return;
        setConnected(true);
        setError("");
      })
      .catch((e) => {
        if (active)
          setError(
            controller.signal.aborted
              ? "La comprobación tardó demasiado. Conservamos tu conexión para intentar más tarde."
              : e instanceof Error
                ? e.message
                : "No se pudo verificar la conexión.",
          );
      })
      .finally(() => {
        window.clearTimeout(timeout);
        if (active) setChecking(false);
      });
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [profile.id]);
  return (
    <div className="ai-connection">
      <p className="muted small">
        Conexión personal · Groq Free. La conexión guardada se comparte entre
        Luca y Ari en este dispositivo. El código no se incluye en backups.
      </p>
      {connected && (
        <div className="notice">
          <strong role="status">
            {checking
              ? "Comprobando conexión…"
              : error
                ? "Conexión guardada · verificación pendiente"
                : "Ya estás conectado"}
          </strong>
          <p>
            {error
              ? "Conservamos el acceso guardado. Podés volver a comprobarlo cuando el servicio tenga conexión."
              : "Podés analizar tus comidas sin volver a ingresar el código."}
          </p>
          <div className="actions">
            <Button
              secondary
              disabled={checking}
              onClick={() => {
                setChecking(true);
                setError("");
                void verifyAIConnection(profile.id)
                  .catch((e) =>
                    setError(
                      e instanceof Error ? e.message : "No se pudo comprobar.",
                    ),
                  )
                  .finally(() => setChecking(false));
              }}
            >
              Comprobar conexión
            </Button>
            <Button
              secondary
              disabled={checking}
              onClick={() => setEditing(!editing)}
            >
              Cambiar conexión
            </Button>
            <Button
              secondary
              disabled={checking}
              onClick={() => {
                disconnectAI();
                setChecking(false);
                setConnected(false);
                setEditing(true);
                setCode("");
                setError("");
              }}
            >
              Desconectar
            </Button>
          </div>
        </div>
      )}
      {editing && (
        <>
          <Field
            label="Dirección del servicio NutriDuo"
            type="url"
            placeholder="https://nutriduo-ai.…workers.dev"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
          />
          <Field
            label="Código de conexión NutriDuo"
            type="password"
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <p className="muted small">
            Usá el código del servicio, no tu PIN ni la clave de Groq.
          </p>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            Recordar conexión en este dispositivo
          </label>
          <p className="muted small">
            Si lo recordás, el navegador guarda el código de acceso al análisis
            para este dispositivo. La clave de Groq permanece únicamente en
            Cloudflare.
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <Button
            disabled={busy || !endpoint || !code}
            onClick={() => {
              setError("");
              setBusy(true);
              void connectAI(profile.id, endpoint, code, remember)
                .then(() => {
                  setCode("");
                  setConnected(true);
                  setEditing(false);
                  notify("Análisis conectado");
                  onConnected?.();
                })
                .catch((e) =>
                  setError(
                    e instanceof Error ? e.message : "No se pudo conectar.",
                  ),
                )
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Conectando…" : "Conectar análisis"}
          </Button>
        </>
      )}
      {!editing && error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
