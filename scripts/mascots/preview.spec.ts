import { test, expect } from "@playwright/test";

test("un gesto espera a que Stitch termine de bajar de la postura invertida", async ({
  page,
}) => {
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("/mascots.html");
  await expect(page.getByRole("status")).toHaveText("Listo para moverse");
  const headstand = page.getByRole("button", {
    name: "Ponerse de cabeza",
    exact: true,
  });
  const nose = page.getByRole("button", {
    name: "Travesura de la nariz",
    exact: true,
  });
  await headstand.click();
  await expect(headstand).toHaveAttribute("aria-pressed", "true");
  await nose.click();
  await expect(headstand).toHaveAttribute("aria-pressed", "true");
  await expect(nose).toHaveAttribute("aria-pressed", "true", {
    timeout: 15000,
  });
  await expect(
    page.getByRole("button", { name: "Respirar y parpadear" }),
  ).toHaveAttribute("aria-pressed", "true", { timeout: 12000 });
});

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
  await expect(
    page.getByRole("button", { name: "Jugar con las manos", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("Listo para moverse");
  await expect(
    page.getByRole("button", { name: "Pausar movimiento", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".mascot-motion-picker button")).toHaveCount(10);
  await page
    .getByRole("button", { name: "Pausar movimiento", exact: true })
    .click();
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
