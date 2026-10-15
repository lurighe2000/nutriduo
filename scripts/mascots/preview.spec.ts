import { test, expect } from "@playwright/test";

test("el bulldog completa los gestos en cola y conserva la pose al pausar", async ({
  page,
}) => {
  await page.goto("/mascots.html");
  const art = page.locator(".bulldog-character");
  await page
    .getByRole("button", { name: "Dar la patita", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Inclinar la cabeza", exact: true })
    .click();
  await expect(art).toHaveAttribute("data-motion", "wave");
  await page.waitForTimeout(900);
  await page
    .getByRole("button", { name: "Pausar movimiento", exact: true })
    .click();
  const paused = await art.screenshot();
  await page.waitForTimeout(300);
  expect(await art.screenshot()).toEqual(paused);
  await page
    .getByRole("button", { name: "Continuar movimiento", exact: true })
    .click();
  await expect(art).toHaveAttribute("data-motion", "look", { timeout: 5000 });
  await page.waitForTimeout(700);
  await expect(art).toHaveAttribute("data-motion", "look");
  await expect(art).toHaveAttribute("data-motion", "idle", { timeout: 5000 });
});

test("estados de ánimo, perfiles, temas, móvil y movimiento reducido del bulldog", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/mascots.html");
  const art = page.locator(".bulldog-character");
  await expect(page.locator("canvas")).toHaveCount(0);
  const moving = await art.screenshot();
  await page.waitForTimeout(350);
  expect(await art.screenshot()).not.toEqual(moving);
  await page
    .getByRole("button", { name: "Pausar movimiento", exact: true })
    .click();
  await page.setViewportSize({ width: 412, height: 915 });
  for (const mood of ["Neutral", "Contento", "Triste suave", "Festejando"]) {
    await page.getByRole("button", { name: mood, exact: true }).click();
    await page.screenshot({
      path: test.info().outputPath(`bulldog-${mood}.png`),
    });
  }
  for (const profile of ["Luca", "Ari"]) {
    await page.getByRole("button", { name: profile, exact: true }).click();
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
        if (width === 412 || width === 1280)
          await page.screenshot({
            path: test
              .info()
              .outputPath(`${profile}-${dark ? "dark" : "light"}-${width}.png`),
          });
      }
    }
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(
    page.getByRole("button", { name: "Movimiento reducido", exact: true }),
  ).toBeDisabled();
  const still = await art.screenshot();
  await page.waitForTimeout(250);
  expect(await art.screenshot()).toEqual(still);
  expect(errors).toEqual([]);
});
