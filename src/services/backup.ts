import { db, repository, table } from "../db";
import {
  backupSchema,
  profileSchema,
  tables,
  type ProfileId,
  type Backup,
  type TableName,
  type Profile,
} from "../schemas";
export async function createBackup(id: ProfileId): Promise<Backup> {
  return db.transaction("r", db.tables, async () => {
    const profile = await db.profiles.get(id);
    if (!profile) throw new Error("Perfil no encontrado");
    const {
      pinHash: _hash,
      pinSalt: _salt,
      failedAttempts: _attempts,
      lockedUntil: _locked,
      ...safe
    } = profile;
    const data = Object.fromEntries(
      await Promise.all(
        (Object.keys(tables) as TableName[]).map(async (k) => [
          k,
          await repository(id).list(k),
        ]),
      ),
    );
    return backupSchema.parse({
      app: "NutriDuo",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      profile: safe,
      data,
    });
  });
}
export function parseBackup(text: string, id: ProfileId) {
  if (text.length > 100000000)
    throw new Error("Backup demasiado grande (máximo 100 MB).");
  const backup = backupSchema.parse(JSON.parse(text));
  if (backup.profile.id !== id)
    throw new Error(
      "Este backup pertenece al otro perfil. Abrí ese perfil para restaurarlo.",
    );
  if (!backup.profile.targets || !backup.profile.onboarded)
    throw new Error("El backup no tiene un perfil configurado.");
  if (
    !backup.profile.birthDate ||
    backup.profile.height < 100 ||
    backup.profile.initialWeight < 25
  )
    throw new Error("El backup tiene datos de perfil incompletos.");
  return backup;
}
export async function restoreBackup(input: Backup, id: ProfileId) {
  const backup = parseBackup(JSON.stringify(input), id);
  await db.transaction("rw", db.tables, async () => {
    const current = await db.profiles.get(id);
    if (!current) throw new Error("Perfil no encontrado");
    for (const k of Object.keys(tables) as TableName[]) {
      for (const row of backup.data[k]) {
        const existing = await table(k).get(row.id);
        if (existing && existing.profileId !== id)
          throw new Error(
            "El backup contiene IDs de otro perfil. No se restauró ningún dato.",
          );
      }
    }
    for (const k of Object.keys(tables) as TableName[]) {
      await table(k).where("profileId").equals(id).delete();
      for (const row of backup.data[k]) await table(k).put(row);
    }
    const p: Profile = profileSchema.parse({
      ...backup.profile,
      pinHash: current.pinHash,
      pinSalt: current.pinSalt,
      failedAttempts: 0,
      lockedUntil: 0,
    });
    await db.profiles.put(p);
  });
}
export function download(content: BlobPart, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
