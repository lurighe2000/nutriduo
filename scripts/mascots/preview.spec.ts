import { test, expect } from "@playwright/test";

test("un gesto espera la salida de la postura invertida y termina completo al salir de pausa", async ({
  page,
}) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("/mascots.html");
  const art = page.locator(".cartoon-character");
  const headstand = page.getByRole("button", {
    name: "Ponerse de cabeza",
    exact: true,
  });
  const nose = page.getByRole("button", {
    name: "Travesura de la nariz",
    exact: true,
  });
  await headstand.click();
  await nose.click();
  await expect(art).toHaveAttribute("data-motion", "headstand");
  await page.waitForTimeout(2150);
  await page
    .getByRole("button", { name: "Pausar movimiento", exact: true })
    .click();
  const still = await art.screenshot();
  await page.screenshot({
    path: test.info().outputPath("Stitch-invertido.png"),
  });
  await page.waitForTimeout(400);
  expect(await art.screenshot()).toEqual(still);
  await page
    .getByRole("button", { name: "Continuar movimiento", exact: true })
    .click();
  await expect(art).toHaveAttribute("data-motion", "nose", { timeout: 7000 });
  await page.waitForTimeout(700);
  await expect(art).toHaveAttribute("data-motion", "nose");
  await page.screenshot({ path: test.info().outputPath("Stitch-nariz.png") });
  await expect(art).toHaveAttribute("data-motion", "idle", { timeout: 5000 });
});

test("los dos dibujos son nítidos, caben en móvil y respetan pausa y movimiento reducido", async ({
  page,
}) => {
  const errors: string[] = [];
  const models: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (/\.glb(?:\?|$)|renderer-[\w-]+\.js/.test(request.url()))
      models.push(request.url());
  });
  await page.goto("/mascots.html");
  for (const character of ["Stitch", "Angel"]) {
    await page
      .getByRole("button", {
        name: character === "Stitch" ? "Stitch · Luca" : "Angel · Ari",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("img", { name: `${character}, dibujo animado en 2D` }),
    ).toBeVisible();
    const art = page.locator(".cartoon-character");
    await expect(page.locator("canvas")).toHaveCount(0);
    const moving = await art.screenshot();
    await page.waitForTimeout(350);
    expect(await art.screenshot()).not.toEqual(moving);
    await page.getByRole("button", { name: "Saludar", exact: true }).click();
    await page.waitForTimeout(1000);
    await page
      .getByRole("button", { name: "Pausar movimiento", exact: true })
      .click();
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
        await page.screenshot({
          path: test
            .info()
            .outputPath(`${character}-${dark ? "dark" : "light"}-${width}.png`),
        });
      }
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(
      page.getByRole("button", { name: "Movimiento reducido", exact: true }),
    ).toBeDisabled();
    const still = await art.screenshot();
    await page.waitForTimeout(250);
    expect(await art.screenshot()).toEqual(still);
    await page.emulateMedia({ reducedMotion: "no-preference" });
  }
  expect(errors).toEqual([]);
  expect(models).toEqual([]);
});
