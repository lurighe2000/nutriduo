import { test, expect } from "@playwright/test";

test("los dos personajes cargan y los controles caben en celular, con pausa y movimiento reducido", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("/mascots.html");
  await expect(page.getByRole("status")).toHaveText("Listo para moverse");
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Travesura de la nariz", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Travesura de la nariz", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Pausar movimiento", exact: true })
    .click();
  const paused = await page.locator("canvas").screenshot();
  await page.waitForTimeout(200);
  expect(await page.locator("canvas").screenshot()).toEqual(paused);
  await page
    .getByRole("button", { name: "Continuar movimiento", exact: true })
    .click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForTimeout(100);
  const reduced = await page.locator("canvas").screenshot();
  await page.waitForTimeout(200);
  expect(await page.locator("canvas").screenshot()).toEqual(reduced);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.getByRole("button", { name: "Angel · Ari", exact: true }).click();
  await expect(
    page
      .getByRole("img", { name: "Vista 3D de Angel", exact: true })
      .locator("canvas"),
  ).toHaveCount(1);
  await expect(page.getByRole("status")).toHaveText(
    "Escultura sin color ni animaciones",
  );
  await expect(
    page.getByRole("button", { name: "Pausar movimiento", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".mascot-motion-picker button")).toHaveCount(0);
  const front = await page.locator("canvas").screenshot();
  await page.getByRole("button", { name: "Perfil", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Perfil", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(await page.locator("canvas").screenshot()).not.toEqual(front);
  await page.getByRole("button", { name: "Frente", exact: true }).click();
  expect(await page.locator("canvas").screenshot()).toEqual(front);
  await expect(
    page.getByRole("button", { name: "Travesura de la nariz", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".mascot-reference img")).toHaveAttribute(
    "src",
    "/mascots/angel-reference.jpg",
  );
  for (const width of [360, 393, 412, 430, 1280]) {
    await page.setViewportSize({ width, height: 915 });
    for (const dark of [false, true]) {
      const toggle = page.getByRole("button", {
        name: dark ? "Modo oscuro" : "Modo claro",
        exact: true,
      });
      if (await toggle.count()) await toggle.click();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const canvas = await page.locator("canvas").boundingBox();
      expect(canvas?.width).toBeGreaterThan(200);
    }
  }
  await page.setViewportSize({ width: 412, height: 915 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.locator("canvas").scrollIntoViewIfNeeded();
  await page.waitForTimeout(100);
  const still = await page.locator("canvas").screenshot();
  await page.waitForTimeout(200);
  expect(await page.locator("canvas").screenshot()).toEqual(still);
  expect(errors).toEqual([]);
});
