import { useState } from "react";
import { Button, Field } from "../../components/ui";
import { useApp } from "../../app/context";
import {
  connectAI,
  currentAIConnection,
  savedAIEndpoint,
} from "../../services/integratedAI";
export default function AIConnectionForm({
  onConnected,
}: {
  onConnected?: () => void;
}) {
  const { profile, notify } = useApp();
  const [endpoint, setEndpoint] = useState(() => savedAIEndpoint(profile.id));
  const [code, setCode] = useState("");
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [connected, setConnected] = useState(() =>
    Boolean(currentAIConnection(profile.id)),
  );
  return (
    <div className="ai-connection">
      <p className="muted small">
        Conexión personal · Groq Free. Podés recordar la conexión en este
        dispositivo. El código no se incluye en backups.
      </p>
      {connected && (
        <p role="status">Análisis conectado para {profile.name}.</p>
      )}
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
        Si lo recordás, el navegador guarda el código de acceso al análisis para
        este perfil. La clave de Groq permanece únicamente en Cloudflare.
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
              notify("Análisis conectado");
              onConnected?.();
            })
            .catch((e) =>
              setError(e instanceof Error ? e.message : "No se pudo conectar."),
            )
            .finally(() => setBusy(false));
        }}
      >
        {busy ? "Conectando…" : "Conectar análisis"}
      </Button>
    </div>
  );
}
