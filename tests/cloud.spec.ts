import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { readFile } from "node:fs/promises";

const password = "solo-prueba-contraseña-2026";
const invitation = "test-only-invitation-code-not-a-real-secret";
test.use({ actionTimeout: 15000 });
async function localVault(context: BrowserContext) {
  await context.route(
    "https://nutriduo-ai.lucarighetti2000.workers.dev/cloud/**",
    async (route) => {
      const path = new URL(route.request().url()).pathname;
      await route.fulfill({
        response: await route.fetch({ url: `http://127.0.0.1:8788${path}` }),
      });
    },
  );
}
async function onboard(page: Page, name: "Luca" | "Ari") {
  await page.goto("/");
  await page
    .getByRole("button", {
      name: new RegExp(`${name} Construir|${name} Sentirte`),
    })
    .click();
  await page.getByLabel("Crear PIN", { exact: true }).fill("1234");
  await page.getByLabel("Repetir PIN").fill("1234");
  await page.getByRole("button", { name: "Crear mi PIN" }).click();
  await page.getByLabel("Peso actual (kg)").fill(name === "Luca" ? "70" : "65");
  await page.getByLabel("Altura (cm)").fill(name === "Luca" ? "170" : "160");
  await page
    .getByLabel("Fecha de nacimiento")
    .fill(name === "Luca" ? "1996-06-15" : "1994-01-15");
  await page.getByRole("button", { name: "Ver propuesta" }).click();
  await page.getByRole("button", { name: "Confirmar y empezar" }).click();
  await expect(
    page.getByRole("heading", { name: `Hoy, ${name}` }),
  ).toBeVisible();
}
async function meal(page: Page, name: string, photo = false) {
  await page
    .locator(".sidebar:visible, .bottom-nav:visible")
    .getByRole("button", { name: "Inicio", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Registrar comida", exact: true })
    .first()
    .click();
  await page.getByLabel("Nombre de la comida").fill(name);
  if (photo)
    await page
      .getByLabel("Elegir fotos de comida")
      .setInputFiles(["public/icon-192.png", "public/icon-512.png"]);
  await page.getByRole("button", { name: "Agregar componente manual" }).click();
  await page
    .getByLabel("Alimento", { exact: true })
    .fill("Alimento privado de prueba");
  await page.getByLabel("Cantidad (g / ml)").fill("150");
  await page.getByText("Valores por 100 g / ml").click();
  await page.getByLabel("kcal / 100", { exact: true }).fill("100");
  await page.getByLabel("Proteína g / 100").fill("20");
  await page.getByLabel("Carbos g / 100").fill("2");
  await page.getByLabel("Grasas g / 100").fill("1");
  await page.getByRole("button", { name: "Confirmar y registrar" }).click();
  await expect(page.locator("dialog")).toHaveCount(0);
  await expect(page.locator(".toast")).toHaveText("Comida guardada");
}
async function more(page: Page, title: string) {
  await page
    .locator(".sidebar:visible, .bottom-nav:visible")
    .getByRole("button", { name: "Más", exact: true })
    .click();
  await page
    .locator(".settings-grid")
    .getByRole("button", { name: new RegExp(title) })
    .click();
}
async function backup(page: Page) {
  await more(page, "Tus datos van con vos");
  const pending = page.waitForEvent("download");
  await page.getByRole("button", { name: /Backup completo JSON/ }).click();
  const data = JSON.parse(
    await readFile((await (await pending).path())!, "utf8"),
  );
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  return data;
}

test("respaldo cifrado sobre SQLite real: reinstalar, fotos, usuarios separados y menú y compras compartidos", async ({
  browser,
  request,
}) => {
  test.setTimeout(180000);
  const first = await browser.newContext();
  const reinstalled = await browser.newContext({
    viewport: { width: 393, height: 852 },
    isMobile: true,
    hasTouch: true,
  });
  const recoveryDevice = await browser.newContext();
  for (const context of [first, reinstalled, recoveryDevice])
    await localVault(context);
  try {
    const page = await first.newPage();
    await onboard(page, "Luca");
    await page.getByRole("button", { name: "Oscuro", exact: true }).click();
    const today = await page.getByLabel("Fecha de los registros").inputValue();
    await page.getByLabel("Fecha de los registros").fill("2026-09-01");
    await meal(page, "Comida de un día anterior", true);
    await page.getByLabel("Fecha de los registros").fill(today);
    await meal(page, "Comida de hoy");
    await more(page, "Cuenta y respaldo");
    await page
      .getByRole("button", { name: "Crear mi cuenta", exact: true })
      .click();
    await page
      .getByLabel("Contraseña de la cuenta", { exact: true })
      .fill(password);
    await page.getByLabel("Repetir contraseña de la cuenta").fill(password);
    await page.getByLabel("Código privado de NutriDuo").fill(invitation);
    const recoveryDownload = page.waitForEvent("download");
    await page
      .getByRole("button", { name: "Crear cuenta y respaldar", exact: true })
      .click();
    await expect(
      page.getByText("Cuenta creada y primer respaldo guardado.", {
        exact: false,
      }),
    ).toBeVisible({ timeout: 20000 });
    const recoveryFile = await readFile(
      (await (await recoveryDownload).path())!,
      "utf8",
    );
    expect(JSON.parse(recoveryFile).credentials.profileId).toBe("luca");
    await page.getByRole("button", { name: "Cerrar", exact: true }).click();
    await meal(page, "Registro agregado después de activar la cuenta");
    await expect(page.locator(".cloud-backup-status")).toContainText("al día", {
      timeout: 20000,
    });
    const original = await backup(page);
    expect(original.data.meals).toHaveLength(3);

    // Fresh browser context: no previous IndexedDB, PIN, cookies or localStorage.
    const fresh = await reinstalled.newPage();
    await onboard(fresh, "Ari");
    await meal(fresh, "Dato local de Ari que debe conservarse");
    await fresh.goto("/");
    await fresh
      .getByRole("button", { name: /Ya tengo cuenta · Recuperar/ })
      .click();
    await fresh.getByLabel("Usuario de NutriDuo").selectOption("luca");
    await fresh
      .getByLabel("Contraseña de la cuenta", { exact: true })
      .fill("contraseña equivocada");
    await fresh.getByRole("button", { name: "Buscar mi respaldo" }).click();
    await expect(fresh.getByRole("alert")).toContainText("incorrectos");
    await fresh
      .getByLabel("Contraseña de la cuenta", { exact: true })
      .fill(password);
    await fresh.getByRole("button", { name: "Buscar mi respaldo" }).click();
    await expect(fresh.getByText("Copia encontrada de Luca")).toBeVisible();
    await fresh
      .getByRole("button", { name: "Recuperar mis registros", exact: true })
      .click();
    await expect(
      fresh.getByRole("heading", { name: "Hoy, Luca" }),
    ).toBeVisible();
    await expect(fresh.locator(".app-shell")).toHaveClass(/dark/);
    const restored = await backup(fresh);
    expect(restored.data).toEqual(original.data);
    expect(restored.profile).toEqual(original.profile);
    await fresh.screenshot({ path: "test-results/cloud-recovered-mobile.png" });

    await reinstalled.setOffline(true);
    await meal(fresh, "Comida guardada sin internet");
    await expect(fresh.locator(".cloud-backup-status")).toContainText(
      /internet|conexión/,
    );
    await reinstalled.setOffline(false);
    await expect(fresh.locator(".cloud-backup-status")).toContainText(
      "al día",
      { timeout: 20000 },
    );

    // An older device may not replace newer history silently.
    await meal(page, "Cambio de un dispositivo desactualizado");
    await expect(page.locator(".cloud-backup-status")).toContainText(
      "más reciente",
      { timeout: 20000 },
    );

    await fresh.goto("/");
    await fresh.getByRole("button", { name: /Ari Sentirte/ }).click();
    await fresh.getByLabel("PIN", { exact: true }).fill("1234");
    await fresh.getByRole("button", { name: "Entrar a mi espacio" }).click();
    const untouched = await backup(fresh);
    expect(untouched.profile.id).toBe("ari");
    expect(untouched.data.meals.map((m: { name: string }) => m.name)).toEqual([
      "Dato local de Ari que debe conservarse",
    ]);
    await more(fresh, "Cuenta y respaldo");
    await fresh
      .getByRole("button", { name: "Crear mi cuenta", exact: true })
      .click();
    await fresh
      .getByLabel("Contraseña de la cuenta", { exact: true })
      .fill(password + "-ari");
    await fresh
      .getByLabel("Repetir contraseña de la cuenta")
      .fill(password + "-ari");
    await fresh.getByLabel("Código privado de NutriDuo").fill(invitation);
    await fresh
      .getByRole("button", { name: "Crear cuenta y respaldar", exact: true })
      .click();
    await expect(
      fresh.getByText("Cuenta creada y primer respaldo guardado.", {
        exact: false,
      }),
    ).toBeVisible({ timeout: 20000 });

    // The recovery file also restores after a second clean installation.
    const third = await recoveryDevice.newPage();
    await third.goto("/");
    await third
      .getByRole("button", { name: /Ya tengo cuenta · Recuperar/ })
      .click();
    await third
      .getByLabel("O recuperar con mi archivo de acceso")
      .setInputFiles({
        name: "nutriduo-recuperacion-luca.json",
        mimeType: "application/json",
        buffer: Buffer.from(recoveryFile),
      });
    await expect(third.getByText("Copia encontrada de Luca")).toBeVisible();
    await third
      .getByRole("button", { name: "Recuperar mis registros", exact: true })
      .click();
    await expect(
      third.getByRole("heading", { name: "Hoy, Luca" }),
    ).toBeVisible();
    await expect(third.locator(".app-shell")).toHaveClass(/dark/);
    const complete = await backup(third);
    expect(complete.data.meals).toHaveLength(4);
    expect(
      complete.data.meals.some(
        (m: { name: string }) => m.name === "Comida guardada sin internet",
      ),
    ).toBe(true);
    expect(
      complete.data.meals.some(
        (m: { name: string }) =>
          m.name === "Cambio de un dispositivo desactualizado",
      ),
    ).toBe(false);
    expect(
      complete.data.meals.find(
        (m: { name: string }) => m.name === "Comida de un día anterior",
      ).photos,
    ).toHaveLength(2);

    // Incomplete uploads and stale devices cannot replace the committed head.
    const access = JSON.parse(recoveryFile).credentials;
    const headers = {
      origin: "http://localhost:4173",
      authorization: `Bearer ${access.auth}`,
    };
    const call = (route: string, data: object, extra = {}) =>
      request.post(`http://127.0.0.1:8788/cloud/${route}`, {
        headers: { ...headers, ...extra },
        data: { profileId: "luca", ...data },
      });
    const head = await (await call("head", {})).json();
    const meta = { ...head.latest };
    delete meta.id;
    delete meta.revision;
    delete meta.savedAt;
    const pending = await (
      await call("start", { baseRevision: head.latest.revision, meta })
    ).json();
    expect((await call("commit", { id: pending.id })).status()).toBe(409);
    expect((await (await call("head", {})).json()).latest).toEqual(head.latest);
    expect((await call("start", { baseRevision: 0, meta })).status()).toBe(409);
    expect((await call("head", { profileId: "ari" })).status()).toBe(401);
    expect(
      (
        await call(
          "household",
          { action: "read" },
          { authorization: "Bearer incorrecto" },
        )
      ).status(),
    ).toBe(401);

    await third
      .locator(".sidebar")
      .getByRole("button", { name: "Comidas", exact: true })
      .click();
    await third
      .getByRole("button", { name: "Menú semanal", exact: true })
      .click();
    await third
      .getByRole("button", { name: "Preparar menú para ambos", exact: true })
      .click();
    await expect(
      third.getByRole("heading", { name: "Menú semanal compartido" }),
    ).toBeVisible();
    const commonDishes = await third
      .locator(".record-grid .card h3")
      .allTextContents();
    const lucaPortions = await third
      .locator(".record-grid .card > ul")
      .first()
      .innerText();
    await fresh.getByRole("button", { name: "Cerrar", exact: true }).click();
    await fresh
      .locator(".bottom-nav")
      .getByRole("button", { name: "Comidas", exact: true })
      .click();
    await fresh
      .getByRole("button", { name: "Menú semanal", exact: true })
      .click();
    await expect(
      fresh.getByRole("heading", { name: "Menú semanal compartido" }),
    ).toBeVisible();
    expect(
      await fresh.locator(".record-grid .card h3").allTextContents(),
    ).toEqual(commonDishes);
    expect(
      await fresh.locator(".record-grid .card > ul").first().innerText(),
    ).not.toEqual(lucaPortions);
    async function groceries(page: Page) {
      await page
        .getByRole("button", { name: "Lista de compras", exact: true })
        .click();
      await expect(
        page.getByRole("heading", {
          name: "Compras para siete días · Luca y Ari",
        }),
      ).toBeVisible();
      const file = page.waitForEvent("download");
      await page
        .getByRole("button", { name: "Descargar lista", exact: true })
        .click();
      return readFile((await (await file).path())!, "utf8");
    }
    expect(await groceries(fresh)).toEqual(await groceries(third));
    await fresh.screenshot({
      path: "test-results/shared-groceries-mobile.png",
    });
    await third.getByRole("button", { name: "Platos", exact: true }).click();
    const breakfastSelect = third.getByLabel("Cambiar plato de Desayuno");
    const nextBreakfast =
      (await breakfastSelect.inputValue()) === "toast" ? "oats" : "toast";
    const nextBreakfastName = await breakfastSelect
      .locator(`option[value="${nextBreakfast}"]`)
      .innerText();
    await breakfastSelect.selectOption(nextBreakfast);
    await expect(third.locator(".record-grid .card h3").first()).toHaveText(
      nextBreakfastName,
    );
    await fresh
      .locator(".tabs")
      .getByRole("button", { name: "Hoy", exact: true })
      .click();
    await fresh
      .getByRole("button", { name: "Menú semanal", exact: true })
      .click();
    await expect(fresh.locator(".record-grid .card h3").first()).toHaveText(
      nextBreakfastName,
    );
    expect(await groceries(fresh)).toEqual(await groceries(third));
  } finally {
    await first.close();
    await reinstalled.close();
    await recoveryDevice.close();
  }
});
