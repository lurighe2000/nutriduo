import { describe, it, expect, vi } from "vitest";
import { createHandler, mapUSDA, searchCatalog, type Env } from "../../worker";
import catalog from "../../worker/nutrition-catalog.json";
import { nutrientFoodSchema } from "./aiContract";
const secret = "fixture-connection-code-at-least-32-characters";
const env: Env = {
  ALLOWED_ORIGINS: "https://lurighe2000.github.io",
  NUTRIDUO_ACCESS_TOKEN: secret,
  GROQ_API_KEY: "fixture-server-secret",
  USDA_API_KEY: "fixture-usda",
  REQUEST_LIMITER: { limit: async () => ({ success: true }) },
};
const photo = "data:image/jpeg;base64,YQ==";
const analysis = {
  meal_name: "Plato de prueba",
  confidence: 0.6,
  foods: [
    {
      name: "Arroz",
      estimated_grams: 150,
      calories: 195,
      protein_g: 3,
      carbs_g: 42,
      fat_g: 0.5,
      confidence: 0.6,
    },
  ],
  questions: [],
};
function request(
  path = "/analyze",
  body: unknown = {
    photo,
    description: "Arroz cocido, 150 gramos, sin aceite",
  },
  token = secret,
  origin = env.ALLOWED_ORIGINS,
) {
  return new Request(`https://fixture.workers.dev${path}`, {
    method: "POST",
    headers: {
      origin,
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}
describe("servicio de IA", () => {
  it("el catálogo oficial valida todos los registros y permite buscar sin otra clave ni consultas externas", async () => {
    expect(catalog.foods.length).toBeGreaterThan(1000);
    for (const food of catalog.foods)
      expect(nutrientFoodSchema.safeParse(food).success).toBe(true);
    const results = searchCatalog("rice cooked");
    expect(searchCatalog("banana raw edible portion").length).toBeGreaterThan(
      0,
    );
    expect(results.length).toBeGreaterThan(0);
    expect(
      results.every(
        (food) => /rice/i.test(food.name) && /cooked/i.test(food.name),
      ),
    ).toBe(true);
    const upstream = vi.fn();
    const response = await createHandler(upstream)(
      request("/nutrition/search", { query: "rice cooked" }),
      { ...env, USDA_API_KEY: undefined },
    );
    expect(response.status).toBe(200);
    expect((await response.json()).foods.length).toBeGreaterThan(0);
    expect(upstream).not.toHaveBeenCalled();
  });
  it("bloquea origen y código antes de llamar a Groq", async () => {
    const upstream = vi.fn();
    const handle = createHandler(upstream);
    expect(
      (
        await handle(
          request("/analyze", {}, secret, "https://example.com"),
          env,
        )
      ).status,
    ).toBe(403);
    expect(
      (await handle(request("/analyze", {}, "incorrecto"), env)).status,
    ).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
  });
  it("no funciona sin secreto fuerte ni clave del proveedor", async () => {
    const upstream = vi.fn();
    const handle = createHandler(upstream);
    expect(
      (await handle(request(), { ...env, NUTRIDUO_ACCESS_TOKEN: "1234" }))
        .status,
    ).toBe(503);
    expect(
      (await handle(request(), { ...env, GROQ_API_KEY: undefined })).status,
    ).toBe(503);
    expect(upstream).not.toHaveBeenCalled();
  });
  it("valida imagen, descripción y evita que el cliente elija modelo o instrucciones", async () => {
    const upstream = vi.fn();
    const handle = createHandler(upstream);
    for (const body of [
      {
        photo: "https://example.com/photo.jpg",
        description: "Comida de prueba",
      },
      { photo, description: "" },
      { photo, description: "Plato de prueba", model: "paid-model" },
      { photos: [], description: "Plato de prueba" },
      { photos: [photo, photo, photo, photo], description: "Plato de prueba" },
      { photos: [photo], photo, description: "Plato de prueba" },
      {
        photos: [photo, "https://example.com/label.jpg"],
        description: "Plato de prueba",
      },
    ])
      expect((await handle(request("/analyze", body), env)).status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });
  it("aplica límites propios sin consumir al proveedor", async () => {
    const upstream = vi.fn();
    const response = await createHandler(upstream)(request(), {
      ...env,
      REQUEST_LIMITER: { limit: async () => ({ success: false }) },
    });
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(upstream).not.toHaveBeenCalled();
  });
  it("devuelve análisis validado y sólo envía foto y descripción, con el modelo fijo", async () => {
    const upstream = vi.fn(async () =>
      Response.json({
        choices: [
          {
            finish_reason: "stop",
            message: { content: JSON.stringify({ status: "ready", analysis }) },
          },
        ],
      }),
    );
    const response = await createHandler(upstream)(request(), env);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ready", analysis });
    const args = upstream.mock.calls as unknown as [string, RequestInit][];
    expect(args[0][0]).toBe("https://api.groq.com/openai/v1/chat/completions");
    const body = JSON.parse(args[0][1].body as string);
    expect(body.model).toBe("qwen/qwen3.8-27b");
    expect(body.messages[1].content[1].image_url.url).toBe(photo);
    expect(body.profileId).toBeUndefined();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("permite pedir aclaraciones sin inventar componentes", async () => {
    const value = {
      status: "needs_details",
      questions: ["¿Qué parte del plato comiste?"],
    };
    const upstream = vi.fn(async () =>
      Response.json({
        choices: [
          {
            finish_reason: "stop",
            message: { content: JSON.stringify(value) },
          },
        ],
      }),
    );
    expect(
      await (await createHandler(upstream)(request(), env)).json(),
    ).toEqual(value);
  });
  it("envía todas las imágenes en orden en una sola consulta y acepta más de 2 MB en total", async () => {
    const upstream = vi.fn(async () =>
      Response.json({
        choices: [
          {
            finish_reason: "stop",
            message: { content: JSON.stringify({ status: "ready", analysis }) },
          },
        ],
      }),
    );
    const photos = ["a", "b", "c"].map(
      (value) => `data:image/jpeg;base64,${value.repeat(1000000)}`,
    );
    const response = await createHandler(upstream)(
      request("/analyze", {
        photos,
        description: "Plato, etiqueta y preparación; sólo consumí 150 g",
      }),
      env,
    );
    expect(response.status).toBe(200);
    expect(upstream).toHaveBeenCalledTimes(1);
    const body = JSON.parse(
      (upstream.mock.calls as unknown as [string, RequestInit][])[0][1]
        .body as string,
    );
    expect(
      body.messages[1].content
        .slice(1)
        .map((part: { image_url: { url: string } }) => part.image_url.url),
    ).toEqual(photos);
    expect(body.messages[0].content).toContain(
      "no sumes un plato ni ingrediente más de una vez",
    );
  });
  it("rechaza fotos o cuerpos demasiado grandes sin llamar a Groq", async () => {
    const upstream = vi.fn();
    const handle = createHandler(upstream);
    expect(
      (
        await handle(
          request("/analyze", {
            photos: [`data:image/jpeg;base64,${"a".repeat(2000000)}`],
            description: "Plato de prueba",
          }),
          env,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await handle(
          request("/analyze", {
            photos: [photo],
            description: "a".repeat(6100000),
          }),
          env,
        )
      ).status,
    ).toBe(413);
    expect(upstream).not.toHaveBeenCalled();
  });
  it("cuota agotada no reintenta, no cambia de modelo y no expone secretos", async () => {
    const upstream = vi.fn(
      async () =>
        new Response(env.GROQ_API_KEY, {
          status: 429,
          headers: { "retry-after": "120" },
        }),
    );
    const response = await createHandler(upstream)(request(), env);
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("120");
    expect(await response.text()).not.toContain(env.GROQ_API_KEY);
    expect(upstream).toHaveBeenCalledTimes(1);
  });
  it("si Groq agota la cuota usa la IA gratuita de Cloudflare como respaldo", async () => {
    const upstream = vi.fn(
      async () =>
        new Response("{}", { status: 429, headers: { "retry-after": "120" } }),
    );
    const run = vi.fn(async () => ({
      response: JSON.stringify({ status: "ready", analysis }),
    }));
    const response = await createHandler(upstream)(request(), {
      ...env,
      AI: { run },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ready",
      analysis,
      provider: "cloudflare",
    });
    expect(upstream).toHaveBeenCalledTimes(1);
    const [, input] = run.mock.calls[0] as unknown as [
      string,
      { messages: { content: unknown }[] },
    ];
    expect(JSON.stringify(input.messages[1].content)).toContain(photo);
  });
  it("si ambas IA fallan devuelve 429 sin guardar nada", async () => {
    const upstream = vi.fn(
      async () =>
        new Response("{}", { status: 429, headers: { "retry-after": "90" } }),
    );
    const response = await createHandler(upstream)(request(), {
      ...env,
      AI: { run: async () => ({ response: "no es JSON" }) },
    });
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("90");
  });
  it("reserva pocos tokens de respuesta para no agotar la cuota por minuto", async () => {
    const upstream = vi.fn(async () =>
      Response.json({
        choices: [
          {
            finish_reason: "stop",
            message: { content: JSON.stringify({ status: "ready", analysis }) },
          },
        ],
      }),
    );
    await createHandler(upstream)(request(), env);
    const args = upstream.mock.calls as unknown as [string, RequestInit][];
    expect(
      JSON.parse(args[0][1].body as string).max_completion_tokens,
    ).toBeLessThanOrEqual(1500);
  });
  it("rechaza JSON inválido, macros negativos y respuestas truncadas", async () => {
    for (const [content, reason] of [
      ["no es JSON", "stop"],
      [
        JSON.stringify({
          status: "ready",
          analysis: { ...analysis, confidence: -1 },
        }),
        "stop",
      ],
      [JSON.stringify({ status: "ready", analysis }), "length"],
    ]) {
      const response = await createHandler(async () =>
        Response.json({
          choices: [{ finish_reason: reason, message: { content } }],
        }),
      )(request(), env);
      expect(response.status).toBe(502);
    }
  });
  it("busca USDA sin enviar imágenes, nombres de perfiles ni credenciales en la URL", async () => {
    const upstream = vi.fn(async () => Response.json({ foods: [] }));
    const response = await createHandler(upstream)(
      request("/nutrition/search", { query: "rice cooked" }),
      env,
    );
    expect(response.status).toBe(200);
    const args = upstream.mock.calls as unknown as [string, RequestInit][];
    expect(args[0][0]).not.toContain(env.USDA_API_KEY);
    expect(args[0][1].body).not.toContain(photo);
  });
});
it("USDA conserva ausencia y cero, respeta unidades y rechaza fichas sin macros", () => {
  const n = (nutrientId: number, unitName: string, value: number) => ({
    nutrientId,
    unitName,
    value,
  });
  const foods = mapUSDA({
    foods: [
      {
        fdcId: 1,
        description: "Fixture",
        foodNutrients: [
          n(1008, "KCAL", 130),
          n(1003, "G", 3),
          n(1004, "G", 1),
          n(1005, "G", 28),
          n(1093, "MG", 0),
          n(1089, "MG", 0.5),
          n(1114, "IU", 50),
        ],
      },
      { fdcId: 2, description: "Sin macros", foodNutrients: [] },
    ],
  });
  expect(foods).toHaveLength(1);
  expect(foods[0].micronutrientsPer100).toEqual({ sodium_mg: 0, iron_mg: 0.5 });
  expect(foods[0].fiberKnown).toBe(false);
});
