import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve, extname } from "node:path";
async function setup(page: Page, name = "Luca", url = "/") {
  await page.goto(url);
  await page
    .getByRole("button", {
      name: new RegExp(name + " Construir|" + name + " Sentirte"),
    })
    .click();
  await page.getByLabel("Crear PIN", { exact: true }).fill("1234");
  await page.getByLabel("Repetir PIN").fill("1234");
  await page.getByRole("button", { name: "Crear mi PIN" }).click();
  await page.getByLabel("Peso actual (kg)").fill(name === "Luca" ? "60" : "69");
  await page.getByLabel("Altura (cm)").fill(name === "Luca" ? "169" : "165");
  await page
    .getByLabel("Fecha de nacimiento")
    .fill(name === "Luca" ? "2000-06-15" : "2004-01-15");
  await page.getByRole("button", { name: "Ver propuesta" }).click();
  await page.getByRole("button", { name: "Confirmar y empezar" }).click();
  await expect(
    page.getByRole("heading", { name: `Hoy, ${name}` }),
  ).toBeVisible();
}
async function navigate(page: Page, name: string) {
  await page
    .locator(".sidebar")
    .getByRole("button", { name, exact: true })
    .click();
}
async function manualMeal(page: Page) {
  await page
    .getByRole("button", { name: "Registrar comida", exact: true })
    .first()
    .click();
  await page.getByLabel("Nombre de la comida").fill("Almuerzo de prueba");
  await page.getByRole("button", { name: "Agregar componente manual" }).click();
  await page.getByLabel("Alimento", { exact: true }).fill("Arroz de prueba");
  await page.getByLabel("Cantidad (g / ml)").fill("200");
  await page.getByText("Valores por 100 g / ml").click();
  await page.getByLabel("kcal / 100", { exact: true }).fill("130");
  await page.getByLabel("Proteína g / 100").fill("3");
  await page.getByLabel("Carbos g / 100").fill("28");
  await page.getByLabel("Grasas g / 100").fill("1");
  await page.getByRole("button", { name: "Confirmar y registrar" }).click();
  await expect(page.locator("dialog")).toHaveCount(0);
}
function syntheticFemmtoPDF() {
  const lines = [
    "ID Altura Edad Genero Fecha / hora",
    "Luca Demo 170 cm 30 Masculino 2026-09-17 10:00",
    "Analisis de Masa muscular",
    "Peso (Kg) 35 44 53 62 71 80",
    "70.2",
    "Masa muscular esqueletica",
    "35.7",
    "Masa de grasa corporal (Kg) 1 5 9 13 17",
    "9.8",
    "IMC",
    "(Kg/m2)",
    "11 15 19 23 27 31",
    "Indice de masa corporal",
    "24.3",
    "PGC (%)",
    "0 7 14 21 28",
    "Porcentaje de grasa corporal",
    "14.05",
  ];
  const stream = lines
    .map(
      (line, i) =>
        `BT /F1 10 Tf 30 ${800 - i * 25} Td (${line.replace(/[\\()]/g, (c) => "\\" + c)}) Tj ET`,
    )
    .join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = pdf.length;
  pdf +=
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets
      .slice(1)
      .map((n) => `${String(n).padStart(10, "0")} 00000 n \n`)
      .join("") +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}
test("conexión recordada se comprueba al entrar y no pide nuevamente el código", async ({
  page,
}) => {
  let checks = 0;
  await page.route("https://fixture.workers.dev/**", async (route) => {
    checks++;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "access-control-allow-origin": "*" },
      body: JSON.stringify({
        ready: true,
        provider: "groq",
        nutritionDatabase: true,
      }),
    });
  });
  await setup(page);
  await navigate(page, "Más");
  await page.getByRole("button", { name: /Análisis de comidas/ }).click();
  await page
    .getByLabel("Dirección del servicio NutriDuo")
    .fill("https://fixture.workers.dev");
  await page
    .getByLabel("Código de conexión NutriDuo")
    .fill("fixture-code-with-at-least-thirty-two-characters");
  await page
    .getByRole("button", { name: "Conectar análisis", exact: true })
    .click();
  await expect(
    page.getByText("Ya estás conectado", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cerrar" }).click();
  const previous = checks;
  await page.getByRole("button", { name: /Análisis de comidas/ }).click();
  await expect(
    page.getByText("Ya estás conectado", { exact: true }),
  ).toBeVisible();
  expect(checks).toBeGreaterThan(previous);
  await expect(page.getByLabel("Código de conexión NutriDuo")).toHaveCount(0);
  await page.getByRole("button", { name: "Cerrar" }).click();
  await page.reload();
  await page.getByRole("button", { name: /Luca Construir/ }).click();
  await page.getByLabel("PIN", { exact: true }).fill("1234");
  await page
    .getByRole("button", { name: "Entrar a mi espacio", exact: true })
    .click();
  await navigate(page, "Más");
  await page.getByRole("button", { name: /Análisis de comidas/ }).click();
  await expect(
    page.getByText("Ya estás conectado", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cerrar" }).click();
  await page.context().setOffline(true);
  await page.getByRole("button", { name: /Análisis de comidas/ }).click();
  await expect(
    page.getByText("Conexión guardada · verificación pendiente", {
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      Boolean(localStorage.getItem("nutriduo-ai-service")),
    ),
  ).toBe(true);
});
test("recordatorios configuran suscripción, preferencias, prueba y desactivación", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const serialized = {
      endpoint: "https://fcm.googleapis.com/fcm/send/fixture-browser",
      keys: { p256dh: "fixture-public-key", auth: "fixture-auth" },
    };
    let active: object | null = null;
    const subscription = {
      toJSON: () => serialized,
      unsubscribe: async () => {
        active = null;
        return true;
      },
    };
    Object.defineProperty(Notification, "requestPermission", {
      value: async () => "granted",
    });
    Object.defineProperty(navigator.serviceWorker, "getRegistration", {
      value: async () => ({
        active: {},
        pushManager: {
          getSubscription: async () => active,
          subscribe: async () => {
            active = subscription;
            return subscription;
          },
        },
      }),
    });
    localStorage.setItem(
      "nutriduo-ai-service",
      JSON.stringify({
        endpoint: "https://fixture.workers.dev",
        accessCode: "fixture-code-at-least-thirty-two-characters",
        nutritionDatabase: true,
      }),
    );
  });
  const requests: string[] = [];
  await page.route("https://fixture.workers.dev/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    requests.push(path);
    const response = path.endsWith("config")
      ? { publicKey: "B".repeat(87) }
      : path.endsWith("test")
        ? { sent: true }
        : path.endsWith("unsubscribe")
          ? { enabled: false }
          : { enabled: true };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(response),
    });
  });
  await setup(page);
  await navigate(page, "Más");
  await page.getByRole("button", { name: /Recordatorios/ }).click();
  await page.getByLabel("Pesaje por la mañana · opcional").uncheck();
  await page
    .getByRole("button", { name: "Activar recordatorios en este celular" })
    .click();
  await expect(
    page.getByRole("button", { name: "Enviar aviso de prueba" }),
  ).toBeVisible();
  expect(requests).toContain("/notifications/subscribe");
  await page.getByRole("button", { name: "Enviar aviso de prueba" }).click();
  await expect(
    page
      .locator("dialog")
      .getByText("Aviso de prueba enviado.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Desactivar en este dispositivo" })
    .click();
  await expect(
    page.getByText("Recordatorios desactivados en este dispositivo.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(requests).toContain("/notifications/unsubscribe");
});
test("menú semanal persiste, comparte compras y registra sólo al confirmar", async ({
  page,
}) => {
  await setup(page);
  await navigate(page, "Comidas");
  await page.getByRole("button", { name: "Menú semanal", exact: true }).click();
  await page.getByRole("button", { name: "Preparar mi menú semanal" }).click();
  await page.getByRole("button", { name: "Lunes", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Avena con leche, banana y maní" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Revisar y registrar esta comida" })
    .first()
    .click();
  await expect(page.locator("dialog")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Confirmar y registrar" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirmar y registrar" }).click();
  await expect(page.locator("dialog")).toHaveCount(0);
  await page
    .locator(".tabs")
    .getByRole("button", { name: "Hoy", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Avena con leche, banana y maní" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Menú semanal", exact: true }).click();
  await page
    .getByRole("button", { name: "Lista de compras", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Compras para siete días · Luca" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /Luca Construir/ }).click();
  await page.getByLabel("PIN", { exact: true }).fill("1234");
  await page
    .getByRole("button", { name: "Entrar a mi espacio", exact: true })
    .click();
  await navigate(page, "Comidas");
  await page.getByRole("button", { name: "Menú semanal", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Generar de nuevo esta semana" }),
  ).toBeVisible();
});
test("PDF Femmto se lee localmente, revisa fecha y conserva unidades y devolución", async ({
  page,
}) => {
  await page.setViewportSize({ width: 430, height: 932 });
  await setup(page);
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "Progreso", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Informe Femmto", exact: true })
    .click();
  await page.getByLabel("Subir PDF de Femmto").setInputFiles({
    name: "informe-generado-hoy.pdf",
    mimeType: "application/pdf",
    buffer: syntheticFemmtoPDF(),
  });
  await expect(page.getByLabel("Fecha de la medición del informe")).toHaveValue(
    "2026-09-17",
  );
  await expect(page.getByLabel("Grasa corporal (%)")).toHaveValue("14.05");
  await expect(
    page.getByRole("button", { name: "Confirmar informe" }),
  ).toBeDisabled();
  await page
    .getByLabel("Revisé el perfil, la fecha y los valores del PDF.")
    .check();
  await page.getByRole("button", { name: "Confirmar informe" }).click();
  await expect(
    page.getByText("Este informe es una referencia inicial", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Balanza", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Músculo esquelético", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false);
  await page.screenshot({
    path: "test-results/balanza-mobile.png",
    fullPage: true,
  });
});
test("guarda salida sin inventar pulso y adopta fuerza en casa", async ({
  page,
}) => {
  await setup(page);
  await navigate(page, "Entreno");
  await page
    .getByRole("button", { name: "Caminata y trote", exact: true })
    .click();
  await page.getByLabel("Distancia (km)").fill("3,2");
  await page.getByLabel("Duración (hh:mm:ss)").fill("00:30:00");
  await page.getByRole("button", { name: "Guardar salida" }).click();
  await expect(page.getByText("6.4 km/h", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Cerrar" }).click();
  await page
    .getByRole("button", { name: "Rutina en casa", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Usar esta rutina de dos días" })
    .click();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Fuerza en casa · 2 días", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Casa A · Cuerpo completo" }),
  ).toBeVisible();
});

test("una actualización pide confirmación y conserva PIN y comidas guardadas", async ({
  page,
}) => {
  let servePreviousWorker = true;
  const root = resolve("dist");
  const server = createServer(async (request, response) => {
    const path = new URL(request.url!, "http://localhost").pathname;
    response.setHeader("Cache-Control", "no-store");
    if (path === "/sw.js" && servePreviousWorker) {
      response.setHeader("Content-Type", "application/javascript");
      response.end(`self.addEventListener('install', () => self.skipWaiting());
        self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));`);
      return;
    }
    const file = resolve(root, "." + (path === "/" ? "/index.html" : path));
    if (!file.startsWith(root + "\\") && !file.startsWith(root + "/")) {
      response.writeHead(404).end();
      return;
    }
    try {
      const mime: Record<string, string> = {
        ".html": "text/html",
        ".js": "application/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".woff2": "font/woff2",
        ".webmanifest": "application/manifest+json",
      };
      response.setHeader(
        "Content-Type",
        mime[extname(file)] ?? "application/octet-stream",
      );
      response.end(await readFile(file));
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Test server unavailable");
  try {
    await page.setViewportSize({ width: 393, height: 851 });
    await setup(page, "Luca", `http://127.0.0.1:${address.port}`);
    await manualMeal(page);
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    servePreviousWorker = false;
    await page.evaluate(async () => {
      await (await navigator.serviceWorker.ready).update();
    });
    const banner = page.getByRole("status", {
      name: "Actualización disponible",
    });
    await expect(banner).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Hoy, Luca" }),
    ).toBeVisible();
    await page.screenshot({ path: "test-results/update-mobile.png" });
    await page
      .getByRole("button", { name: "Actualizar ahora", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Elegí tu perfil" }),
    ).toBeVisible();
    await expect(banner).toHaveCount(0);
    await page.getByRole("button", { name: /Luca Construir/ }).click();
    await page.getByLabel("PIN", { exact: true }).fill("1234");
    await page
      .getByRole("button", { name: "Entrar a mi espacio", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Hoy, Luca" }),
    ).toBeVisible();
    await page
      .locator(".bottom-nav")
      .getByRole("button", { name: "Comidas", exact: true })
      .click();
    await expect(
      page.getByText("Almuerzo de prueba", { exact: true }),
    ).toBeVisible();
    await page
      .locator(".bottom-nav")
      .getByRole("button", { name: "Más", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: /Análisis de comidas/ }),
    ).toBeVisible();
    await page.screenshot({ path: "test-results/more-ai-mobile.png" });
  } finally {
    await page.close();
    await new Promise<void>((done) => server.close(() => done()));
  }
});
test("IA integrada en móvil pide detalles, permite elegir ficha y guarda sólo al confirmar", async ({
  page,
}) => {
  let analyses = 0;
  const posted: Record<string, unknown>[] = [];
  await page.route("https://nutriduo-fixture.workers.dev/**", async (route) => {
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "Content-Type, Authorization",
      "access-control-allow-methods": "GET, POST, OPTIONS",
    };
    if (route.request().method() === "OPTIONS")
      return route.fulfill({ status: 204, headers });
    const path = new URL(route.request().url()).pathname;
    if (path === "/health")
      return route.fulfill({
        headers,
        json: { ready: true, provider: "groq", nutritionDatabase: true },
      });
    if (path === "/nutrition/search")
      return route.fulfill({
        headers,
        json: {
          foods: [
            {
              name: "Rice, cooked (fixture)",
              per100: {
                calories: 130,
                protein: 3,
                carbs: 28,
                fat: 1,
                fiber: 0.4,
              },
              fiberKnown: true,
              micronutrientsPer100: { sodium_mg: 0, iron_mg: 1.5 },
              nutritionReference: {
                source: "usda",
                id: "123",
                description: "Rice, cooked (fixture)",
              },
            },
          ],
        },
      });
    posted.push(route.request().postDataJSON());
    analyses++;
    return route.fulfill({
      headers,
      json:
        analyses === 1
          ? {
              status: "needs_details",
              questions: ["¿Cuánto aceite agregaste?"],
            }
          : {
              status: "ready",
              analysis: {
                meal_name: "Arroz con aceite",
                confidence: 0.6,
                foods: [
                  {
                    name: "Arroz cocido",
                    estimated_grams: 150,
                    calories: 195,
                    protein_g: 4.5,
                    carbs_g: 42,
                    fat_g: 1.5,
                    confidence: 0.7,
                    cooking: "hervido",
                    database_query: "rice cooked",
                  },
                  {
                    name: "Aceite",
                    estimated_grams: 5,
                    calories: 45,
                    protein_g: 0,
                    carbs_g: 0,
                    fat_g: 5,
                    confidence: 0.6,
                  },
                ],
                questions: [],
              },
            },
    });
  });
  await setup(page);
  await page.setViewportSize({ width: 393, height: 852 });
  await page
    .getByRole("button", { name: "Registrar comida", exact: true })
    .last()
    .click();
  await page
    .getByRole("button", { name: "Analizar comida", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Analizar foto y descripción" }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Configurar conexión", exact: true })
    .click();
  await page
    .getByLabel("Dirección del servicio NutriDuo")
    .fill("https://nutriduo-fixture.workers.dev");
  await page
    .getByLabel("Código de conexión NutriDuo")
    .fill("fixture-access-code-at-least-32-characters");
  await page
    .getByRole("button", { name: "Conectar análisis", exact: true })
    .click();
  await expect(page.getByText(/Groq conectado/)).toBeVisible();
  await page
    .getByLabel("Elegir foto para analizar")
    .setInputFiles("public/icon-192.png");
  await expect(page.getByAltText("Plato para analizar")).toBeVisible();
  await page
    .getByLabel("Descripción, cantidades, cocción y marcas")
    .fill("Arroz marca Fixture, 150 g cocidos, hervido, con aceite");
  await page
    .getByRole("button", { name: "Analizar foto y descripción" })
    .click();
  await expect(
    page.getByText("¿Cuánto aceite agregaste?", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Descripción, cantidades, cocción y marcas")
    .fill("Arroz marca Fixture, 150 g cocidos, hervido; 5 g de aceite");
  await page
    .getByRole("button", { name: "Analizar foto y descripción" })
    .click();
  await page
    .getByRole("button", { name: "Revisar componentes", exact: true })
    .click();
  await expect(
    page.getByLabel("Alimento", { exact: true }).first(),
  ).toHaveValue("Arroz cocido");
  await expect(page.getByLabel("Método de cocción").first()).toHaveValue(
    "hervido",
  );
  await page
    .getByText("Buscar una ficha nutricional", { exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Buscar en USDA", exact: true })
    .click();
  await page.getByRole("button", { name: /Rice, cooked \(fixture\)/ }).click();
  await page
    .locator("dialog .micronutrients")
    .last()
    .locator("summary")
    .click();
  await expect(page.locator("dialog .micronutrients").last()).toContainText(
    "Parcial: 1 de 2 componentes",
  );
  await expect(page.locator("dialog .micronutrients").last()).toContainText(
    "2,25 mg",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/meal-ai-review-mobile.png",
    fullPage: true,
  });
  await expect(page.locator(".ring-text strong")).toHaveText("0");
  expect(posted).toHaveLength(2);
  expect(Object.keys(posted[1]).sort()).toEqual(["description", "photo"]);
  expect(posted[1].description).toContain("marca Fixture");
  await page
    .getByRole("button", { name: "Confirmar y registrar", exact: true })
    .click();
  await expect(page.locator(".ring-text strong")).toHaveText("240");
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "Comidas", exact: true })
    .click();
  await page.locator(".meal-detail .micronutrients summary").click();
  await expect(page.locator(".meal-detail .micronutrients")).toContainText(
    "2,25 mg",
  );
});

test("cuota IA agotada conserva foto y descripción y mantiene la carga manual", async ({
  page,
}) => {
  let calls = 0;
  await page.route("https://nutriduo-fixture.workers.dev/**", (route) => {
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "Content-Type, Authorization",
      "access-control-allow-methods": "GET, POST, OPTIONS",
    };
    if (route.request().method() === "OPTIONS")
      return route.fulfill({ status: 204, headers });
    if (new URL(route.request().url()).pathname === "/health")
      return route.fulfill({
        headers,
        json: { ready: true, provider: "groq", nutritionDatabase: false },
      });
    calls++;
    return route.fulfill({
      status: 429,
      headers,
      json: { error: "La cuota gratuita de IA está agotada temporalmente." },
    });
  });
  await setup(page);
  await page
    .getByRole("button", { name: "Registrar comida", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Analizar comida", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Configurar conexión", exact: true })
    .click();
  await page
    .getByLabel("Dirección del servicio NutriDuo")
    .fill("https://nutriduo-fixture.workers.dev");
  await page
    .getByLabel("Código de conexión NutriDuo")
    .fill("fixture-access-code-at-least-32-characters");
  await page
    .getByRole("button", { name: "Conectar análisis", exact: true })
    .click();
  await expect(page.getByText(/Groq conectado/)).toBeVisible();
  await page
    .getByLabel("Elegir foto para analizar")
    .setInputFiles("public/icon-192.png");
  await expect(page.getByAltText("Plato para analizar")).toBeVisible();
  await page
    .getByLabel("Descripción, cantidades, cocción y marcas")
    .fill("Comida de prueba con descripción");
  await page
    .getByRole("button", { name: "Analizar foto y descripción" })
    .click();
  await expect(page.getByRole("alert")).toContainText("cuota gratuita");
  await expect(
    page.getByLabel("Descripción, cantidades, cocción y marcas"),
  ).toHaveValue("Comida de prueba con descripción");
  await expect(page.getByAltText("Plato para analizar")).toBeVisible();
  expect(calls).toBe(1);
  await page.goBack();
  await expect(page.locator("dialog .tabs button.active")).toHaveText(
    "Componentes",
  );
  await page.getByRole("button", { name: "Agregar componente manual" }).click();
  await expect(page.getByLabel("Alimento", { exact: true })).toBeVisible();
});
test("perfil, comida, edición de gramos, peso, PIN y aislamiento", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await setup(page);
  await manualMeal(page);
  await expect(page.locator(".ring-text strong")).toHaveText("260");
  await navigate(page, "Comidas");
  await page.getByRole("button", { name: "Editar gramos" }).click();
  await page.getByLabel("Cantidad (g / ml)").fill("300");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await navigate(page, "Inicio");
  await expect(page.locator(".ring-text strong")).toHaveText("390");
  await navigate(page, "Progreso");
  await page
    .getByRole("button", { name: "Registrar peso", exact: true })
    .click();
  await page.getByLabel("Peso (kg)", { exact: true }).fill("61.2");
  await page.getByRole("button", { name: "Guardar pesaje" }).click();
  await expect(page.locator(".metric").first()).toContainText("61.2");
  await page
    .getByRole("button", { name: "Cambiar perfil", exact: true })
    .last()
    .click();
  await setup(page, "Ari");
  await expect(page.locator(".ring-text strong")).toHaveText("0");
  await navigate(page, "Comidas");
  await expect(page.getByText("Almuerzo de prueba")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Cambiar perfil", exact: true })
    .last()
    .click();
  await page.getByRole("button", { name: /Luca Construir/ }).click();
  await page.getByLabel("PIN", { exact: true }).fill("0000");
  await page.getByRole("button", { name: "Entrar a mi espacio" }).click();
  await expect(page.getByRole("alert")).toContainText("no coincide");
  await page.getByLabel("PIN", { exact: true }).fill("1234");
  await page.getByRole("button", { name: "Entrar a mi espacio" }).click();
  await expect(page.locator(".ring-text strong")).toHaveText("390");
  expect(errors).toEqual([]);
});
test("producto, corrección, IA validada y receta", async ({ page }) => {
  await page.route("**/api/v2/product/**", (r) =>
    r.fulfill({
      json: {
        status: 1,
        product: {
          product_name: "Producto de prueba",
          brands: "Fixture",
          serving_quantity: 100,
          nutriments: {
            "energy-kcal_100g": 200,
            proteins_100g: 10,
            carbohydrates_100g: 20,
            fat_100g: 8,
            fiber_100g: 2,
          },
        },
      },
    }),
  );
  await setup(page);
  await page
    .getByRole("button", { name: "Registrar comida", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Código de barras", exact: true })
    .click();
  await page
    .getByLabel("Código de barras", { exact: true })
    .fill("7790000000001");
  await page
    .getByRole("button", { name: "Buscar producto", exact: true })
    .click();
  await page.getByLabel("Cantidad (g / ml)").fill("150");
  await page.getByRole("button", { name: "Confirmar y registrar" }).click();
  await expect(page.locator(".ring-text strong")).toHaveText("300");
  await page
    .getByRole("button", { name: "Registrar comida", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "IA externa", exact: true }).click();
  await page.getByLabel("Pegar análisis JSON").fill('{"meal_name":"mal"}');
  await page.getByRole("button", { name: "Validar y revisar" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByLabel("Pegar análisis JSON").fill(
    JSON.stringify({
      meal_name: "IA de prueba",
      confidence: 0.5,
      foods: [
        {
          name: "Pollo de prueba",
          estimated_grams: 100,
          calories: 170,
          protein_g: 25,
          carbs_g: 0,
          fat_g: 7,
          confidence: 0.5,
        },
      ],
      questions: ["¿Tiene aceite?"],
    }),
  );
  await page.getByRole("button", { name: "Validar y revisar" }).click();
  await expect(page.getByText("¿Tiene aceite?", { exact: true })).toBeVisible();
  await expect(page.locator(".ring-text strong")).toHaveText("300");
  await page.getByRole("button", { name: "Confirmar y registrar" }).click();
  await expect(page.locator(".ring-text strong")).toHaveText("470");
  await navigate(page, "Comidas");
  await page.getByRole("button", { name: "Recetas", exact: true }).click();
  await page.getByRole("button", { name: "Crear receta", exact: true }).click();
  await page.getByLabel("Nombre de la receta").fill("Mi receta");
  await page.getByRole("button", { name: "Agregar componente manual" }).click();
  await page.getByLabel("Alimento", { exact: true }).fill("Ingrediente");
  await page.getByText("Valores por 100 g / ml").click();
  await page.getByLabel("kcal / 100", { exact: true }).fill("200");
  await page.getByLabel("Porciones de la receta").fill("2");
  await page
    .getByRole("button", { name: "Guardar receta", exact: true })
    .click();
  await expect(
    page.getByText("2 porciones · ≈ 100 kcal por porción"),
  ).toBeVisible();
});
test("backup roundtrip, XLSX y shell offline", async ({ page, context }) => {
  await setup(page);
  await manualMeal(page);
  await navigate(page, "Más");
  await page.getByRole("button", { name: /Tus datos van con vos/ }).click();
  const d = page.waitForEvent("download");
  await page.getByRole("button", { name: /Backup completo JSON/ }).click();
  const download = await d;
  const path = await download.path();
  expect(path).toBeTruthy();
  await page.getByLabel("Elegir archivo JSON").setInputFiles(path!);
  await expect(
    page.getByRole("heading", { name: "Revisar restauración" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(
    page.getByText("Backup restaurado", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Tus datos van con vos/ }).click();
  const x = page.waitForEvent("download");
  await page.getByRole("button", { name: /Exportar Excel/ }).click();
  expect((await x).suggestedFilename()).toMatch(/\.xlsx$/);
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);
  await page.reload();
  await page.getByRole("button", { name: /Luca Construir/ }).click();
  await page.getByLabel("PIN", { exact: true }).fill("1234");
  await page.getByRole("button", { name: "Entrar a mi espacio" }).click();
  await expect(page.locator(".ring-text strong")).toHaveText("260");
  await expect(page.getByText("Modo offline")).toBeVisible();
});
test("mobile layout, entrenamiento y screenshots", async ({ page }) => {
  await setup(page);
  await manualMeal(page);
  await navigate(page, "Entreno");
  await page.getByRole("button", { name: "Empezar sesión" }).click();
  await page.getByLabel("kg", { exact: true }).first().fill("20");
  await page.getByRole("button", { name: "Finalizar y guardar" }).click();
  await expect(
    page.getByText(/Día A · Base y empuje · 15 series/),
  ).toBeVisible();
  await navigate(page, "Inicio");
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 393, height: 852 });
  await expect(page.locator(".bottom-nav")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/dashboard-mobile.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Registrar comida", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { name: "Registrar comida" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("medidas, fotos comprimidas y respaldo con imágenes", async ({ page }) => {
  await setup(page);
  await navigate(page, "Progreso");
  await page.getByRole("button", { name: "Medidas", exact: true }).click();
  await page
    .getByRole("button", { name: "Registrar medida", exact: true })
    .click();
  await page.getByLabel("Centímetros").fill("78.5");
  await page.getByRole("button", { name: "Guardar registro" }).click();
  await expect(
    page.getByText("78.5 cm", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fotos", exact: true }).click();
  await page.getByRole("button", { name: "Agregar foto", exact: true }).click();
  await page
    .getByLabel("Elegir foto de progreso")
    .setInputFiles("public/icon-192.png");
  await expect(page.getByAltText("Vista previa")).toBeVisible();
  await page.getByRole("button", { name: "Guardar registro" }).click();
  await expect(page.locator(".photo-tile")).toHaveCount(1);
  await navigate(page, "Más");
  await page.getByRole("button", { name: /Tus datos van con vos/ }).click();
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: /Backup completo JSON/ }).click();
  const path = await (await event).path();
  const backup = JSON.parse(await readFile(path!, "utf8"));
  expect(backup.data.photos[0].image).toMatch(/^data:image\/jpeg/);
  expect(backup.data.photos[0].thumbnail).toMatch(/^data:image\/jpeg/);
  expect(backup.data.measurements[0].cm).toBe(78.5);
  expect(backup.profile.pinHash).toBeUndefined();
  backup.data.weights[0].profileId = "ari";
  await page.getByLabel("Elegir archivo JSON").setInputFiles({
    name: "invalido.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(page.locator('dialog [role="status"]')).toContainText(
    "perfil mezclado",
  );
  await expect(
    page.getByRole("heading", { name: "Revisar restauración" }),
  ).toHaveCount(0);
});

test("herramienta de inicio no guarda y valida argumentos", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const registry: Record<
      string,
      {
        execute: (input: unknown) => unknown;
        inputSchema: unknown;
        annotations: unknown;
      }
    > = {};
    Object.defineProperty(document, "modelContext", {
      value: {
        registerTool: (
          tool: {
            name: string;
            execute: (input: unknown) => unknown;
            inputSchema: unknown;
            annotations: unknown;
          },
          options: { signal: AbortSignal },
        ) => {
          registry[tool.name] = tool;
          options.signal.addEventListener(
            "abort",
            () => delete registry[tool.name],
          );
        },
      },
    });
    Object.assign(window, { __testTools: registry });
  });
  await setup(page);
  const result = await page.evaluate(async () => {
    const tool = (
      window as unknown as {
        __testTools: Record<string, { execute: (input: unknown) => unknown }>;
      }
    ).__testTools.nutriduo_start_meal;
    let rejected = false;
    try {
      await tool.execute({ save: true });
    } catch {
      rejected = true;
    }
    return { rejected, result: await tool.execute({}) };
  });
  expect(result.rejected).toBe(true);
  expect(result.result).toEqual({ opened: true, profile: "Luca" });
  await expect(
    page.getByRole("heading", { name: "Registrar comida", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(page.locator(".ring-text strong")).toHaveText("0");
});

test("tema oscuro persistente en móvil y regreso a claro", async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 393, height: 852 });
  await page.getByRole("button", { name: "Oscuro", exact: true }).click();
  await expect(page.locator(".app-shell")).toHaveClass(/dark/);
  await expect(
    page.getByRole("button", { name: "Oscuro", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({
    path: "test-results/dashboard-dark-mobile.png",
    fullPage: true,
  });
  await page.reload();
  await page.getByRole("button", { name: /Luca Construir/ }).click();
  await page.getByLabel("PIN", { exact: true }).fill("1234");
  await page.getByRole("button", { name: "Entrar a mi espacio" }).click();
  await expect(page.locator(".app-shell")).toHaveClass(/dark/);
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "Más", exact: true })
    .click();
  await page.getByRole("button", { name: /Tu perfil y objetivos/ }).click();
  await expect(page.locator("dialog")).toHaveCSS(
    "background-color",
    "rgb(24, 33, 44)",
  );
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.getByRole("button", { name: "Claro", exact: true }).click();
  await expect(page.locator(".app-shell")).not.toHaveClass(/dark/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("Atrás recorre secciones, pestañas y fecha sin salir ni restaurar una sesión", async ({
  page,
}) => {
  await setup(page);
  await navigate(page, "Comidas");
  await page.getByRole("button", { name: "Recetas", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Crear receta", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(page.locator(".tabs button.active")).toHaveText("Hoy");
  await expect(
    page.getByRole("heading", { name: "Comidas", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Hoy, Luca", exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: "Comidas", exact: true }),
  ).toBeVisible();
  const original = await page.getByLabel("Fecha de los registros").inputValue();
  await page.getByRole("button", { name: "Día anterior", exact: true }).click();
  await expect(page.getByLabel("Fecha de los registros")).not.toHaveValue(
    original,
  );
  await page.goBack();
  await expect(page.getByLabel("Fecha de los registros")).toHaveValue(original);
  await page.getByRole("button", { name: "Volver", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Hoy, Luca", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Elegí tu perfil", exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: "Elegí tu perfil", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".app-shell")).toHaveCount(0);
});

test("Atrás cierra primero formularios y un cierre normal no deja pasos vacíos", async ({
  page,
}) => {
  await setup(page);
  await page.setViewportSize({ width: 393, height: 852 });
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "Más", exact: true })
    .click();
  await page.getByRole("button", { name: /Tu perfil y objetivos/ }).click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("heading", { name: "Tu perfil y objetivos", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(page.locator("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Ajustes", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Tu perfil y objetivos/ }).click();
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(page.locator("dialog")).toHaveCount(0);
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Hoy, Luca", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Registrar comida", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "IA externa", exact: true }).click();
  await page.goBack();
  await expect(page.locator("dialog .tabs button.active")).toContainText(
    "Componentes",
  );
  await page.goBack();
  await expect(page.locator("dialog")).toHaveCount(0);
  await expect(page.locator(".ring-text strong")).toHaveText("0");
});

test("Atrás en confirmación de backup vuelve a la ventana anterior sin restaurar", async ({
  page,
}) => {
  await setup(page);
  await navigate(page, "Más");
  await page.getByRole("button", { name: /Tus datos van con vos/ }).click();
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: /Backup completo JSON/ }).click();
  const path = await (await event).path();
  await page.getByLabel("Elegir archivo JSON").setInputFiles(path!);
  await expect(page.locator("dialog")).toHaveCount(2);
  await page.goBack();
  await expect(page.locator("dialog")).toHaveCount(1);
  await expect(page.getByLabel("Elegir archivo JSON")).toBeVisible();
  await page.goBack();
  await expect(page.locator("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Ajustes", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Hoy, Luca", exact: true }),
  ).toBeVisible();
});

test("Atrás durante selección y onboarding regresa al paso anterior", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Luca Construir/ }).click();
  await expect(page.getByLabel("Crear PIN", { exact: true })).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Elegí tu perfil", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Luca Construir/ }).click();
  await page.getByLabel("Crear PIN", { exact: true }).fill("1234");
  await page.getByLabel("Repetir PIN").fill("1234");
  await page.getByRole("button", { name: "Crear mi PIN" }).click();
  await expect(page.getByLabel("Peso actual (kg)")).toBeVisible();
  await page.goBack();
  await expect(page.getByLabel("PIN", { exact: true })).toBeVisible();
  await expect(page.getByLabel("PIN", { exact: true })).toHaveValue("");
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Elegí tu perfil", exact: true }),
  ).toBeVisible();
});
