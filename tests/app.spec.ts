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
  await page.getByLabel("Cantidad (g)").fill("200");
  await page
    .locator(".ingredient summary")
    .filter({ hasText: "Valores por 100 g" })
    .click();
  await page.getByLabel("kcal / 100", { exact: true }).fill("130");
  await page.getByLabel("Proteína g / 100").fill("3");
  await page.getByLabel("Carbos g / 100").fill("28");
  await page.getByLabel("Grasas g / 100").fill("1");
  await page.getByRole("button", { name: "Confirmar y registrar" }).click();
  await expect(page.locator("dialog")).toHaveCount(0);
}

for (const name of ["Luca", "Ari"]) {
  test(`${name}: compañero 2D, pausa persistente y diseño móvil`, async ({
    page,
  }) => {
    const errors: string[] = [];
    const models: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (/\.glb(?:\?|$)|renderer-[\w-]+\.js/.test(request.url()))
        models.push(request.url());
    });
    await page.setViewportSize({ width: 412, height: 915 });
    await page.clock.setFixedTime(new Date(new Date().setHours(12, 0, 0, 0)));
    await setup(page, name);
    const character = "tu bulldog";
    const companion = page.getByRole("region", {
      name: "Tu compañero: bulldog",
    });
    await expect(companion.locator(".cartoon-character")).toHaveCount(1);
    await expect(companion.locator("canvas")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: `Jugar con ${character}` }),
    ).toBeEnabled();
    if (name === "Luca") {
      // A brand-new profile must have more personality than waving/looking.
      await expect(companion.locator(".companion-art")).toHaveAttribute(
        "data-motion",
        "scratch",
        { timeout: 15000 },
      );
      await page.getByRole("button", { name: "Jugar con tu bulldog" }).click();
      await expect(companion.locator(".companion-art")).toHaveAttribute(
        "data-motion",
        "look",
        { timeout: 10000 },
      );
    }
    await page
      .getByRole("button", { name: `Pausar movimiento de ${character}` })
      .click();
    await expect(
      page.getByRole("button", { name: `Activar movimiento de ${character}` }),
    ).toHaveAttribute("aria-pressed", "true");
    const still = await companion.locator(".cartoon-character").screenshot();
    await page.screenshot({
      path: test.info().outputPath(`${name}-companion.png`),
    });
    await page.waitForTimeout(250);
    expect(await companion.locator(".cartoon-character").screenshot()).toEqual(
      still,
    );
    for (const width of [360, 393, 412, 430]) {
      await page.setViewportSize({ width, height: 915 });
      for (let theme = 0; theme < 2; theme++) {
        await page.getByRole("switch", { name: "Modo oscuro" }).click();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        const stage = await companion.locator(".companion-stage").boundingBox();
        expect(stage?.height).toBe(110);
        expect(stage?.width).toBe(94);
        const drawing = await companion
          .locator(".cartoon-character")
          .boundingBox();
        expect(drawing!.height).toBeLessThanOrEqual(stage!.height);
        const body = await companion.locator(".cartoon-body").boundingBox();
        expect(body!.y).toBeGreaterThanOrEqual(stage!.y);
        expect(body!.y + body!.height).toBeLessThanOrEqual(
          stage!.y + stage!.height,
        );
      }
    }
    await page.reload();
    await page
      .getByRole("button", {
        name: new RegExp(name + " Construir|" + name + " Sentirte"),
      })
      .click();
    await page.getByLabel("PIN", { exact: true }).fill("1234");
    await page
      .getByRole("button", { name: "Entrar a mi espacio", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: `Activar movimiento de ${character}` }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(companion.locator(".cartoon-character")).toHaveCount(1);
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          await navigator.serviceWorker.ready;
          return !!navigator.serviceWorker.controller;
        }),
      )
      .toBe(true);
    await page.context().setOffline(true);
    await page.reload();
    await page
      .getByRole("button", {
        name: new RegExp(name + " Construir|" + name + " Sentirte"),
      })
      .click();
    await page.getByLabel("PIN", { exact: true }).fill("1234");
    await page
      .getByRole("button", { name: "Entrar a mi espacio", exact: true })
      .click();
    await expect(companion.locator(".cartoon-character")).toHaveCount(1);
    await page
      .getByRole("button", { name: `Activar movimiento de ${character}` })
      .click();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(
      page.getByRole("button", { name: "Movimiento reducido", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: `Jugar con ${character}` }),
    ).toBeDisabled();
    await expect(companion.locator(".companion-art")).toHaveAttribute(
      "data-motion",
      "idle",
    );
    const reduced = await companion.locator(".cartoon-character").screenshot();
    await page.waitForTimeout(250);
    expect(await companion.locator(".cartoon-character").screenshot()).toEqual(
      reduced,
    );
    await page
      .getByRole("button", { name: "Registrar una comida", exact: true })
      .click();
    await expect(page.getByLabel("Nombre de la comida")).toBeVisible();
    expect(errors).toEqual([]);
    expect(models).toEqual([]);
  });
}

test("agua suma al instante y conserva el total por fecha después de volver a entrar", async ({
  page,
}) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await setup(page);
  await page.getByRole("button", { name: "250 ml", exact: true }).click();
  await expect(page.locator(".water-number")).toContainText("0,25");
  await page.getByRole("button", { name: "500 ml", exact: true }).click();
  await expect(page.locator(".water-number")).toContainText("0,75");
  await expect(page.getByText("750 ml registrados en este día.")).toBeVisible();
  await page.getByRole("button", { name: "Día anterior", exact: true }).click();
  await expect(page.locator(".water-glasses")).toHaveAttribute(
    "aria-label",
    /^0 de /,
  );
  await page
    .getByRole("button", { name: "Día siguiente", exact: true })
    .click();
  await expect(page.locator(".water-number")).toContainText("0,75");
  await page.reload();
  await page.getByRole("button", { name: /Luca Construir/ }).click();
  await page.getByLabel("PIN", { exact: true }).fill("1234");
  await page
    .getByRole("button", { name: "Entrar a mi espacio", exact: true })
    .click();
  await expect(page.locator(".water-number")).toContainText("0,75");
});

test("controles y tarjetas caben en celular y el selector de platos respeta el tema y volver", async ({
  page,
}) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await setup(page);
  for (const width of [360, 412, 430, 1280]) {
    await page.setViewportSize({ width, height: 915 });
    for (const dark of [false, true]) {
      if (
        (await page
          .getByRole("switch", { name: "Modo oscuro" })
          .getAttribute("aria-checked")) !== String(dark)
      )
        await page.getByRole("switch", { name: "Modo oscuro" }).click();
      const geometry = await page.locator(".duo-switch").evaluate((button) => {
        const track = button.getBoundingClientRect();
        const knob = button
          .querySelector(".duo-switch-knob")!
          .getBoundingClientRect();
        const buddy = button
          .querySelector(".duo-switch-buddy svg")!
          .getBoundingClientRect();
        return {
          centerOffset: Math.abs(
            track.y + track.height / 2 - knob.y - knob.height / 2,
          ),
          left: knob.left - track.left,
          right: track.right - knob.right,
          buddyTop: buddy.top,
          viewport: innerWidth,
          pageWidth: document.documentElement.scrollWidth,
        };
      });
      expect(geometry.centerOffset).toBeLessThan(1);
      expect(dark ? geometry.right : geometry.left).toBeCloseTo(5, 0);
      expect(geometry.buddyTop).toBeGreaterThanOrEqual(0);
      expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewport);
    }
  }
  await page.setViewportSize({ width: 412, height: 915 });
  const insets = await page
    .locator(".suggestion > div, .coach-note > div")
    .evaluateAll((contents) =>
      contents.map((content) => {
        const inner = content.getBoundingClientRect(),
          outer = content.parentElement!.getBoundingClientRect();
        return {
          left: inner.left - outer.left,
          right: outer.right - inner.right,
        };
      }),
    );
  for (const inset of insets) {
    expect(inset.left).toBeGreaterThanOrEqual(18);
    expect(inset.right).toBeGreaterThanOrEqual(18);
  }
  await page.screenshot({
    path: "test-results/mobile-spacing-dark.png",
    fullPage: true,
  });
  await page.getByRole("switch", { name: "Modo oscuro" }).click();
  await page.screenshot({
    path: "test-results/mobile-spacing-light.png",
    fullPage: true,
  });
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "Comidas", exact: true })
    .click();
  await page.getByRole("button", { name: "Menú semanal", exact: true }).click();
  await page.getByRole("button", { name: "Preparar mi menú semanal" }).click();
  const trigger = page.getByRole("button", {
    name: "Cambiar plato de Desayuno",
    exact: true,
  });
  const previous = await trigger.innerText();
  await trigger.click();
  await expect(
    page.getByRole("dialog", { name: "Cambiar plato de Desayuno" }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/meal-choice-mobile.png" });
  await page.goBack();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toHaveText(previous);
  await trigger.click();
  const alternative = page
    .getByRole("dialog")
    .locator('.choice-option[aria-pressed="false"]')
    .first();
  const selected = await alternative.innerText();
  await alternative.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(trigger).toHaveText(selected);
  await expect(page.locator(".record-grid .card h3").first()).toHaveText(
    selected,
  );
});
async function pickCentered(page: Page, label: string, option: string) {
  const trigger = page.getByRole("button", { name: label, exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: label, exact: true });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  const viewport = page.viewportSize()!;
  expect(Math.abs(box!.x + box!.width / 2 - viewport.width / 2)).toBeLessThan(
    2,
  );
  expect(Math.abs(box!.y + box!.height / 2 - viewport.height / 2)).toBeLessThan(
    2,
  );
  await dialog.getByRole("button", { name: option, exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toHaveText(option);
  await expect(page.locator("select")).toHaveCount(0);
}

test("selectores centrados conservan valores y formularios en comidas, entreno, balanza y perfil", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 412, height: 915 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await setup(page);
  await page
    .getByRole("button", { name: "Registrar comida", exact: true })
    .last()
    .click();
  await page
    .getByLabel("Nombre de la comida")
    .fill("Borrador que debe conservarse");
  await pickCentered(page, "Momento", "Cena");
  await page.getByRole("button", { name: "Agregar componente manual" }).click();
  await page
    .locator(".ingredient summary")
    .filter({ hasText: "Valores por 100 g" })
    .click();
  await pickCentered(page, "Procedencia", "Etiqueta");
  await page.getByRole("button", { name: "Momento", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Momento", exact: true })
    .getByRole("button", { name: "Cerrar", exact: true })
    .click();
  await expect(page.getByLabel("Nombre de la comida")).toHaveValue(
    "Borrador que debe conservarse",
  );
  await expect(
    page.getByRole("button", { name: "Momento", exact: true }),
  ).toHaveText("Cena");
  await page.getByRole("button", { name: "Momento", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(page.getByLabel("Nombre de la comida")).toHaveValue(
    "Borrador que debe conservarse",
  );
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "Entreno", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Caminata y trote", exact: true })
    .click();
  await pickCentered(page, "Tipo de salida", "Carrera");
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "Progreso", exact: true })
    .click();
  await page.getByRole("button", { name: "Balanza", exact: true }).click();
  await page
    .getByRole("button", { name: "Registrar datos de la balanza", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Agregar dato de la balanza" })
    .click();
  await page.getByRole("button", { name: "Dato", exact: true }).click();
  await page.setViewportSize({ width: 740, height: 360 });
  const longList = page.getByRole("dialog", { name: "Dato", exact: true });
  await expect(longList).toBeVisible();
  const dimensions = await longList.boundingBox();
  expect(dimensions!.height).toBeLessThanOrEqual(288);
  expect(Math.abs(dimensions!.y + dimensions!.height / 2 - 180)).toBeLessThan(
    2,
  );
  await longList
    .getByRole("button", { name: "Edad metabólica", exact: true })
    .click();
  await page.setViewportSize({ width: 412, height: 915 });
  await pickCentered(page, "Unidad", "años");
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.getByRole("button", { name: "Medidas", exact: true }).click();
  await page
    .getByRole("button", { name: "Registrar medida", exact: true })
    .click();
  await pickCentered(page, "Medida", "Cadera");
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.getByRole("button", { name: "Fotos", exact: true }).click();
  await pickCentered(page, "Vista", "Espalda");
  await page.getByRole("button", { name: "Agregar foto", exact: true }).click();
  await pickCentered(page, "Vista de la foto", "Frente");
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "Más", exact: true })
    .click();
  await page.getByRole("button", { name: /Tu perfil y objetivos/ }).click();
  await pickCentered(page, "Actividad", "Moderada");
  await pickCentered(
    page,
    "Dirección del objetivo",
    "Reducción de grasa / definición",
  );
  await page.screenshot({ path: "test-results/profile-choices-mobile.png" });
});

test("actividad inicial y check-in usan opciones centradas con tema claro y oscuro", async ({
  page,
}) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("switch", { name: "Modo oscuro" }).click();
  await page.getByRole("button", { name: /Luca Construir/ }).click();
  await page.getByLabel("Crear PIN", { exact: true }).fill("1234");
  await page.getByLabel("Repetir PIN").fill("1234");
  await page.getByRole("button", { name: "Crear mi PIN" }).click();
  await pickCentered(page, "Actividad actual", "Moderada · 3–4 días");
  await page
    .getByRole("button", { name: "Actividad actual", exact: true })
    .click();
  await page.screenshot({ path: "test-results/onboarding-choice-dark.png" });
  await page
    .getByRole("dialog", { name: "Actividad actual", exact: true })
    .getByRole("button", { name: "Cerrar" })
    .click();
  await page.getByLabel("Peso actual (kg)").fill("60");
  await page.getByLabel("Altura (cm)").fill("169");
  await page.getByLabel("Fecha de nacimiento").fill("2000-06-15");
  await page.getByRole("button", { name: "Ver propuesta" }).click();
  await page.getByRole("button", { name: "Confirmar y empezar" }).click();
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "Progreso", exact: true })
    .click();
  await page.getByRole("button", { name: "Mi análisis", exact: true }).click();
  await page.getByRole("button", { name: "Hacer mi primer check-in" }).click();
  await pickCentered(page, "Hambre (1 poca · 5 mucha)", "4");
  await pickCentered(page, "Energía (1 baja · 5 alta)", "2");
  await pickCentered(page, "Sueño (1 malo · 5 bueno)", "5");
  await pickCentered(page, "Rendimiento (1 bajo · 5 alto)", "4");
  await pickCentered(
    page,
    "Dificultad con la alimentación (1 poca · 5 mucha)",
    "1",
  );
  await pickCentered(
    page,
    "Cumplimiento del entrenamiento (1 bajo · 5 alto)",
    "5",
  );
  await page
    .getByRole("button", { name: "Guardar registro", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText(/energía 2\/5 · descanso 5\/5/)).toBeVisible();
});

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

for (const stalled of [false, true]) {
  test(`una actualización ${stalled ? "silenciosa permite reintentar" : "pide confirmación"} y conserva PIN y comidas guardadas`, async ({
    page,
  }) => {
    let servePreviousWorker = true;
    test.setTimeout(90000);
    let serveSilentWorker = stalled;
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
      if (path === "/sw.js" && serveSilentWorker) {
        response.setHeader("Content-Type", "application/javascript");
        response.end(`self.addEventListener('install', () => {});
        self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));`);
        return;
      }
      if (path === "/sw.js") {
        // Exercise the real browser worker lifecycle without making this
        // activation test depend on downloading the entire offline bundle.
        // The separate offline/backup tests use the production Workbox worker.
        response.setHeader("Content-Type", "application/javascript");
        response.end(`self.addEventListener('message', event => {
          if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
        });
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
      await expect(banner).toBeVisible({ timeout: 15000 });
      await expect(
        page.getByRole("heading", { name: "Hoy, Luca" }),
      ).toBeVisible();
      await page.screenshot({ path: "test-results/update-mobile.png" });
      await page
        .getByRole("button", { name: "Actualizar ahora", exact: true })
        .click();
      if (stalled) {
        await expect(banner.getByText(/tardó más de lo esperado/)).toBeVisible({
          timeout: 16000,
        });
        await expect(
          page.getByRole("heading", { name: "Hoy, Luca" }),
        ).toBeVisible();
        await expect(
          page.getByRole("button", {
            name: "Reintentar actualización",
            exact: true,
          }),
        ).toBeEnabled();
        serveSilentWorker = false;
        await page.evaluate(async () => {
          await (await navigator.serviceWorker.ready).update();
        });
        // Wait for the replacement worker, rather than retrying the silent one.
        await expect
          .poll(
            () =>
              page.evaluate(async () => {
                const registration = await navigator.serviceWorker.ready;
                return (
                  !!registration.waiting?.scriptURL && !registration.installing
                );
              }),
            { timeout: 20000 },
          )
          .toBe(true);
        await page
          .getByRole("button", {
            name: "Reintentar actualización",
            exact: true,
          })
          .click();
      }
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
}
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
    page.getByRole("button", { name: "Analizar fotos y descripción" }),
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
  await expect(page.getByText(/IA conectada/)).toBeVisible();
  const images = await page.evaluate(() =>
    ["#ff0000", "#00ff00", "#0000ff", "#ffff00", "#ff00ff"].map((color) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 192;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 192, 192);
      return canvas.toDataURL("image/png").split(",")[1];
    }),
  );
  const files = images.map((image, i) => ({
    name: `foto-${i + 1}.png`,
    mimeType: "image/png",
    buffer: Buffer.from(image, "base64"),
  }));
  await page
    .getByLabel("Elegir foto para analizar")
    .setInputFiles(files.slice(0, 2));
  await expect(page.locator(".meal-photo-card")).toHaveCount(2);
  const firstPhoto = await page
    .getByAltText("Plato para analizar", { exact: true })
    .getAttribute("src");
  await page
    .getByLabel("Elegir foto para analizar")
    .setInputFiles(files.slice(2, 4));
  await expect(page.locator(".meal-photo-card")).toHaveCount(4);
  await page.getByLabel("Sacar foto para analizar").setInputFiles(files[4]);
  await expect(page.locator(".meal-photo-card")).toHaveCount(5);
  await expect(
    page.getByAltText("Plato para analizar", { exact: true }),
  ).toHaveAttribute("src", firstPhoto!);
  await page
    .getByRole("button", { name: "Quitar foto 2", exact: true })
    .click();
  await expect(page.locator(".meal-photo-card")).toHaveCount(4);
  await page.locator(".ai-analyzer h3").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/meal-photos-mobile.png" });
  await page
    .getByRole("button", { name: "Ampliar foto 3", exact: true })
    .click();
  await expect(page.getByAltText("Vista ampliada de la foto 3")).toBeVisible();
  await page
    .getByLabel("Descripción, cantidades, cocción y marcas")
    .fill("Arroz marca Fixture, 150 g cocidos, hervido, con aceite");
  await page
    .getByRole("button", { name: "Analizar fotos y descripción" })
    .click();
  await expect(
    page.getByText("¿Cuánto aceite agregaste?", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Descripción, cantidades, cocción y marcas")
    .fill("Arroz marca Fixture, 150 g cocidos, hervido; 5 g de aceite");
  await page
    .getByRole("button", { name: "Analizar fotos y descripción" })
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
  expect(Object.keys(posted[1]).sort()).toEqual(["description", "photos"]);
  expect(posted[1].description).toContain("marca Fixture");
  const uploadedPhotos = posted[1].photos as string[];
  expect(uploadedPhotos).toHaveLength(2);
  expect(uploadedPhotos.every((image: string) => image.length <= 2000000)).toBe(
    true,
  );
  // Read the actual uploaded sheets: every remaining original must appear once.
  const pixels = await page.evaluate(async (photos: string[]) => {
    const colors: number[][] = [];
    for (const photo of photos) {
      const bitmap = await createImageBitmap(await (await fetch(photo)).blob());
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0);
      for (const x of [canvas.width / 4, (canvas.width * 3) / 4])
        colors.push(
          Array.from(ctx.getImageData(x, canvas.height * 0.6, 1, 1).data).slice(
            0,
            3,
          ),
        );
      bitmap.close();
    }
    return colors;
  }, uploadedPhotos);
  expect(
    pixels.map((color) => color.map((channel) => (channel > 128 ? 255 : 0))),
  ).toEqual([
    [255, 0, 0],
    [0, 0, 255],
    [255, 255, 0],
    [255, 0, 255],
  ]);
  await page
    .getByRole("button", { name: "Confirmar y registrar", exact: true })
    .click();
  await expect(page.locator(".ring-text strong")).toHaveText("240");
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "Comidas", exact: true })
    .click();
  await expect(page.locator(".meal-detail .meal-photo-card")).toHaveCount(4);
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
  await expect(page.getByText(/IA conectada/)).toBeVisible();
  await page
    .getByLabel("Elegir foto para analizar")
    .setInputFiles("public/icon-192.png");
  await expect(page.getByAltText("Plato para analizar")).toBeVisible();
  await page
    .getByLabel("Descripción, cantidades, cocción y marcas")
    .fill("Comida de prueba con descripción");
  await page
    .getByRole("button", { name: "Analizar fotos y descripción" })
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
  await page.getByRole("button", { name: "Editar cantidades" }).click();
  await page.getByLabel("Cantidad (g)").fill("300");
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
  const product = page.getByRole("dialog", { name: "Producto" });
  await expect(product).toContainText("Producto de prueba");
  await expect(product.getByRole("row", { name: /Proteínas/ })).toContainText(
    "10",
  );
  await product.getByRole("button", { name: "Agregar a la comida" }).click();
  await page.getByLabel("Cantidad (g)").fill("150");
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
  await page
    .locator(".ingredient summary")
    .filter({ hasText: "Valores por 100 g" })
    .click();
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
  await page.getByRole("switch", { name: "Modo oscuro" }).click();
  await expect(page.locator(".app-shell")).toHaveClass(/dark/);
  await expect(
    page.getByRole("switch", { name: "Modo oscuro" }),
  ).toHaveAttribute("aria-checked", "true");
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
    "rgb(15, 26, 54)",
  );
  await expect(page.getByLabel("Usar tema oscuro")).toBeChecked();
  await page.getByLabel("Usar tema oscuro").uncheck();
  await page
    .getByRole("button", { name: "Confirmar objetivos y preferencias" })
    .click();
  await expect(page.locator("dialog")).toHaveCount(0);
  await expect(page.locator(".app-shell")).not.toHaveClass(/dark/);
  await page.getByRole("switch", { name: "Modo oscuro" }).click();
  await expect(page.locator(".app-shell")).toHaveClass(/dark/);
  await page.getByRole("switch", { name: "Modo oscuro" }).click();
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

test("fotos de comida se suman en carga manual, persisten y restauran fotos antiguas", async ({
  page,
}) => {
  await setup(page);
  await manualMeal(page);
  await navigate(page, "Comidas");
  await page.getByRole("button", { name: "Editar cantidades" }).click();
  await page
    .getByLabel("Elegir fotos de comida")
    .setInputFiles(["public/icon-192.png", "public/icon-512.png"]);
  await expect(page.locator("dialog .meal-photo-card")).toHaveCount(2);
  const original = await page
    .getByAltText("Comida registrada", { exact: true })
    .getAttribute("src");
  await page
    .getByLabel("Elegir fotos de comida")
    .setInputFiles("public/icon-192.png");
  await expect(page.locator("dialog .meal-photo-card")).toHaveCount(3);
  await expect(
    page.getByAltText("Comida registrada", { exact: true }),
  ).toHaveAttribute("src", original!);
  await page
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  await expect(page.locator(".meal-detail .meal-photo-card")).toHaveCount(3);
  await navigate(page, "Más");
  await page.getByRole("button", { name: /Tus datos van con vos/ }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Backup completo JSON/ }).click();
  const backup = JSON.parse(
    await readFile((await (await download).path())!, "utf8"),
  );
  expect(backup.data.meals[0].photos).toHaveLength(3);
  expect(backup.data.meals[0].photo).toBe(original);
  await page.getByLabel("Elegir archivo JSON").setInputFiles({
    name: "fotos.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(page.locator("dialog")).toHaveCount(0);
  await expect(page.locator(".toast")).toHaveText("Backup restaurado");
  await navigate(page, "Comidas");
  await expect(page.locator(".meal-detail .meal-photo-card")).toHaveCount(3);
  // Old backups only contain photo; it becomes the first image when editing.
  delete backup.data.meals[0].photos;
  await navigate(page, "Más");
  await page.getByRole("button", { name: /Tus datos van con vos/ }).click();
  await page.getByLabel("Elegir archivo JSON").setInputFiles({
    name: "foto-antigua.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(page.locator("dialog")).toHaveCount(0);
  await expect(page.locator(".toast")).toHaveText("Backup restaurado");
  await navigate(page, "Comidas");
  await expect(page.locator(".meal-detail .meal-photo-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Editar cantidades" }).click();
  await expect(
    page.getByAltText("Comida registrada", { exact: true }),
  ).toHaveAttribute("src", original!);
  await page
    .getByLabel("Sacar foto de comida")
    .setInputFiles("public/icon-512.png");
  await expect(page.locator("dialog .meal-photo-card")).toHaveCount(2);
  await page
    .getByRole("button", { name: "Quitar foto 1", exact: true })
    .click();
  await expect(page.locator("dialog .meal-photo-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Guardar cambios", exact: true })
    .click();
  await expect(page.locator(".meal-detail .meal-photo-card")).toHaveCount(1);
  // Chromium occasionally aborts this reload right after saving photos.
  await expect(async () => {
    await page.reload();
  }).toPass({ timeout: 20000 });
  await page.getByRole("button", { name: /Luca Construir/ }).click();
  await page.getByLabel("PIN", { exact: true }).fill("1234");
  await page.getByRole("button", { name: "Entrar a mi espacio" }).click();
  await navigate(page, "Comidas");
  await expect(page.locator(".meal-detail .meal-photo-card")).toHaveCount(1);
});

test("tema responde al tacto en modo instalado aunque el guardado esté ocupado", async ({
  browser,
}) => {
  // Includes two profile unlocks and reloads while a write lock is held.
  // Keep the 1 s responsiveness assertions below, independent of total setup time.
  test.setTimeout(120000);
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 },
    isMobile: true,
    hasTouch: true,
  });
  await context.addInitScript(() => {
    const matchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query) => {
      const result = matchMedia(query);
      if (query === "(display-mode: standalone)")
        Object.defineProperty(result, "matches", { value: true });
      return result;
    };
  });
  const page = await context.newPage();
  try {
    await page.goto("/");
    await page.getByRole("switch", { name: "Modo oscuro" }).tap();
    await expect(page.locator(".appearance-frame")).toHaveClass(/dark/);
    await page.getByRole("switch", { name: "Modo oscuro" }).tap();
    await expect(page.locator(".appearance-frame")).not.toHaveClass(/dark/);
    await setup(page);
    expect(
      await page.evaluate(
        () => matchMedia("(display-mode: standalone)").matches,
      ),
    ).toBe(true);
    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const open = indexedDB.open("nutriduo-v1");
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const database = open.result;
            let holding = true;
            (
              window as Window & { releaseThemeHold?: () => void }
            ).releaseThemeHold = () => {
              holding = false;
            };
            const transaction = database.transaction("profiles", "readwrite");
            transaction.oncomplete = () => database.close();
            const store = transaction.objectStore("profiles");
            const keepAlive = () => {
              const request = store.get("luca");
              request.onsuccess = () => {
                resolve();
                if (holding) keepAlive();
              };
            };
            keepAlive();
          };
        }),
    );
    try {
      await page.getByRole("switch", { name: "Modo oscuro" }).tap();
      await expect(page.locator(".app-shell")).toHaveClass(/dark/, {
        timeout: 1000,
      });
      await page.getByRole("switch", { name: "Modo oscuro" }).tap();
      await expect(page.locator(".app-shell")).not.toHaveClass(/dark/, {
        timeout: 1000,
      });
      await page.getByRole("switch", { name: "Modo oscuro" }).tap();
      await expect(page.locator(".app-shell")).toHaveClass(/dark/, {
        timeout: 1000,
      });
    } finally {
      await page.evaluate(() =>
        (
          window as Window & { releaseThemeHold?: () => void }
        ).releaseThemeHold?.(),
      );
    }
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            new Promise<boolean>((resolve, reject) => {
              const open = indexedDB.open("nutriduo-v1");
              open.onerror = () => reject(open.error);
              open.onsuccess = () => {
                const database = open.result;
                const request = database
                  .transaction("profiles")
                  .objectStore("profiles")
                  .get("luca");
                request.onsuccess = () => {
                  resolve(request.result.dark);
                  database.close();
                };
              };
            }),
        ),
      )
      .toBe(true);
    await page.reload();
    await page.getByRole("button", { name: /Luca Construir/ }).tap();
    await page.getByLabel("PIN", { exact: true }).fill("1234");
    await page.getByRole("button", { name: "Entrar a mi espacio" }).tap();
    await expect(page.locator(".app-shell")).toHaveClass(/dark/);
    await page.getByRole("switch", { name: "Modo oscuro" }).tap();
    await expect(page.locator(".app-shell")).not.toHaveClass(/dark/);
    await expect(
      page.getByRole("heading", { name: "Hoy, Luca" }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});

async function openProfileEditor(page: Page) {
  await page
    .getByRole("button", { name: "Abrir menú de perfil", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Tu cuenta", exact: true })
    .getByRole("button", { name: /Mi perfil/ })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Mi perfil", exact: true }),
  ).toBeVisible();
}

test("encabezado abre las secciones principales y Atrás restaura la pestaña anterior", async ({
  page,
}) => {
  await setup(page);
  await page.setViewportSize({ width: 393, height: 852 });
  const crumbs = page.getByRole("navigation", { name: "Ubicación actual" });
  await expect(
    crumbs.getByRole("button", { name: "Inicio", exact: true }),
  ).toBeVisible();
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "Comidas", exact: true })
    .click();
  await page.getByRole("button", { name: "Recetas", exact: true }).click();
  await crumbs.getByRole("button", { name: "Comidas", exact: true }).click();
  await expect(page.locator(".tabs button.active")).toHaveText("Hoy");
  await page.goBack();
  await expect(page.locator(".tabs button.active")).toHaveText("Recetas");
  await crumbs.getByRole("button", { name: "Mi espacio", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Hoy, Luca", exact: true }),
  ).toBeVisible();
  // Going back to Inicio (left of Comidas) slides in from the left.
  await expect(page.locator(".section-view")).toHaveCSS(
    "animation-name",
    "duo-in-left",
  );
  await page.goBack();
  await expect(page.locator(".tabs button.active")).toHaveText("Recetas");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await crumbs.getByRole("button", { name: "Comidas", exact: true }).click();
  await expect(page.locator(".section-view")).toHaveCSS(
    "animation-name",
    "none",
  );
  await page.setViewportSize({ width: 320, height: 740 });
  await expect(
    crumbs.getByRole("button", { name: "Mi espacio", exact: true }),
  ).toBeVisible();
  await expect(
    crumbs.getByRole("button", { name: "Comidas", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Abrir menú de perfil", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: "test-results/header-small-mobile.png" });
  await page
    .getByRole("button", { name: "Abrir menú de perfil", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Tu cuenta", exact: true }),
  ).toHaveCSS("animation-name", "none");
});

test("menú de cuenta abre datos y recordatorios sin duplicar pasos de Atrás", async ({
  page,
}) => {
  await setup(page);
  await page.setViewportSize({ width: 412, height: 915 });
  await openProfileEditor(page);
  await page
    .getByRole("button", { name: "Editar mis datos y objetivos", exact: true })
    .click();
  await expect(page.locator("dialog")).toHaveCount(1);
  await expect(
    page.getByRole("dialog", { name: "Tu perfil y objetivos", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(page.locator("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Ajustes", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Hoy, Luca", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Abrir menú de perfil", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Tu cuenta", exact: true }),
  ).toHaveCSS("opacity", "1");
  await page.screenshot({ path: "test-results/account-menu-mobile.png" });
  await page
    .getByRole("dialog", { name: "Tu cuenta", exact: true })
    .getByRole("button", { name: /Recordatorios/ })
    .click();
  await expect(page.locator("dialog")).toHaveCount(1);
  await expect(
    page.getByRole("dialog", {
      name: "Recordatorios en tu celular",
      exact: true,
    }),
  ).toBeVisible();
  await page.goBack();
  await expect(page.locator("dialog")).toHaveCount(0);
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Hoy, Luca", exact: true }),
  ).toBeVisible();
});

test("nombre y foto de perfil persisten en backup sin cambiar el PIN ni el otro usuario", async ({
  page,
}) => {
  await setup(page);
  await manualMeal(page);
  await openProfileEditor(page);
  await page.getByLabel("Nombre del perfil").fill("Luca Demo");
  await page
    .getByLabel("Elegir foto de perfil")
    .setInputFiles("public/icon-192.png");
  await expect(
    page.getByAltText("Foto de perfil", { exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 393, height: 852 });
  await expect(
    page.getByRole("dialog", { name: "Mi perfil", exact: true }),
  ).toHaveCSS("opacity", "1");
  await page
    .getByRole("dialog", { name: "Mi perfil", exact: true })
    .screenshot({ path: "test-results/profile-editor.png" });
  await page.setViewportSize({ width: 1280, height: 720 });
  const first = await page
    .getByAltText("Foto de perfil", { exact: true })
    .getAttribute("src");
  await page
    .getByLabel("Elegir foto de perfil")
    .setInputFiles("public/icon-512.png");
  await expect(
    page.getByRole("button", { name: "Guardar perfil", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByAltText("Foto de perfil", { exact: true }),
  ).not.toHaveAttribute("src", first!);
  await page
    .getByRole("button", { name: "Quitar foto de perfil", exact: true })
    .click();
  await expect(
    page.getByAltText("Foto de perfil", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("Elegir foto de perfil")
    .setInputFiles("public/icon-192.png");
  await expect(
    page.getByRole("button", { name: "Guardar perfil", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Guardar perfil", exact: true })
    .click();
  await expect(page.locator("dialog")).toHaveCount(1);
  await expect(page.locator(".account-summary")).toContainText("Luca Demo");
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await expect(page.locator("dialog")).toHaveCount(0);
  await expect(page.locator(".mini-avatar img")).toHaveAttribute("src", first!);
  await expect(
    page.getByRole("heading", { name: "Hoy, Luca Demo", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".ring-text strong")).toHaveText("260");
  await navigate(page, "Más");
  await page.getByRole("button", { name: /Tus datos van con vos/ }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: /Backup completo JSON/ }).click();
  const backup = JSON.parse(
    await readFile((await (await downloaded).path())!, "utf8"),
  );
  expect(backup.profile.name).toBe("Luca Demo");
  expect(backup.profile.avatar).toBe(first);
  expect(backup.profile.pinHash).toBeUndefined();
  expect(backup.data.meals).toHaveLength(1);
  delete backup.profile.avatar;
  await page.getByLabel("Elegir archivo JSON").setInputFiles({
    name: "perfil-antiguo.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await page.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(page.locator("dialog")).toHaveCount(0);
  await expect(page.locator(".mini-avatar img")).toHaveCount(0);
  await openProfileEditor(page);
  await page
    .getByLabel("Elegir foto de perfil")
    .setInputFiles("public/icon-192.png");
  await expect(
    page.getByRole("button", { name: "Guardar perfil", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Guardar perfil", exact: true })
    .click();
  await expect(page.locator("dialog")).toHaveCount(1);
  await page
    .getByRole("dialog", { name: "Tu cuenta", exact: true })
    .getByRole("button", { name: /Cambiar perfil/ })
    .click();
  await setup(page, "Ari");
  await expect(page.locator(".mini-avatar img")).toHaveCount(0);
  await expect(page.locator(".ring-text strong")).toHaveText("0");
  await page
    .getByRole("button", { name: "Abrir menú de perfil", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Tu cuenta", exact: true })
    .getByRole("button", { name: /Cambiar perfil/ })
    .click();
  await page.getByRole("button", { name: /Luca Demo Construir/ }).click();
  await page.getByLabel("PIN", { exact: true }).fill("1234");
  await page
    .getByRole("button", { name: "Entrar a mi espacio", exact: true })
    .click();
  await expect(page.locator(".mini-avatar img")).toHaveAttribute("src", first!);
  await expect(
    page.getByRole("heading", { name: "Hoy, Luca Demo", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".ring-text strong")).toHaveText("260");
});

test("graba una salida con GPS, la guarda y muestra el recorrido", async ({
  page,
  context,
}) => {
  await page.route(/tile\.openstreetmap\.org/, (route) => route.abort());
  await context.grantPermissions(["geolocation"]);
  const start = { latitude: -34.5717, longitude: -58.4176 };
  await context.setGeolocation({ ...start, accuracy: 5 });
  await setup(page);
  await navigate(page, "Entreno");
  await expect(
    page.getByRole("heading", { name: "Mis salidas", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Salir a correr" }).click();
  const km = page.getByTestId("run-km");
  await expect(km).toBeVisible({ timeout: 15000 });
  for (let i = 1; i <= 16; i++) {
    await context.setGeolocation({
      latitude: start.latitude + (i * 8) / 111195,
      longitude: start.longitude,
      accuracy: 5,
    });
    await page.waitForTimeout(1100);
  }
  await expect(km).not.toHaveText("0,00");
  await page.getByRole("button", { name: "Pausar" }).click();
  await page.getByRole("button", { name: "Terminar" }).click();
  await expect(
    page.getByRole("heading", { name: "¡Bien ahí, Luca!" }),
  ).toBeVisible();
  await expect(
    page.getByRole("img", { name: /Recorrido de la salida/ }),
  ).toBeVisible();
  await expect(page.getByLabel("Para recuperar")).toContainText(
    "g de proteína",
  );
  await page.getByRole("button", { name: "Volver a Mis salidas" }).click();
  await expect(page.locator(".my-runs-item")).toHaveCount(1);
  await page.locator(".my-runs-item").click();
  await expect(
    page.getByRole("dialog", { name: "Detalle de la salida" }),
  ).toBeVisible();
});

test("importa un GPX, cambia la meta semanal y arma la imagen para compartir", async ({
  page,
}) => {
  await page.route(/tile\.openstreetmap\.org/, (route) => route.abort());
  await setup(page);
  await navigate(page, "Entreno");
  const start = Date.parse("2026-10-10T10:00:00Z");
  const points = Array.from({ length: 80 }, (_, i) => {
    const lat = (-34.5717 + (i * 30) / 111195).toFixed(6);
    const time = new Date(start + i * 10000).toISOString();
    return `<trkpt lat="${lat}" lon="-58.4176"><ele>10</ele><time>${time}</time></trkpt>`;
  }).join("");
  const gpx = `<?xml version="1.0"?><gpx version="1.1" creator="test"><trk><type>running</type><trkseg>${points}</trkseg></trk></gpx>`;
  await page
    .getByRole("button", { name: "Importar salidas de adidas Running o GPX" })
    .click();
  await page.getByLabel("Archivo de salidas").setInputFiles({
    name: "salida.gpx",
    mimeType: "application/gpx+xml",
    buffer: Buffer.from(gpx),
  });
  await expect(page.getByText("Importé 1 salida").first()).toBeVisible();
  await expect(page.locator(".my-runs-item")).toHaveCount(1);
  await expect(page.locator(".my-runs-item")).toContainText("2,37 km");

  await page.getByRole("button", { name: /Meta semanal/ }).click();
  await page.getByRole("button", { name: "Subir la meta" }).click();
  await expect(page.locator(".my-runs-goal")).toContainText("21 km");

  await page.locator(".my-runs-item").click();
  await page.getByRole("button", { name: "Compartir", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "Vista previa de la imagen para compartir" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sticker" }).click();
  await expect(
    page.getByRole("button", { name: "Guardar imagen" }),
  ).toBeEnabled();
});

test("escanea un producto que no existe, lo carga y queda en Productos de la casa", async ({
  page,
}) => {
  await page.route("**/api/v2/product/**", (r) =>
    r.fulfill({ status: 404, json: { status: 0 } }),
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
    .fill("7790580123456");
  await page
    .getByRole("button", { name: "Buscar producto", exact: true })
    .click();
  const sheet = page.getByRole("dialog", { name: "Datos de la etiqueta" });
  await sheet.getByLabel("Nombre del producto").fill("Yogur de casa");
  await sheet.getByLabel("Energía (kcal) cada 100").fill("80");
  await sheet.getByLabel("Proteínas (g)").fill("9");
  await sheet.getByLabel("Carbohidratos (g)").fill("6");
  await sheet.getByLabel("Grasas (g)", { exact: true }).fill("2");
  await sheet.getByRole("button", { name: "Guardar producto" }).click();
  const product = page.getByRole("dialog", { name: "Producto" });
  await expect(product).toContainText("Yogur de casa");
  await product.getByRole("button", { name: "Cerrar" }).click();
  await expect(
    page.getByRole("region", { name: "Productos de la casa" }),
  ).toContainText("Yogur de casa");
});
