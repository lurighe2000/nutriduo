import { z } from "zod";
import {
  analysisRequestSchema,
  analysisResponseSchema,
  ANALYSIS_INSTRUCTIONS,
  nutrientFoodSchema,
  type NutrientFood,
} from "../src/services/aiContract";
import type { Micronutrients } from "../src/schemas";
import catalog from "./nutrition-catalog.json";
import { pushRoute, sendReminders, type PushEnv } from "./notifications";
import { cloudRoute, type CloudEnv } from "./cloud";
export { BackupVault } from "./cloud";
const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const catalogIndex = (catalog.foods as NutrientFood[]).map((food) => ({
  food,
  text: normalize(food.name),
}));
export function searchCatalog(query: string): NutrientFood[] {
  const words = normalize(query)
    .split(" ")
    .filter(
      (word) => word && !["edible", "portion", "food", "foods"].includes(word),
    );
  if (!words.length) return [];
  return catalogIndex
    .filter((entry) => words.every((word) => entry.text.includes(word)))
    .sort((a, b) => a.text.length - b.text.length)
    .slice(0, 8)
    .map((entry) => entry.food);
}

export interface Env extends PushEnv, CloudEnv {
  GROQ_API_KEY?: string;
  NUTRIDUO_ACCESS_TOKEN?: string;
  USDA_API_KEY?: string;
  ALLOWED_ORIGINS: string;
  REQUEST_LIMITER: {
    limit: (options: { key: string }) => Promise<{ success: boolean }>;
  };
  AI?: { run: (model: string, input: unknown) => Promise<unknown> };
}
const MAX_BODY = 2100000;
const groqResponse = z.object({
  choices: z
    .array(
      z.object({
        finish_reason: z.string().nullable(),
        message: z.object({ content: z.string().max(100000) }),
      }),
    )
    .min(1),
});
const fdcSearch = z.object({
  foods: z
    .array(
      z.object({
        fdcId: z.number().int().positive(),
        description: z.string(),
        foodNutrients: z
          .array(
            z.object({
              nutrientId: z.number(),
              unitName: z.string(),
              value: z.number().finite().nonnegative(),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
});
const nutrientIds: Record<number, [keyof Micronutrients, string]> = {
  1093: ["sodium_mg", "MG"],
  1092: ["potassium_mg", "MG"],
  1087: ["calcium_mg", "MG"],
  1089: ["iron_mg", "MG"],
  1090: ["magnesium_mg", "MG"],
  1095: ["zinc_mg", "MG"],
  1106: ["vitamin_a_ug", "UG"],
  1162: ["vitamin_c_mg", "MG"],
  1114: ["vitamin_d_ug", "UG"],
  1109: ["vitamin_e_mg", "MG"],
  1178: ["vitamin_b12_ug", "UG"],
  1177: ["folate_ug", "UG"],
};
export function mapUSDA(value: unknown): NutrientFood[] {
  const data = fdcSearch.parse(value);
  return data.foods
    .flatMap((food) => {
      const find = (id: number, unit: string) =>
        food.foodNutrients.find(
          (n) => n.nutrientId === id && n.unitName.toUpperCase() === unit,
        )?.value;
      const calories =
        find(1008, "KCAL") ?? find(2048, "KCAL") ?? find(2047, "KCAL");
      const protein = find(1003, "G"),
        carbs = find(1005, "G"),
        fat = find(1004, "G"),
        fiber = find(1079, "G");
      if (
        calories === undefined ||
        protein === undefined ||
        carbs === undefined ||
        fat === undefined
      )
        return [];
      const micro: Micronutrients = {};
      for (const [id, [key, unit]] of Object.entries(nutrientIds)) {
        const v = find(Number(id), unit);
        if (v !== undefined) micro[key] = v;
      }
      const result = nutrientFoodSchema.safeParse({
        name: food.description.slice(0, 300),
        per100: { calories, protein, carbs, fat, fiber: fiber ?? 0 },
        fiberKnown: fiber !== undefined,
        micronutrientsPer100: micro,
        nutritionReference: {
          source: "usda",
          id: String(food.fdcId),
          description: food.description.slice(0, 300),
        },
      });
      return result.success ? [result.data] : [];
    })
    .slice(0, 8);
}
async function equalSecret(a: string, b: string) {
  const digest = (value: string) =>
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const [x, y] = await Promise.all([digest(a), digest(b)]);
  const p = new Uint8Array(x),
    q = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < p.length; i++) diff |= p[i] ^ q[i];
  return diff === 0;
}
async function readBody(request: Request, maxBody = MAX_BODY) {
  if (Number(request.headers.get("content-length")) > maxBody)
    throw new Error("body_limit");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("body_empty");
  const decoder = new TextDecoder();
  let bytes = 0,
    text = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    bytes += chunk.value.byteLength;
    if (bytes > maxBody) {
      await reader.cancel();
      throw new Error("body_limit");
    }
    text += decoder.decode(chunk.value, { stream: true });
  }
  return JSON.parse(text + decoder.decode());
}
const GROQ_MODEL = "qwen/qwen3.8-27b";
const BACKUP_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";
const MAX_OUTPUT_TOKENS = 1400;
const GROQ_SHORT_WAIT = 12;
type UserContent = (
  { type: string; text: string } | { type: string; image_url: { url: string } }
)[];
// Free Workers AI backup: used only when Groq is out of quota or fails.
export async function analyzeWithWorkersAI(env: Env, content: UserContent) {
  if (!env.AI) return undefined;
  try {
    const output = (await env.AI.run(BACKUP_MODEL, {
      messages: [
        { role: "system", content: ANALYSIS_INSTRUCTIONS },
        { role: "user", content },
      ],
      response_format: { type: "json_object" },
      max_tokens: MAX_OUTPUT_TOKENS,
      temperature: 0.2,
    })) as { response?: unknown };
    const raw = output?.response;
    const value =
      typeof raw === "string"
        ? JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ""))
        : raw;
    return analysisResponseSchema.parse(value);
  } catch {
    return undefined;
  }
}
export function createHandler(upstream: typeof fetch = fetch) {
  return async (request: Request, env: Env): Promise<Response> => {
    const origin = request.headers.get("origin") ?? "";
    const allowed = env.ALLOWED_ORIGINS.split(",").map((s) => s.trim());
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "cache-control": "no-store",
      vary: "Origin",
      "x-content-type-options": "nosniff",
    };
    const reply = (data: unknown, status = 200, extra = {}) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { ...headers, ...extra },
      });
    if (!allowed.includes(origin))
      return reply({ error: "Origen no permitido." }, 403);
    headers["access-control-allow-origin"] = origin;
    headers["access-control-expose-headers"] = "Retry-After";
    if (request.method === "OPTIONS")
      return new Response(null, {
        status: 204,
        headers: {
          ...headers,
          "access-control-allow-methods": "GET, POST, OPTIONS",
          "access-control-allow-headers": "Content-Type, Authorization",
          "access-control-max-age": "3600",
        },
      });
    if (new URL(request.url).pathname.startsWith("/cloud/")) {
      const response = await cloudRoute(request, env);
      return new Response(response.body, {
        status: response.status,
        headers: { ...Object.fromEntries(response.headers), ...headers },
      });
    }
    if (
      !env.NUTRIDUO_ACCESS_TOKEN ||
      env.NUTRIDUO_ACCESS_TOKEN.length < 32 ||
      !env.GROQ_API_KEY
    )
      return reply(
        { error: "El servicio de análisis todavía no está configurado." },
        503,
      );
    const token =
      request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
    if (
      token.length > 256 ||
      !(await equalSecret(token, env.NUTRIDUO_ACCESS_TOKEN))
    )
      return reply({ error: "Código de conexión incorrecto." }, 401);
    const path = new URL(request.url).pathname;
    if (request.method === "GET" && path === "/health")
      return reply({
        ready: true,
        provider: "groq",
        model: GROQ_MODEL,
        backup: Boolean(env.AI),
        nutritionDatabase: true,
      });
    if (path.startsWith("/notifications/") && request.method === "POST") {
      if (
        ![
          "/notifications/config",
          "/notifications/status",
          "/notifications/subscribe",
          "/notifications/unsubscribe",
          "/notifications/test",
        ].includes(path)
      )
        return reply({ error: "Ruta no disponible" }, 404);
      const limited = await env.REQUEST_LIMITER.limit({ key: path });
      if (!limited.success)
        return reply(
          { error: "Esperá un minuto antes de cambiar los recordatorios." },
          429,
        );
      if (!request.headers.get("content-type")?.startsWith("application/json"))
        return reply({ error: "Se espera JSON" }, 415);
      try {
        return reply(
          await pushRoute(path, await readBody(request), env, upstream),
        );
      } catch (error) {
        return reply(
          {
            error:
              error instanceof z.ZodError
                ? "Suscripción de notificaciones inválida."
                : error instanceof Error
                  ? error.message
                  : "No se pudo configurar.",
          },
          400,
        );
      }
    }
    if (
      request.method !== "POST" ||
      !["/analyze", "/nutrition/search"].includes(path)
    )
      return reply({ error: "Ruta no disponible." }, 404);
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      return reply({ error: "Se espera JSON." }, 415);
    const limited = await env.REQUEST_LIMITER.limit({ key: path });
    if (!limited.success)
      return reply(
        { error: "Esperá un minuto antes de volver a consultar." },
        429,
        { "retry-after": "60" },
      );
    let body: unknown;
    try {
      body = await readBody(request, path === "/analyze" ? 6100000 : MAX_BODY);
    } catch (error) {
      return reply(
        { error: "Solicitud inválida o fotos demasiado grandes." },
        error instanceof Error && error.message === "body_limit" ? 413 : 400,
      );
    }
    try {
      if (path === "/nutrition/search") {
        const input = z
          .object({ query: z.string().trim().min(2).max(150) })
          .strict()
          .safeParse(body);
        if (!input.success)
          return reply({ error: "Ingresá un alimento para buscar." }, 400);
        if (!env.USDA_API_KEY)
          return reply({ foods: searchCatalog(input.data.query) });
        const response = await upstream(
          "https://api.nal.usda.gov/fdc/v1/foods/search",
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
              "X-Api-Key": env.USDA_API_KEY,
            },
            body: JSON.stringify({
              query: input.data.query,
              pageSize: 8,
              dataType: ["Foundation", "SR Legacy", "Survey (FNDDS)"],
            }),
            signal: AbortSignal.timeout(15000),
          },
        );
        if (!response.ok)
          return reply(
            {
              error:
                response.status === 429
                  ? "La cuota de la base nutricional está agotada temporalmente."
                  : "La base nutricional no responde. Probá más tarde.",
            },
            response.status === 429 ? 429 : 502,
          );
        return reply({ foods: mapUSDA(await response.json()) });
      }
      const input = analysisRequestSchema.safeParse(body);
      if (!input.success)
        return reply(
          {
            error:
              "Agregá fotos válidas y una descripción con cantidades y cocción.",
          },
          400,
        );
      const userContent = [
        { type: "text", text: input.data.description },
        ...input.data.photos.map((photo) => ({
          type: "image_url",
          image_url: { url: photo },
        })),
      ];
      const askGroq = () =>
        upstream("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: GROQ_MODEL,
            messages: [
              { role: "system", content: ANALYSIS_INSTRUCTIONS },
              { role: "user", content: userContent },
            ],
            response_format: { type: "json_object" },
            // The free tier counts the reserved output against tokens per
            // minute: keep it close to what a meal analysis really needs.
            max_completion_tokens: MAX_OUTPUT_TOKENS,
          }),
          signal: AbortSignal.timeout(45000),
        });
      let response = await askGroq();
      // A short per-minute wait is cheaper than giving up: retry once.
      if (response.status === 429) {
        const wait = Number(response.headers.get("retry-after"));
        if (wait > 0 && wait <= GROQ_SHORT_WAIT) {
          await new Promise((resolve) => setTimeout(resolve, wait * 1000));
          response = await askGroq();
        }
      }
      if (response.ok) {
        try {
          const result = groqResponse.parse(await response.json()).choices[0];
          if (result.finish_reason === "stop")
            return reply(
              analysisResponseSchema.parse(JSON.parse(result.message.content)),
            );
        } catch {
          // Fall through to the backup model before reporting an error.
        }
      }
      const backup = await analyzeWithWorkersAI(env, userContent);
      if (backup) return reply({ ...backup, provider: "cloudflare" });
      if ([413, 429].includes(response.status)) {
        const retry = response.headers.get("retry-after");
        return reply(
          {
            error:
              "Se agotó por ahora la cuota gratuita de las dos IA. Probá de nuevo en unos minutos o cargá la comida manualmente.",
          },
          429,
          retry && /^\d+(?:\.\d+)?$/.test(retry)
            ? { "retry-after": retry }
            : {},
        );
      }
      if (!response.ok)
        return reply(
          {
            error: [401, 403].includes(response.status)
              ? "Revisá la conexión de Groq en el servicio."
              : "La IA no está disponible. Podés registrar la comida manualmente.",
          },
          502,
        );
      return reply(
        {
          error:
            "La IA devolvió datos incompletos. Probá describir menos componentes por vez. No se guardó ninguna comida.",
        },
        502,
      );
    } catch (error) {
      return reply(
        {
          error:
            error instanceof z.ZodError || error instanceof SyntaxError
              ? "La IA devolvió datos incompletos. No se guardó ninguna comida."
              : "No se pudo completar la consulta. Tu comida sigue sin guardar.",
        },
        502,
      );
    }
  };
}
export default {
  fetch: createHandler(),
  scheduled: (event: { scheduledTime: number }, env: Env) =>
    sendReminders(event.scheduledTime, env),
};
