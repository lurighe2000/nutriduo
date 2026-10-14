import { useSyncExternalStore } from "react";
import { Cloud, CloudOff, LoaderCircle } from "lucide-react";
import type { ProfileId } from "../schemas";
import {
  cloudCredentials,
  cloudStatus,
  subscribeCloud,
} from "../services/cloudBackup";

export function useCloudStatus(id: ProfileId) {
  return useSyncExternalStore(subscribeCloud, () => cloudStatus(id));
}
export function CloudBackupPrompt({
  id,
  onClick,
}: {
  id: ProfileId;
  onClick: () => void;
}) {
  useCloudStatus(id);
  if (cloudCredentials(id)) return null;
  return (
    <section className="cloud-backup-prompt">
      <Cloud size={22} aria-hidden="true" />
      <div>
        <strong>Conservá tu historial al reinstalar</strong>
        <p>Activá tu cuenta y el respaldo automático gratuito.</p>
      </div>
      <button type="button" className="text-button" onClick={onClick}>
        Activar respaldo
      </button>
    </section>
  );
}
export default function CloudBackupStatus({
  id,
  onClick,
}: {
  id: ProfileId;
  onClick: () => void;
}) {
  const status = useCloudStatus(id);
  const Icon =
    status.state === "saving"
      ? LoaderCircle
      : ["offline", "error", "conflict", "disconnected"].includes(status.state)
        ? CloudOff
        : Cloud;
  return (
    <button
      className={`cloud-backup-status cloud-${status.state}`}
      type="button"
      onClick={onClick}
      aria-label={`Cuenta y respaldo: ${status.message}`}
    >
      <Icon size={15} aria-hidden="true" />
      <span>{status.message}</span>
    </button>
  );
}
