import { useState } from "react";
import {
  Camera,
  UserRound,
  Settings,
  ShieldCheck,
  Bell,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { useApp } from "../../app/context";
import { db } from "../../db";
import { profileIdentitySchema } from "../../schemas";
import { compressPhoto } from "../../services/photos";
import ProfileAvatar from "../../components/ProfileAvatar";
import { Modal, Button, Field } from "../../components/ui";

function ProfileEditor({
  onClose,
  onSettings,
}: {
  onClose: () => void;
  onSettings: () => void;
}) {
  const { profile, run } = useApp();
  const [name, setName] = useState(profile.name);
  const [avatar, setAvatar] = useState(profile.avatar);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true);
    await run(async () => setAvatar((await compressPhoto(file)).thumbnail));
    setBusy(false);
  }
  return (
    <Modal title="Mi perfil" onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const identity = profileIdentitySchema.safeParse({ name, avatar });
          if (!identity.success) {
            setError(identity.error.issues[0].message);
            return;
          }
          setError("");
          setBusy(true);
          void run(async () => {
            if (!(await db.profiles.update(profile.id, identity.data)))
              throw new Error("No se encontró tu perfil.");
          }, "Perfil actualizado")
            .then((saved) => {
              if (saved) onClose();
            })
            .finally(() => setBusy(false));
        }}
      >
        <div className="profile-editor-photo">
          <ProfileAvatar
            profile={{ name, avatar }}
            alt="Foto de perfil"
            className="profile-photo-preview"
          />
          <p className="muted small">
            Tu foto queda en este dispositivo y se incluye en el backup de tu
            perfil.
          </p>
        </div>
        <div className="photo-inputs">
          <label className="upload-button">
            <Camera size={17} />
            Sacar foto
            <input
              type="file"
              accept="image/*"
              capture="user"
              disabled={busy}
              aria-label="Sacar foto de perfil"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                void upload(file);
              }}
            />
          </label>
          <label className="upload-button">
            Elegir o cambiar foto
            <input
              type="file"
              accept="image/*"
              disabled={busy}
              aria-label="Elegir foto de perfil"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                void upload(file);
              }}
            />
          </label>
          {avatar && (
            <button
              className="text-button"
              type="button"
              disabled={busy}
              onClick={() => setAvatar(undefined)}
            >
              Quitar foto de perfil
            </button>
          )}
        </div>
        <Field
          label="Nombre del perfil"
          value={name}
          maxLength={50}
          required
          disabled={busy}
          onChange={(event) => setName(event.target.value)}
        />
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="actions">
          <Button type="submit" disabled={busy}>
            {busy ? "Preparando…" : "Guardar perfil"}
          </Button>
        </div>
      </form>
      <hr />
      <Button secondary onClick={onSettings}>
        <Settings size={17} />
        Editar mis datos y objetivos
      </Button>
    </Modal>
  );
}

export default function AccountMenu({
  onClose,
  onSettings,
}: {
  onClose: () => void;
  onSettings: (panel?: string) => void;
}) {
  const { profile, lock } = useApp();
  const [editing, setEditing] = useState(false);
  return (
    <>
      <Modal title="Tu cuenta" onClose={onClose} className="account-menu">
        <div className="account-summary">
          <ProfileAvatar profile={profile} className="account-avatar" />
          <div>
            <strong>{profile.name}</strong>
            <p className="muted small">Tu espacio en NutriDuo</p>
          </div>
        </div>
        <div className="account-actions">
          <button
            className="list-button"
            type="button"
            onClick={() => onSettings("cuenta")}
          >
            <span>
              <ShieldCheck size={19} />
              Cuenta y respaldo<small>Conservar y recuperar mi historial</small>
            </span>
            <ChevronRight size={18} />
          </button>
          <button
            className="list-button"
            type="button"
            onClick={() => setEditing(true)}
          >
            <span>
              <UserRound size={19} />
              Mi perfil<small>Nombre y foto</small>
            </span>
            <ChevronRight size={18} />
          </button>
          <button
            className="list-button"
            type="button"
            onClick={() => onSettings()}
          >
            <span>
              <Settings size={19} />
              Configuración<small>Objetivos, preferencias y tus datos</small>
            </span>
            <ChevronRight size={18} />
          </button>
          <button
            className="list-button"
            type="button"
            onClick={() => onSettings("recordatorios")}
          >
            <span>
              <Bell size={19} />
              Recordatorios<small>Avisos en este celular</small>
            </span>
            <ChevronRight size={18} />
          </button>
          <button className="list-button" type="button" onClick={lock}>
            <span>
              <LogOut size={19} />
              Cambiar perfil<small>Bloquear y elegir otro usuario</small>
            </span>
            <ChevronRight size={18} />
          </button>
        </div>
      </Modal>
      {editing && (
        <ProfileEditor
          onClose={() => setEditing(false)}
          onSettings={() => onSettings("perfil")}
        />
      )}
    </>
  );
}
