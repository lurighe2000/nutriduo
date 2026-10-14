import { z } from "zod";
import {
  analysisRequestSchema,
  analysisResponseSchema,
  ANALYSIS_INSTRUCTIONS,
  nutrientFoodSchema,
  type NutrientFood,
} from "../src/services/aiContract";
import type { Micronutrients } from "../src/schemas";

export interface Env {
  GROQ_API_KEY?: string;
  NUTRIDUO_ACCESS_TOKEN?: string;
  USDA_API_KEY?: string;
  ALLOWED_ORIGINS: string;
  REQUEST_LIMITER: {
    limit: (options: { key: string }) => Promise<{ success: boolean }>;
  };
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
async function readBody(request: Request) {
  if (Number(request.headers.get("content-length")) > MAX_BODY)
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
    if (bytes > MAX_BODY) {
      await reader.cancel();
      throw new Error("body_limit");
    }
    text += decoder.decode(chunk.value, { stream: true });
  }
  return JSON.parse(text + decoder.decode());
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
        model: "qwen/qwen3.8-27b",
        nutritionDatabase: Boolean(env.USDA_API_KEY),
      });
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
      body = await readBody(request);
    } catch {
      return reply(
        { error: "Solicitud inválida o foto demasiado grande." },
        400,
      );
    }
    try {
      if (path === "/nutrition/search") {
        if (!env.USDA_API_KEY)
          return reply(
            {
              error:
                "La base nutricional todavía no está conectada. Podés usar una etiqueta o registrar la estimación.",
            },
            503,
          );
        const input = z
          .object({ query: z.string().trim().min(2).max(150) })
          .strict()
          .safeParse(body);
        if (!input.success)
          return reply({ error: "Ingresá un alimento para buscar." }, 400);
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
              "Agregá una foto válida y una descripción con cantidades y cocción.",
          },
          400,
        );
      const response = await upstream(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${env.GROQ_API_KEY}`,
          },
          body: JSON.stringify({
            model: "qwen/qwen3.8-27b",
            messages: [
              { role: "system", content: ANALYSIS_INSTRUCTIONS },
              {
                role: "user",
                content: [
                  { type: "text", text: input.data.description },
                  { type: "image_url", image_url: { url: input.data.photo } },
                ],
              },
            ],
            response_format: { type: "json_object" },
            max_completion_tokens: 2048,
          }),
          signal: AbortSignal.timeout(45000),
        },
      );
      if (response.status === 429) {
        const retry = response.headers.get("retry-after");
        return reply(
          {
            error:
              "La cuota gratuita de IA está agotada temporalmente. Volvé a intentar cuando se renueve o cargá la comida manualmente.",
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
      const result = groqResponse.parse(await response.json()).choices[0];
      if (result.finish_reason !== "stop")
        return reply(
          {
            error:
              "El análisis quedó incompleto. Probá describir menos componentes por vez.",
          },
          502,
        );
      const valid = analysisResponseSchema.parse(
        JSON.parse(result.message.content),
      );
      return reply(valid);
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
export default { fetch: createHandler() };
