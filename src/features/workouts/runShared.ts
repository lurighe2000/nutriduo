import type { Records } from "../../schemas";
import type { RunKind, RunSnapshot } from "../../services/runTracker";

export type Run = NonNullable<Records["activity"]["runs"]>[number];
export type DatedRun = Run & { date: string };

const SNAPSHOT_TTL = 6 * 60 * 60 * 1000;
const snapshotKey = (profileId: string) => `nutriduo-run-${profileId}`;

export function readSnapshot(profileId: string): RunSnapshot | undefined {
  try {
    const value = JSON.parse(
      localStorage.getItem(snapshotKey(profileId)) ?? "null",
    ) as RunSnapshot | null;
    if (value && Date.now() - value.savedAt < SNAPSHOT_TTL) return value;
  } catch {
    // Storage unavailable or corrupt: nothing to resume.
  }
  return undefined;
}
export function clearSnapshot(profileId: string) {
  try {
    localStorage.removeItem(snapshotKey(profileId));
  } catch {
    // Ignore.
  }
}
export function writeSnapshot(profileId: string, snapshot: RunSnapshot) {
  try {
    localStorage.setItem(snapshotKey(profileId), JSON.stringify(snapshot));
  } catch {
    // Ignore: the run still works, it just cannot be resumed after a reload.
  }
}

export const kindVerb: Record<RunKind, string> = {
  Carrera: "correr",
  "Caminata y trote": "trotar",
  Caminata: "caminar",
};

export function latestWeight(weights: Records["weights"][]) {
  return [...weights].sort((a, b) => b.date.localeCompare(a.date))[0]?.kg;
}
