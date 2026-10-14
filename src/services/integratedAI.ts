import { z } from "zod";
import {
  analysisRequestSchema,
  analysisResponseSchema,
  nutrientSearchSchema,
} from "./aiContract";
import type { ProfileId } from "../schemas";
export interface AIConnection {
  endpoint: string;
  accessCode: string;
  nutritionDatabase: boolean;
}
const connections = new Map<ProfileId, AIConnection>();
const sharedConnectionKey = "nutriduo-ai-service";
export function serviceEndpoint(value: string) {
  const url = new URL(value.trim());
  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".workers.dev") ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Usá la dirección HTTPS del servicio NutriDuo en workers.dev.",
    );
  return url.origin;
}
export function currentAIConnection(id: ProfileId) {
  const current = connections.get(id);
  if (current) return current;
  try {
    const value = z
      .object({
        endpoint: z.string(),
        accessCode: z.string().min(32).max(256),
        nutritionDatabase: z.boolean(),
      })
      .parse(
        JSON.parse(
          localStorage.getItem(sharedConnectionKey) ??
            localStorage.getItem(`nutriduo-ai-connection:${id}`) ??
            localStorage.getItem(
              `nutriduo-ai-connection:${id === "luca" ? "ari" : "luca"}`,
            ) ??
            "null",
        ),
      );
    value.endpoint = serviceEndpoint(value.endpoint);
    if (value.accessCode.startsWith("gsk_")) return undefined;
    connections.set(id, value);
    return value;
  } catch {
    return undefined;
  }
}
export function savedAIEndpoint(id: ProfileId) {
  return (
    currentAIConnection(id)?.endpoint ??
    localStorage.getItem(`nutriduo-ai-endpoint:${id}`) ??
    import.meta.env.VITE_AI_ENDPOINT ??
    ""
  );
}
export function forgetAIConnections() {
  connections.clear();
}
export function disconnectAI() {
  connections.clear();
  localStorage.removeItem(sharedConnectionKey);
  for (const id of ["luca", "ari"])
    localStorage.removeItem(`nutriduo-ai-connection:${id}`);
}
const healthSchema = z.object({
  ready: z.literal(true),
  provider: z.literal("groq"),
  nutritionDatabase: z.boolean(),
});
export async function verifyAIConnection(id: ProfileId, signal?: AbortSignal) {
  const connection = currentAIConnection(id);
  if (!connection)
    throw new Error("Conectá el servicio una vez en este dispositivo.");
  const health = healthSchema.parse(
    await request(connection, "/health", undefined, signal),
  );
  if (signal?.aborted || currentAIConnection(id) !== connection)
    throw new Error("La comprobación fue cancelada.");
  connection.nutritionDatabase = health.nutritionDatabase;
  connections.set(id, connection);
  if (
    localStorage.getItem(sharedConnectionKey) ||
    localStorage.getItem(`nutriduo-ai-connection:${id}`) ||
    localStorage.getItem(
      `nutriduo-ai-connection:${id === "luca" ? "ari" : "luca"}`,
    )
  ) {
    localStorage.setItem(sharedConnectionKey, JSON.stringify(connection));
    for (const profile of ["luca", "ari"])
      localStorage.removeItem(`nutriduo-ai-connection:${profile}`);
  }
  return connection;
}
async function request(
  connection: AIConnection,
  path: string,
  body?: unknown,
  signal?: AbortSignal,
) {
  if (!navigator.onLine)
    throw new Error(
      "El análisis necesita conexión. Podés registrar la comida manualmente.",
    );
  let response: Response;
  try {
    response = await fetch(`${serviceEndpoint(connection.endpoint)}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        authorization: `Bearer ${connection.accessCode}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: signal ?? AbortSignal.timeout(50000),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(
      "No pudimos contactar al servicio. Conservá el formulario y probá más tarde.",
    );
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = z.object({ error: z.string().max(500) }).safeParse(data);
    const retry = Number(response.headers.get("retry-after"));
    throw new Error(
      `${message.success ? message.data.error : "El servicio no pudo completar la consulta."}${response.status === 429 && retry > 0 && retry < 604800 ? ` Esperá aproximadamente ${Math.ceil(retry / 60)} minuto(s).` : ""}`,
    );
  }
  return data;
}
export async function connectAI(
  id: ProfileId,
  endpoint: string,
  accessCode: string,
  remember = true,
) {
  if (
    accessCode.trim().length < 32 ||
    accessCode.trim().length > 256 ||
    accessCode.trim().startsWith("gsk_")
  )
    throw new Error(
      "Ingresá el código de conexión de NutriDuo. La clave de Groq va únicamente en Cloudflare.",
    );
  const connection: AIConnection = {
    endpoint: serviceEndpoint(endpoint),
    accessCode: accessCode.trim(),
    nutritionDatabase: false,
  };
  const health = healthSchema.parse(await request(connection, "/health"));
  connection.nutritionDatabase = health.nutritionDatabase;
  connections.clear();
  connections.set(id, connection);
  localStorage.setItem(`nutriduo-ai-endpoint:${id}`, connection.endpoint);
  for (const profile of ["luca", "ari"])
    localStorage.removeItem(`nutriduo-ai-connection:${profile}`);
  if (remember)
    localStorage.setItem(sharedConnectionKey, JSON.stringify(connection));
  else localStorage.removeItem(sharedConnectionKey);
  return connection;
}
export async function analyzeMeal(
  id: ProfileId,
  photo: string,
  description: string,
  signal?: AbortSignal,
) {
  const connection = currentAIConnection(id);
  if (!connection)
    throw new Error("Conectá el análisis para este perfil primero.");
  const input = analysisRequestSchema.parse({ photo, description });
  return analysisResponseSchema.parse(
    await request(connection, "/analyze", input, signal),
  );
}
export async function searchNutrition(
  id: ProfileId,
  query: string,
  signal?: AbortSignal,
) {
  const connection = currentAIConnection(id);
  if (!connection?.nutritionDatabase)
    throw new Error("La base nutricional todavía no está conectada.");
  return nutrientSearchSchema.parse(
    await request(connection, "/nutrition/search", { query }, signal),
  ).foods;
}
export async function notificationRequest(
  id: ProfileId,
  path: "config" | "status" | "subscribe" | "unsubscribe" | "test",
  body: unknown = {},
) {
  const connection = currentAIConnection(id);
  if (!connection)
    throw new Error(
      "Conectá NutriDuo en Más → Análisis de comidas antes de activar recordatorios.",
    );
  return request(
    connection,
    `/notifications/${path}`,
    body,
    AbortSignal.timeout(15000),
  );
}
