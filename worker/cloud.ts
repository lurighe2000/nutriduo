import { z } from "zod";
import {
  cloudProfileSchema,
  cloudMetaSchema,
  hexKeySchema,
  saltSchema,
  CLOUD_MAX_CHUNKS,
} from "../src/services/cloudContract";
import type { CloudMeta } from "../src/services/cloudContract";
import { householdRoute } from "./household";
import { householdActionSchema } from "../src/services/householdContract";

// Structural types also allow exercising the real vault protocol in Node tests.
export interface VaultStore {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  put(values: Record<string, unknown>): Promise<void>;
  delete(keys: string[]): Promise<number>;
  list<T>(options: { prefix: string }): Promise<Map<string, T>>;
  transaction<T>(work: (store: VaultStore) => Promise<T>): Promise<T>;
}
interface VaultState {
  storage: VaultStore;
}
export interface CloudEnv {
  CLOUD_LIMITER?: {
    limit(options: { key: string }): Promise<{ success: boolean }>;
  };
  BACKUP_VAULTS?: {
    idFromName(name: string): unknown;
    get(id: unknown): { fetch(request: Request): Promise<Response> };
  };
  NUTRIDUO_ACCESS_TOKEN?: string;
  REQUEST_LIMITER: {
    limit(options: { key: string }): Promise<{ success: boolean }>;
  };
}
const base = z.object({ profileId: cloudProfileSchema });
const registration = base
  .extend({ salt: saltSchema, auth: hexKeySchema })
  .strict();
const start = base
  .extend({
    baseRevision: z.number().int().nonnegative(),
    meta: cloudMetaSchema.omit({ id: true, revision: true, savedAt: true }),
  })
  .strict();
const upload = base
  .extend({
    id: z.string().uuid(),
    offset: z.number().int().min(0).max(CLOUD_MAX_CHUNKS),
    chunks: z
      .array(
        z
          .string()
          .min(4)
          .max(87384)
          .regex(/^[A-Za-z0-9+/]+={0,2}$/),
      )
      .min(1)
      .max(16),
  })
  .strict();
const commit = base.extend({ id: z.string().uuid() }).strict();
const read = base
  .extend({
    id: z.string().uuid(),
    offset: z.number().int().nonnegative(),
  })
  .strict();
const result = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
const hex = (data: ArrayBuffer) =>
  [...new Uint8Array(data)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
async function hash(value: string) {
  return hex(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
}
export async function secretMatches(value: string, expected: string) {
  const a = await hash(value),
    b = await hash(expected);
  let difference = 0;
  for (let i = 0; i < a.length; i++)
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}
type Account = { salt: string; verifier: string };
type Pending = { meta: CloudMeta; baseRevision: number; received: number[] };
const partKey = (id: string, index: number) =>
  `data/${id}/${String(index).padStart(4, "0")}`;
async function removeParts(store: VaultStore, meta: CloudMeta) {
  for (let offset = 0; offset < meta.parts; offset += 128)
    await store.delete(
      Array.from({ length: Math.min(128, meta.parts - offset) }, (_, i) =>
        partKey(meta.id, offset + i),
      ),
    );
}

// One SQLite-backed Durable Object per profile. Strongly consistent head and
// compare-and-swap commits prevent an old/empty device replacing a newer backup.
// Only ciphertext is stored here, never photos, PINs or passwords in plaintext.
export class BackupVault {
  constructor(private state: VaultState) {}
  async fetch(request: Request): Promise<Response> {
    try {
      const body = await request.json();
      if (new URL(request.url).pathname === "/internal/household")
        return householdRoute(body, this.state.storage);
      base.parse(body);
      const path = new URL(request.url).pathname;
      const store = this.state.storage;
      const account = await store.get<Account>("account");
      if (path === "/cloud/challenge")
        return result({ exists: Boolean(account), salt: account?.salt });
      if (path === "/cloud/register") {
        const input = registration.parse(body);
        const created = await store.transaction(async (tx) => {
          if (await tx.get("account")) return false;
          await tx.put("account", {
            salt: input.salt,
            verifier: await hash(input.auth),
          });
          return true;
        });
        return created
          ? result({ ready: true })
          : result(
              { error: "Esta cuenta ya existe. Ingresá para recuperarla." },
              409,
            );
      }
      const token =
        request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
      if (
        !account ||
        !hexKeySchema.safeParse(token).success ||
        !(await secretMatches(await hash(token), account.verifier))
      )
        return result({ error: "Usuario o contraseña incorrectos." }, 401);
      const latest = (await store.get<CloudMeta>("latest")) ?? null;
      const previous = (await store.get<CloudMeta>("previous")) ?? null;
      if (path === "/cloud/head") return result({ latest, previous });
      if (path === "/cloud/start") {
        const input = start.parse(body);
        if (input.meta.parts !== Math.ceil(input.meta.bytes / 65536))
          return result({ error: "Tamaño de respaldo inválido." }, 400);
        const pending: Pending = {
          baseRevision: input.baseRevision,
          received: [],
          meta: {
            ...input.meta,
            id: crypto.randomUUID(),
            revision: input.baseRevision + 1,
            savedAt: new Date().toISOString(),
          },
        };
        const accepted = await store.transaction(async (tx) => {
          const head = await tx.get<CloudMeta>("latest");
          if ((head?.revision ?? 0) !== input.baseRevision) return false;
          const old = await tx.get<Pending>("pending");
          if (old) await removeParts(tx, old.meta);
          await tx.put("pending", pending);
          return true;
        });
        return accepted ? result({ id: pending.meta.id }) : this.conflict();
      }
      if (path === "/cloud/upload") {
        const input = upload.parse(body);
        const accepted = await store.transaction(async (tx) => {
          const pending = await tx.get<Pending>("pending");
          if (
            !pending ||
            pending.meta.id !== input.id ||
            input.offset + input.chunks.length > pending.meta.parts
          )
            return false;
          for (const [i, value] of input.chunks.entries()) {
            const index = input.offset + i;
            const bytes = atob(value).length;
            const expected =
              index === pending.meta.parts - 1
                ? pending.meta.bytes - index * 65536
                : 65536;
            if (bytes !== expected) throw new Error("invalid_chunk");
          }
          await tx.put(
            Object.fromEntries(
              input.chunks.map((value, i) => [
                partKey(input.id, input.offset + i),
                value,
              ]),
            ),
          );
          pending.received = [
            ...new Set([
              ...pending.received,
              ...input.chunks.map((_, i) => input.offset + i),
            ]),
          ];
          await tx.put("pending", pending);
          return true;
        });
        return accepted ? result({ ready: true }) : this.conflict();
      }
      if (path === "/cloud/commit") {
        const input = commit.parse(body);
        const accepted = await store.transaction(async (tx) => {
          const pending = await tx.get<Pending>("pending");
          const head = await tx.get<CloudMeta>("latest");
          if (
            !pending ||
            pending.meta.id !== input.id ||
            (head?.revision ?? 0) !== pending.baseRevision
          )
            return null;
          if (pending.received.length !== pending.meta.parts) return null;
          const old = await tx.get<CloudMeta>("previous");
          if (old) await removeParts(tx, old);
          if (head) await tx.put("previous", head);
          await tx.put("latest", pending.meta);
          await tx.delete(["pending"]);
          return pending.meta;
        });
        return accepted ? result({ latest: accepted }) : this.conflict();
      }
      if (path === "/cloud/read") {
        const input = read.parse(body);
        const meta = [latest, previous].find((m) => m?.id === input.id);
        if (!meta || input.offset >= meta.parts) return this.conflict();
        const chunks = await Promise.all(
          Array.from(
            { length: Math.min(16, meta.parts - input.offset) },
            (_, i) => store.get<string>(partKey(input.id, input.offset + i)),
          ),
        );
        if (chunks.some((chunk) => !chunk))
          return result(
            {
              error: "La copia no está completa. No se modificaron tus datos.",
            },
            503,
          );
        return result({ chunks });
      }
      return result({ error: "Ruta no disponible." }, 404);
    } catch {
      return result(
        {
          error:
            "No se pudo guardar el respaldo. Tus datos locales se conservan. Probá nuevamente.",
        },
        400,
      );
    }
  }
  private conflict() {
    return result(
      {
        error:
          "Hay una copia más reciente o cambió la carga. Recuperá la nube antes de reemplazarla.",
      },
      409,
    );
  }
}

export async function cloudRoute(request: Request, env: CloudEnv) {
  const path = new URL(request.url).pathname;
  if (
    env.CLOUD_LIMITER &&
    !(
      await env.CLOUD_LIMITER.limit({
        key: request.headers.get("CF-Connecting-IP") ?? "unknown",
      })
    ).success
  )
    return result(
      { error: "Esperá un minuto antes de volver a conectar el respaldo." },
      429,
    );
  if (
    request.method !== "POST" ||
    ![
      "challenge",
      "register",
      "head",
      "start",
      "upload",
      "commit",
      "read",
      "household",
    ].some((route) => path === `/cloud/${route}`)
  )
    return result({ error: "Ruta no disponible." }, 404);
  if (!env.BACKUP_VAULTS)
    return result(
      { error: "El respaldo en la nube todavía no está disponible." },
      503,
    );
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return result({ error: "Se espera JSON." }, 415);
  if (["/cloud/challenge", "/cloud/register", "/cloud/head"].includes(path)) {
    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    if (!(await env.REQUEST_LIMITER.limit({ key: `cloud-auth:${ip}` })).success)
      return result(
        { error: "Esperá un minuto antes de volver a ingresar." },
        429,
      );
  }
  if (path === "/cloud/register") {
    const token =
      request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
    if (
      !env.NUTRIDUO_ACCESS_TOKEN ||
      !(await secretMatches(token, env.NUTRIDUO_ACCESS_TOKEN))
    )
      return result(
        {
          error:
            "Para crear la cuenta necesitás el código privado de NutriDuo (el mismo de análisis).",
        },
        401,
      );
  }
  try {
    const reader = request.body?.getReader();
    let text = "",
      size = 0;
    const decoder = new TextDecoder();
    if (!reader) throw new Error("empty");
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      size += next.value.byteLength;
      if (size > 1600000) {
        await reader.cancel();
        return result({ error: "Parte del respaldo demasiado grande." }, 413);
      }
      text += decoder.decode(next.value, { stream: true });
    }
    text += decoder.decode();
    const parsed = base.parse(JSON.parse(text));
    if (path === "/cloud/household") {
      const input = householdActionSchema.parse(JSON.parse(text));
      const own = await env.BACKUP_VAULTS.get(
        env.BACKUP_VAULTS.idFromName(parsed.profileId),
      ).fetch(
        new Request("https://vault.internal/cloud/head", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: request.headers.get("authorization") ?? "",
          },
          body: JSON.stringify(parsed),
        }),
      );
      if (!own.ok) return own;
      if (input.action === "publish") {
        const head = (await own.json()) as { latest: CloudMeta | null };
        if (
          !head.latest ||
          head.latest.revision !== input.member.sourceRevision
        )
          return result(
            {
              error:
                "Guardá primero tu respaldo más reciente antes de actualizar el menú compartido.",
            },
            409,
          );
      }
      return env.BACKUP_VAULTS.get(
        env.BACKUP_VAULTS.idFromName("nutriduo-household"),
      ).fetch(
        new Request("https://vault.internal/internal/household", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        }),
      );
    }
    return await env.BACKUP_VAULTS.get(
      env.BACKUP_VAULTS.idFromName(parsed.profileId),
    ).fetch(
      new Request(`https://vault.internal${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: request.headers.get("authorization") ?? "",
        },
        body: text,
      }),
    );
  } catch {
    return result(
      {
        error:
          "No pudimos completar el respaldo. Tus datos locales se conservan.",
      },
      400,
    );
  }
}
