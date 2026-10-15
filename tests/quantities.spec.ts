import { test, expect, type Page } from "@playwright/test";

async function setup(page: Page, name: "Luca" | "Ari") {
  await page.goto("/");
  await page
    .getByRole("button", {
      name: new RegExp(name + " Construir|" + name + " Sentirte"),
    })
    .click();
  await page.getByLabel("Crear PIN", { exact: true }).fill("1234");
  await page.getByLabel("Repetir PIN").fill("1234");
  await page.getByRole("button", { name: "Crear mi PIN" }).click();
  await page.getByLabel("Peso actual (kg)").fill("65");
  await page.getByLabel("Altura (cm)").fill("169");
  await page.getByLabel("Fecha de nacimiento").fill("2000-06-15");
  await page.getByRole("button", { name: "Ver propuesta" }).click();
  await page.getByRole("button", { name: "Confirmar y empezar" }).click();
  await expect(
    page.getByRole("heading", { name: `Hoy, ${name}` }),
  ).toBeVisible();
  await page
    .locator(".sidebar")
    .getByRole("button", { name: "Comidas", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Registrar comida", exact: true })
    .first()
    .click();
}
async function measure(page: Page, label: string) {
  await page.getByRole("button", { name: "Medida", exact: true }).click();
  await page.getByRole("button", { name: label, exact: true }).click();
}
for (const name of ["Luca", "Ari"] as const) {
  test(`${name}: unidades, gramos, mililitros y edición persistente`, async ({
    page,
  }) => {
    await setup(page, name);
    await page.getByLabel("Nombre de la comida").fill("Desayuno por unidades");
    await page
      .getByRole("button", { name: "Agregar componente manual" })
      .click();
    await page.getByLabel("Alimento", { exact: true }).fill("Huevos");
    await measure(page, "Unidades");
    await page.getByLabel("Unidades", { exact: true }).fill("2");
    await expect(
      page.getByRole("button", { name: "Confirmar y registrar" }),
    ).toBeDisabled();
    await page.getByLabel("Una unidad equivale a (g)").fill("50");
    await page.locator(".ingredient summary").first().click();
    await page.getByLabel("kcal / 100", { exact: true }).fill("140");
    await page.getByLabel("Proteína g / 100").fill("12");
    await expect(page.locator(".item-total")).toContainText("140 kcal");
    await page.getByLabel("Unidades", { exact: true }).fill("3");
    await expect(page.locator(".item-total")).toContainText("210 kcal");
    await measure(page, "Gramos (g)");
    await expect(page.getByLabel("Cantidad (g)")).toHaveValue("150");
    await measure(page, "Unidades");
    await expect(page.getByLabel("Unidades", { exact: true })).toHaveValue("3");
    await page.getByLabel("Una unidad equivale a (g)").fill("60");
    await expect(page.locator(".item-total")).toContainText("252 kcal");
    await page.locator(".ingredient summary").first().click();
    for (const width of [360, 393, 412, 430, 1280]) {
      await page.setViewportSize({ width, height: 915 });
      for (const dark of [false, true]) {
        await page.evaluate(
          (value) => document.querySelectorAll(".app-shell, dialog").forEach(e => e.classList.toggle("dark", value)),
          dark,
        );
        await page.locator(".meal-quantity").scrollIntoViewIfNeeded();
        expect(
          await page
            .locator("dialog[open]")
            .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
        ).toBe(true);
        await expect(
          page.getByLabel("Unidades", { exact: true }),
        ).toBeVisible();
        if (width === 412 || width === 1280)
          await page.screenshot({ path: test.info().outputPath(`quantity-${name}-${dark ? "dark" : "light"}-${width}.png`) });
      }
    }
    await page.screenshot({ path: `test-results/quantity-${name}.png` });
    await page.getByRole("button", { name: "Confirmar y registrar" }).click();
    await expect(page.locator(".meal-detail")).toContainText(
      "3 unidades · 180 g",
    );
    await page.getByRole("button", { name: "Editar cantidades" }).click();
    await expect(page.getByLabel("Unidades", { exact: true })).toHaveValue("3");
    await expect(page.getByLabel("Una unidad equivale a (g)")).toHaveValue(
      "60",
    );
    await page.getByLabel("Unidades", { exact: true }).fill("2");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.locator(".meal-detail")).toContainText(
      "2 unidades · 120 g",
    );
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
    // Returning to the meal also proves that metadata survives schema parsing.
    await page.setViewportSize({ width: 1280, height: 915 });
    await page
      .locator(".sidebar")
      .getByRole("button", { name: "Comidas", exact: true })
      .click();
    await page.getByRole("button", { name: "Editar cantidades" }).click();
    await expect(page.getByLabel("Unidades", { exact: true })).toHaveValue("2");
    await measure(page, "Mililitros (ml)");
    await expect(
      page.getByRole("button", { name: "Guardar cambios" }),
    ).toBeDisabled();
    await page.getByLabel("Peso de 100 ml (g)").fill("120");
    await page.getByLabel("Cantidad (ml)").fill("100");
    await expect(page.locator(".item-total")).toContainText("168 kcal");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.locator(".meal-detail")).toContainText("100 ml · 120 g");
  });
}
