import { z } from "zod";
import { db } from "../db";
import { backupSchema, type ProfileId } from "../schemas";
import { createBackup, restoreBackup, download } from "./backup";
import {
  currentAIConnection,
  forgetAIConnections,
  serviceEndpoint,
} from "./integratedAI";
import {
  cloudHeadSchema,
  cloudMetaSchema,
  hexKeySchema,
  saltSchema,
  CLOUD_CHUNK_BYTES,
} from "./cloudContract";
import type { CloudMeta } from "./cloudContract";
import {
  randomSalt,
  deriveCloudKeys,
  digestBytes,
  encryptCloud,
  decryptCloud,
  toBase64,
  fromBase64,
} from "./cloudCrypto";
import { householdSchema, type Household } from "./householdContract";
import { monday } from "../nutrition/weeklyMenu";

const credentialsSchema = z.object({
  profileId: z.enum(["luca", "ari"]),
  endpoint: z.string().transform(serviceEndpoint),
  salt: saltSchema,
  auth: hexKeySchema,
  encryptionKey: hexKeySchema,
  revision: z.number().int().nonnegative().default(0),
  contentDigest: z.string().default(""),
  lastSaved: z.string().default(""),
  dirty: z.boolean().default(true),
});
export type CloudCredentials = z.infer<typeof credentialsSchema>;
const bundleSchema = z.object({
  version: z.literal(1),
  backup: backupSchema,
  pin: z.object({ hash: hexKeySchema, salt: saltSchema }).optional(),
  service: z
    .object({
      endpoint: z.string().transform(serviceEndpoint),
      accessCode: z.string().min(32).max(256),
      nutritionDatabase: z.boolean(),
    })
    .optional(),
});
export type CloudPreview = {
  credentials: CloudCredentials;
  meta: CloudMeta;
  headRevision: number;
  bundle: z.infer<typeof bundleSchema>;
};
export type CloudStatus = {
  state:
    | "disconnected"
    | "pending"
    | "saving"
    | "saved"
    | "offline"
    | "error"
    | "conflict";
  message: string;
  lastSaved?: string;
};
const defaults: Record<ProfileId, CloudStatus> = {
  luca: { state: "disconnected", message: "Sin respaldo en la nube" },
  ari: { state: "disconnected", message: "Sin respaldo en la nube" },
};
const statuses = new Map<ProfileId, CloudStatus>();
const listeners = new Set<() => void>();
const householdListeners = new Set<() => void>();
let householdCache: Household | undefined;
const queues = new Map<ProfileId, Promise<unknown>>();
const mutations = new Map<ProfileId, number>();
const timers = new Map<ProfileId, ReturnType<typeof setTimeout>>();
let restoring = false;
const storageKey = (id: ProfileId) => `nutriduo-cloud:${id}`;
export function cloudCredentials(id: ProfileId) {
  try {
    const value = credentialsSchema.parse(
      JSON.parse(localStorage.getItem(storageKey(id)) ?? "null"),
    );
    return value.profileId === id ? value : undefined;
  } catch {
    return undefined;
  }
}
function saveCredentials(value: CloudCredentials) {
  localStorage.setItem(storageKey(value.profileId), JSON.stringify(value));
}
export function currentHousehold() {
  if (!householdCache) {
    try {
      householdCache = householdSchema.parse(
        JSON.parse(localStorage.getItem("nutriduo-household") ?? "null"),
      );
    } catch {
      /* no local copy yet */
    }
  }
  return householdCache;
}
export const subscribeHousehold = (callback: () => void) => {
  householdListeners.add(callback);
  return () => {
    householdListeners.delete(callback);
  };
};
async function acceptHousehold(id: ProfileId, data: unknown) {
  const next = householdSchema.parse(data);
  if (JSON.stringify(currentHousehold()) !== JSON.stringify(next)) {
    householdCache = next;
    localStorage.setItem("nutriduo-household", JSON.stringify(next));
    for (const callback of householdListeners) callback();
  }
  const menu = next.menus?.[id];
  const profile = await db.profiles.get(id);
  if (
    menu &&
    profile?.onboarded &&
    JSON.stringify(profile.weeklyMenu) !== JSON.stringify(menu)
  )
    await db.profiles.update(id, { weeklyMenu: menu });
  return next;
}
export async function loadHousehold(id: ProfileId) {
  const credentials = cloudCredentials(id);
  if (!credentials) return currentHousehold();
  return acceptHousehold(
    id,
    await request(credentials, "household", { action: "read" }),
  );
}
async function publishHousehold(id: ProfileId) {
  const credentials = cloudCredentials(id);
  const profile = await db.profiles.get(id);
  if (!credentials || !profile?.onboarded || !profile.targets) return;
  await acceptHousehold(
    id,
    await request(credentials, "household", {
      action: "publish",
      member: {
        name: profile.name,
        targets: profile.targets,
        excluded: profile.excluded,
        sourceRevision: credentials.revision,
      },
    }),
  );
}
export async function prepareHouseholdMenu(id: ProfileId, date: string) {
  const credentials = cloudCredentials(id);
  if (!credentials)
    throw new Error("Activá Cuenta y respaldo para compartir el menú.");
  await syncCloud(id);
  const household = await loadHousehold(id);
  if (!household) throw new Error("No pudimos leer el menú compartido.");
  return acceptHousehold(
    id,
    await request(credentials, "household", {
      action: "prepare",
      week: monday(date),
      revision: household.revision,
    }),
  );
}
export async function replaceHouseholdDish(
  id: ProfileId,
  day: number,
  slot: string,
  recipe: string,
) {
  const credentials = cloudCredentials(id);
  const household = currentHousehold();
  if (!credentials || !household)
    throw new Error("Conectá tu cuenta y actualizá el menú compartido.");
  return acceptHousehold(
    id,
    await request(credentials, "household", {
      action: "replace",
      day,
      slot,
      recipe,
      revision: household.revision,
    }),
  );
}
export const cloudStatus = (id: ProfileId) => statuses.get(id) ?? defaults[id];
export const subscribeCloud = (callback: () => void) => {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
};
function status(id: ProfileId, value: CloudStatus) {
  statuses.set(id, value);
  for (const listener of listeners) listener();
}
function exclusive<T>(id: ProfileId, work: () => Promise<T>) {
  const next = (queues.get(id) ?? Promise.resolve()).catch(() => {}).then(work);
  queues.set(id, next);
  return next;
}
function endpoint(id: ProfileId) {
  return (
    currentAIConnection(id)?.endpoint ||
    import.meta.env.VITE_AI_ENDPOINT ||
    "https://nutriduo-ai.lucarighetti2000.workers.dev"
  );
}
class CloudError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
async function request(
  credentials: Pick<CloudCredentials, "profileId" | "endpoint"> & {
    auth?: string;
  },
  route: string,
  body: object = {},
) {
  if (!navigator.onLine)
    throw new CloudError(
      "Sin internet. Los cambios quedan en este celular hasta recuperar la conexión.",
      0,
    );
  const response = await fetch(
    `${serviceEndpoint(credentials.endpoint)}/cloud/${route}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(credentials.auth
          ? { authorization: `Bearer ${credentials.auth}` }
          : {}),
      },
      body: JSON.stringify({ ...body, profileId: credentials.profileId }),
      credentials: "omit",
      cache: "no-store",
      referrerPolicy: "no-referrer",
      signal: AbortSignal.timeout(120000),
    },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new CloudError(
      typeof data.error === "string"
        ? data.error
        : "No pudimos contactar al respaldo. Tus datos locales siguen guardados.",
      response.status,
    );
  return data;
}
/** Authenticated call for data shared by both profiles; undefined without an account. */
export async function cloudRequest(
  id: ProfileId,
  route: string,
  body: object = {},
) {
  const credentials = cloudCredentials(id);
  return credentials ? request(credentials, route, body) : undefined;
}
export async function registerCloud(
  id: ProfileId,
  password: string,
  invitation: string,
) {
  if (password.length < 12 || password.length > 200)
    throw new Error(
      "Usá una contraseña de entre 12 y 200 caracteres, distinta del PIN.",
    );
  const profile = await db.profiles.get(id);
  if (!profile?.onboarded)
    throw new Error("Completá el perfil antes de activar su respaldo.");
  const salt = randomSalt();
  const keys = await deriveCloudKeys(password, salt);
  const credentials = credentialsSchema.parse({
    profileId: id,
    endpoint: endpoint(id),
    salt,
    ...keys,
  });
  await request({ ...credentials, auth: invitation.trim() }, "register", {
    salt,
    auth: keys.auth,
  });
  saveCredentials(credentials);
  await syncCloud(id);
}
export async function loginCloud(id: ProfileId, password: string) {
  const connection = { profileId: id, endpoint: endpoint(id) };
  const challenge = z
    .object({ exists: z.boolean(), salt: saltSchema.optional() })
    .parse(await request(connection, "challenge"));
  if (!challenge.exists || !challenge.salt)
    throw new Error(
      "Esta cuenta todavía no existe. Creala desde el perfil que tenga tus registros.",
    );
  const keys = await deriveCloudKeys(password, challenge.salt);
  const credentials = credentialsSchema.parse({
    ...connection,
    salt: challenge.salt,
    ...keys,
  });
  const head = cloudHeadSchema.parse(await request(credentials, "head"));
  // Registration may finish before the first upload when a connection drops.
  if (!head.latest && (await db.profiles.get(id))?.onboarded) {
    saveCredentials(credentials);
    await syncCloud(id);
  }
  return getCloudPreview(credentials);
}
export async function getCloudPreview(
  credentials: CloudCredentials,
  previous = false,
): Promise<CloudPreview> {
  const head = cloudHeadSchema.parse(await request(credentials, "head"));
  const meta = previous ? head.previous : head.latest;
  if (!meta)
    throw new Error("Todavía no hay una copia guardada para recuperar.");
  const encrypted = new Uint8Array(meta.bytes);
  for (let offset = 0; offset < meta.parts; offset += 16) {
    const { chunks } = z
      .object({ chunks: z.array(z.string().max(87384)).min(1).max(16) })
      .parse(await request(credentials, "read", { id: meta.id, offset }));
    if (chunks.length !== Math.min(16, meta.parts - offset))
      throw new Error(
        "La copia llegó incompleta. Tus datos locales se conservan.",
      );
    chunks.forEach((chunk, i) => {
      const bytes = fromBase64(chunk);
      const expected = Math.min(
        CLOUD_CHUNK_BYTES,
        meta.bytes - (offset + i) * CLOUD_CHUNK_BYTES,
      );
      if (bytes.length !== expected)
        throw new Error("Parte de la copia inválida.");
      encrypted.set(bytes, (offset + i) * CLOUD_CHUNK_BYTES);
    });
  }
  if ((await digestBytes(encrypted)) !== meta.digest)
    throw new Error(
      "La copia está incompleta o dañada. No se modificó ningún registro.",
    );
  const bundle = bundleSchema.parse(
    JSON.parse(
      await decryptCloud(
        encrypted,
        credentials.encryptionKey,
        meta.iv,
        credentials.profileId,
      ),
    ),
  );
  if (bundle.backup.profile.id !== credentials.profileId)
    throw new Error("La copia pertenece al otro usuario.");
  return { credentials, meta, headRevision: head.latest!.revision, bundle };
}
export async function applyCloudPreview(preview: CloudPreview) {
  return exclusive(preview.credentials.profileId, async () => {
    const id = preview.credentials.profileId;
    const head = cloudHeadSchema.parse(
      await request(preview.credentials, "head"),
    );
    if (head.latest?.revision !== preview.headRevision)
      throw new Error(
        "La nube cambió mientras revisabas la copia. Volvé a consultarla antes de recuperar.",
      );
    const current = await db.profiles.get(id);
    if (current?.onboarded)
      download(
        JSON.stringify(await createBackup(id)),
        `nutriduo-antes-de-recuperar-${id}-${Date.now()}.json`,
        "application/json",
      );
    restoring = true;
    try {
      await db.transaction("rw", db.tables, async () => {
        await restoreBackup(preview.bundle.backup, id);
        if (preview.bundle.pin)
          await db.profiles.update(id, {
            pinHash: preview.bundle.pin.hash,
            pinSalt: preview.bundle.pin.salt,
            failedAttempts: 0,
            lockedUntil: 0,
          });
      });
      if (
        preview.bundle.service &&
        !preview.bundle.service.accessCode.startsWith("gsk_")
      )
        localStorage.setItem(
          "nutriduo-ai-service",
          JSON.stringify(preview.bundle.service),
        );
      forgetAIConnections();
      const credentials = {
        ...preview.credentials,
        revision: preview.headRevision,
        contentDigest: preview.meta.contentDigest,
        lastSaved: preview.meta.savedAt,
        dirty: preview.meta.revision !== preview.headRevision,
      };
      saveCredentials(credentials);
      status(id, {
        state: credentials.dirty ? "pending" : "saved",
        message: credentials.dirty
          ? "Copia anterior recuperada. Preparando respaldo nuevo…"
          : "Respaldo en la nube al día",
        lastSaved: credentials.lastSaved,
      });
    } finally {
      restoring = false;
    }
    schedule(id);
  });
}
async function bundleFor(id: ProfileId) {
  const backup = await createBackup(id);
  const profile = await db.profiles.get(id);
  if (
    !backup.profile.onboarded ||
    !backup.profile.targets ||
    !profile?.pinHash ||
    !profile.pinSalt
  )
    throw new Error(
      "Completá el perfil y el PIN antes de respaldarlo. La nube no se reemplazó.",
    );
  return bundleSchema.parse({
    version: 1,
    backup,
    pin: { hash: profile.pinHash, salt: profile.pinSalt },
    service:
      localStorage.getItem("nutriduo-ai-service") ||
      localStorage.getItem(`nutriduo-ai-connection:${id}`)
        ? currentAIConnection(id)
        : undefined,
  });
}
export function syncCloud(id: ProfileId): Promise<void> {
  return exclusive(id, async () => {
    const credentials = cloudCredentials(id);
    if (!credentials) return;
    const generation = mutations.get(id) ?? 0;
    try {
      const bundle = await bundleFor(id);
      const canonical = JSON.stringify({
        ...bundle,
        backup: { ...bundle.backup, exportedAt: "" },
      });
      const contentDigest = await digestBytes(
        new TextEncoder().encode(canonical),
      );
      if (!navigator.onLine)
        throw new CloudError(
          "Guardado en este celular. Pendiente de subir cuando vuelva internet.",
          0,
        );
      status(id, {
        state: "saving",
        message: "Guardando respaldo en la nube…",
        lastSaved: credentials.lastSaved,
      });
      const head = cloudHeadSchema.parse(await request(credentials, "head"));
      if (head.latest?.contentDigest === contentDigest) {
        const dirty = (mutations.get(id) ?? 0) !== generation;
        saveCredentials({
          ...credentials,
          revision: head.latest.revision,
          contentDigest,
          lastSaved: head.latest.savedAt,
          dirty,
        });
        status(id, {
          state: dirty ? "pending" : "saved",
          message: dirty
            ? "Subiendo los últimos cambios…"
            : "Respaldo en la nube al día",
          lastSaved: head.latest.savedAt,
        });
        if (dirty) schedule(id);
        await publishHousehold(id).catch(() => {});
        return;
      }
      if ((head.latest?.revision ?? 0) !== credentials.revision)
        throw new CloudError(
          "Hay una copia más reciente en otro dispositivo. Recuperala desde Cuenta y respaldo antes de seguir subiendo cambios.",
          409,
        );
      const { encrypted, iv, digest } = await encryptCloud(
        JSON.stringify(bundle),
        credentials.encryptionKey,
        id,
      );
      const parts = Math.ceil(encrypted.length / CLOUD_CHUNK_BYTES);
      const meta = {
        bytes: encrypted.length,
        parts,
        iv,
        digest,
        contentDigest,
        format: "gzip-aes-gcm-v1",
      };
      const { id: uploadId } = z.object({ id: z.string().uuid() }).parse(
        await request(credentials, "start", {
          baseRevision: credentials.revision,
          meta,
        }),
      );
      for (let offset = 0; offset < parts; offset += 16) {
        const chunks = Array.from(
          { length: Math.min(16, parts - offset) },
          (_, i) =>
            toBase64(
              encrypted.subarray(
                (offset + i) * CLOUD_CHUNK_BYTES,
                (offset + i + 1) * CLOUD_CHUNK_BYTES,
              ),
            ),
        );
        await request(credentials, "upload", { id: uploadId, offset, chunks });
      }
      const committed = z
        .object({ latest: cloudMetaSchema })
        .parse(await request(credentials, "commit", { id: uploadId }));
      // A local write during upload must trigger another pass, not be marked saved.
      const current = await bundleFor(id);
      const currentDigest = await digestBytes(
        new TextEncoder().encode(
          JSON.stringify({
            ...current,
            backup: { ...current.backup, exportedAt: "" },
          }),
        ),
      );
      const dirty =
        currentDigest !== contentDigest ||
        (mutations.get(id) ?? 0) !== generation;
      saveCredentials({
        ...credentials,
        revision: committed.latest.revision,
        contentDigest,
        lastSaved: committed.latest.savedAt,
        dirty,
      });
      status(id, {
        state: dirty ? "pending" : "saved",
        message: dirty
          ? "Subiendo los últimos cambios…"
          : "Respaldo en la nube al día",
        lastSaved: committed.latest.savedAt,
      });
      if (dirty) schedule(id);
      await publishHousehold(id).catch(() => {});
    } catch (error) {
      const code = error instanceof CloudError ? error.status : -1;
      status(id, {
        state: code === 0 ? "offline" : code === 409 ? "conflict" : "error",
        message:
          error instanceof Error
            ? error.message
            : "No pudimos guardar en la nube. Tus registros siguen en este celular.",
        lastSaved: credentials.lastSaved,
      });
      throw error;
    }
  });
}
function schedule(id: ProfileId, delay = 800) {
  if (!cloudCredentials(id) || restoring) return;
  clearTimeout(timers.get(id));
  timers.set(
    id,
    setTimeout(() => {
      timers.delete(id);
      void syncCloud(id).catch(() => {});
    }, delay),
  );
}
export function startCloudBackup() {
  const hooks: (() => void)[] = [];
  for (const table of db.tables) {
    const creating = (
      _key: unknown,
      value: { id?: string; profileId?: string },
      transaction: import("dexie").Transaction,
    ) => {
      const id = (
        table.name === "profiles" ? value.id : value.profileId
      ) as ProfileId;
      transaction.on("complete", () => markDirty(id));
    };
    const updating = (
      _changes: unknown,
      _key: unknown,
      value: { id?: string; profileId?: string },
      transaction: import("dexie").Transaction,
    ) => creating(_key, value, transaction);
    const deleting = (
      _key: unknown,
      value: { id?: string; profileId?: string },
      transaction: import("dexie").Transaction,
    ) => creating(_key, value, transaction);
    table.hook("creating", creating);
    table.hook("updating", updating);
    table.hook("deleting", deleting);
    hooks.push(() => {
      table.hook("creating").unsubscribe(creating);
      table.hook("updating").unsubscribe(updating);
      table.hook("deleting").unsubscribe(deleting);
    });
  }
  function markDirty(id: ProfileId) {
    if (restoring || !["luca", "ari"].includes(id)) return;
    const credentials = cloudCredentials(id);
    if (!credentials) return;
    mutations.set(id, (mutations.get(id) ?? 0) + 1);
    saveCredentials({ ...credentials, dirty: true });
    status(id, {
      state: navigator.onLine ? "pending" : "offline",
      message: navigator.onLine
        ? "Cambios pendientes de respaldo…"
        : "Guardado en este celular. Pendiente de internet.",
      lastSaved: credentials.lastSaved,
    });
    schedule(id);
  }
  const retry = () => {
    for (const id of ["luca", "ari"] as const)
      if (cloudCredentials(id) && !document.hidden) schedule(id);
  };
  const interval = setInterval(retry, 60000);
  window.addEventListener("online", retry);
  document.addEventListener("visibilitychange", retry);
  retry();
  return () => {
    hooks.forEach((off) => off());
    clearInterval(interval);
    window.removeEventListener("online", retry);
    document.removeEventListener("visibilitychange", retry);
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
  };
}
export function exportCloudRecovery(id: ProfileId) {
  const credentials = cloudCredentials(id);
  if (!credentials) throw new Error("Primero conectá tu cuenta.");
  download(
    JSON.stringify(
      { app: "NutriDuo-recovery", version: 1, credentials },
      null,
      2,
    ),
    `nutriduo-recuperacion-${id}.json`,
    "application/json",
  );
}
export function parseCloudRecovery(text: string) {
  if (text.length > 10000) throw new Error("Archivo de recuperación inválido.");
  return z
    .object({
      app: z.literal("NutriDuo-recovery"),
      version: z.literal(1),
      credentials: credentialsSchema,
    })
    .parse(JSON.parse(text)).credentials;
}
