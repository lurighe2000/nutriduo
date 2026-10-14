import { useState } from "react";
import { Cloud, KeyRound } from "lucide-react";
import { Button, Field } from "../../components/ui";
import { useCloudStatus } from "../../components/CloudBackupStatus";
import type { ProfileId } from "../../schemas";
import { currentAIConnection } from "../../services/integratedAI";
import {
  applyCloudPreview,
  cloudCredentials,
  exportCloudRecovery,
  getCloudPreview,
  loginCloud,
  parseCloudRecovery,
  registerCloud,
  syncCloud,
  type CloudPreview,
} from "../../services/cloudBackup";

export default function CloudAccount({
  profileId,
  onRestored,
}: {
  profileId?: ProfileId;
  onRestored?: (id: ProfileId) => void;
}) {
  const [id, setId] = useState<ProfileId>(profileId ?? "luca");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [invitation, setInvitation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<CloudPreview>();
  const status = useCloudStatus(id);
  const credentials = cloudCredentials(id);
  const privateCode = currentAIConnection(id)?.accessCode;
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos completar la operación.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (preview) {
    const backup = preview.bundle.backup;
    return (
      <div className="cloud-account">
        <h3>Copia encontrada de {backup.profile.name}</h3>
        <p>
          Guardada el {new Date(preview.meta.savedAt).toLocaleString("es-AR")}.
        </p>
        <p>
          {backup.data.meals.length} comidas, {backup.data.weights.length}{" "}
          pesajes, {backup.data.sessions.length} entrenamientos. Incluye el
          historial completo, las fotos, tus objetivos y preferencias.
        </p>
        <div className="notice">
          Recuperar reemplaza los datos de este usuario en este dispositivo. Si
          ya tiene un perfil configurado, primero se descarga una copia local de
          seguridad. El otro usuario se conserva.
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="actions">
          <Button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await applyCloudPreview(preview);
                setPreview(undefined);
                setPassword("");
                setMessage(
                  "Tus registros fueron recuperados. El respaldo automático quedó activado.",
                );
                onRestored?.(preview.credentials.profileId);
              })
            }
          >
            {busy ? "Recuperando…" : "Recuperar mis registros"}
          </Button>
          <Button
            secondary
            disabled={busy}
            onClick={() => setPreview(undefined)}
          >
            Cancelar
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="cloud-account">
      <p>
        Tu cuenta conserva una copia cifrada de tus comidas, fotos, peso,
        entrenamiento, objetivos y perfil. Al reinstalar, ingresá con el mismo
        usuario y contraseña para recuperar tu historial.
      </p>
      <p className="muted small">
        Para coordinar un menú y una sola lista de compras, Luca y Ari comparten
        sus objetivos nutricionales y alimentos excluidos. El historial de
        comidas, fotos, peso y entrenamientos de cada cuenta se mantiene por
        separado.
      </p>
      {credentials ? (
        <>
          <div className="notice cloud-account-state" role="status">
            <Cloud size={22} />
            <div>
              <strong>Usuario: {id}</strong>
              <p>{status.message}</p>
              {status.lastSaved && (
                <small>
                  Última copia:{" "}
                  {new Date(status.lastSaved).toLocaleString("es-AR")}
                </small>
              )}
            </div>
          </div>
          <div className="actions">
            <Button
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await syncCloud(id);
                  setMessage("Respaldo actualizado.");
                })
              }
            >
              {busy ? "Comprobando…" : "Guardar respaldo ahora"}
            </Button>
            <Button
              secondary
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  setPreview(await getCloudPreview(credentials));
                })
              }
            >
              Recuperar copia de la nube
            </Button>
            <Button
              secondary
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  setPreview(await getCloudPreview(credentials, true));
                })
              }
            >
              Ver copia anterior
            </Button>
          </div>
          <hr />
          <Button secondary onClick={() => exportCloudRecovery(id)}>
            <KeyRound size={17} /> Descargar archivo de recuperación
          </Button>
          <p className="muted small">
            Guardalo en un lugar privado. Permite recuperar tu cuenta si olvidás
            la contraseña. Quien tenga ese archivo puede acceder a tu copia.
          </p>
        </>
      ) : (
        <>
          <div className="actions">
            <Button
              secondary
              disabled={busy}
              onClick={() => {
                setMode("login");
                setError("");
              }}
            >
              Ya tengo cuenta
            </Button>
            {profileId && (
              <Button
                secondary
                disabled={busy}
                onClick={() => {
                  setMode("register");
                  setError("");
                }}
              >
                Crear mi cuenta
              </Button>
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(async () => {
                if (mode === "register") {
                  if (password !== repeat)
                    throw new Error("Las contraseñas deben coincidir.");
                  await registerCloud(id, password, privateCode ?? invitation);
                  setPassword("");
                  setRepeat("");
                  setInvitation("");
                  setMessage(
                    "Cuenta creada y primer respaldo guardado. Ya podés recuperar tus registros al reinstalar.",
                  );
                  exportCloudRecovery(id);
                } else setPreview(await loginCloud(id, password));
              });
            }}
          >
            <h3>
              {mode === "register"
                ? "Crear cuenta y activar respaldo"
                : "Ingresar y recuperar mi cuenta"}
            </h3>
            <label className="field">
              <span>Usuario de NutriDuo</span>
              <select
                value={id}
                disabled={Boolean(profileId) || busy}
                onChange={(e) => {
                  setId(e.target.value as ProfileId);
                  setError("");
                }}
                autoComplete="username"
              >
                <option value="luca">luca</option>
                <option value="ari">ari</option>
              </select>
            </label>
            <Field
              label="Contraseña de la cuenta"
              type="password"
              required
              minLength={mode === "register" ? 12 : 1}
              maxLength={200}
              autoComplete={
                mode === "register" ? "new-password" : "current-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {mode === "register" && (
              <>
                <Field
                  label="Repetir contraseña de la cuenta"
                  type="password"
                  required
                  minLength={12}
                  maxLength={200}
                  autoComplete="new-password"
                  value={repeat}
                  onChange={(e) => setRepeat(e.target.value)}
                />
                {!privateCode && (
                  <Field
                    label="Código privado de NutriDuo"
                    type="password"
                    required
                    autoComplete="off"
                    value={invitation}
                    onChange={(e) => setInvitation(e.target.value)}
                  />
                )}
                <p className="muted small">
                  Mínimo 12 caracteres. Es distinta del PIN de cuatro dígitos.{" "}
                  {privateCode
                    ? "Usaremos tu conexión privada ya configurada para habilitar esta cuenta."
                    : "Para crearla, usá el código de conexión del análisis. Solo se pide esta primera vez."}
                </p>
              </>
            )}
            <Button type="submit" disabled={busy}>
              {busy
                ? "Preparando tu cuenta…"
                : mode === "register"
                  ? "Crear cuenta y respaldar"
                  : "Buscar mi respaldo"}
            </Button>
          </form>
          <hr />
          <label className="field">
            <span>O recuperar con mi archivo de acceso</span>
            <input
              type="file"
              accept=".json,application/json"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file)
                  void run(async () => {
                    if (file.size > 10000)
                      throw new Error(
                        "Elegí el archivo nutriduo-recuperacion de tu cuenta.",
                      );
                    const recovered = parseCloudRecovery(await file.text());
                    if (profileId && recovered.profileId !== profileId)
                      throw new Error(
                        "El archivo pertenece al otro usuario. Abrí su perfil o recuperalo desde la pantalla inicial.",
                      );
                    setId(recovered.profileId);
                    setPreview(await getCloudPreview(recovered));
                  });
              }}
            />
          </label>
          <p className="muted small">
            Si olvidaste la contraseña, usá el archivo de recuperación o
            descargalo desde otro dispositivo que siga conectado.
          </p>
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <p className="muted small">
        Sin conexión, todo sigue guardándose en este celular. Antes de
        desinstalar, comprobá que diga «Respaldo en la nube al día». Las claves
        de descifrado quedan en tus dispositivos y en tu archivo de
        recuperación; no se envían al servidor.
      </p>
    </div>
  );
}
