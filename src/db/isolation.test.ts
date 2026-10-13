import { beforeEach, afterAll, it, expect } from "vitest";
import { db, initialize, meta, repository } from "./index";
import { testProfiles as defaults } from "../test-profiles";
import { createBackup, parseBackup, restoreBackup } from "../services/backup";
import { targets } from "../nutrition/formulas";
import { setPin, verifyPin } from "../services/pin";
beforeEach(async () => {
  await db.delete();
  await db.open();
  await initialize();
  for (const p of defaults)
    await db.profiles.update(p.id, {
      ...p,
      onboarded: true,
      targets: targets(p, p.initialWeight),
    });
});
afterAll(async () => {
  await db.delete();
});
it("separa lecturas y bloquea writes cruzados", async () => {
  const luca = repository("luca"),
    ari = repository("ari");
  const row = { ...meta("luca"), date: "2026-09-17", kg: 60 };
  await luca.save("weights", row);
  expect(await ari.list("weights")).toHaveLength(0);
  await expect(ari.save("weights", row)).rejects.toThrow();
  await expect(
    ari.save("weights", { ...row, profileId: "ari" }),
  ).rejects.toThrow();
  await expect(ari.remove("weights", row.id)).rejects.toThrow();
  expect(await luca.list("weights")).toHaveLength(1);
});
it("valida, restaura y conserva otro perfil", async () => {
  const luca = repository("luca"),
    ari = repository("ari");
  const row = { ...meta("luca"), date: "2026-09-17", kg: 60 };
  await luca.save("weights", row);
  await ari.save("weights", { ...meta("ari"), date: "2026-09-17", kg: 69 });
  const backup = await createBackup("luca");
  await luca.remove("weights", row.id);
  await restoreBackup(backup, "luca");
  expect(await luca.list("weights")).toHaveLength(1);
  expect(await ari.list("weights")).toHaveLength(1);
  expect(() => parseBackup(JSON.stringify(backup), "ari")).toThrow(
    "otro perfil",
  );
});
it("rechaza backups con perfiles mezclados y fechas inválidas", async () => {
  const b = await createBackup("luca");
  b.data.weights.push({ ...meta("ari"), date: "2026-02-30", kg: 69 });
  expect(() => parseBackup(JSON.stringify(b), "luca")).toThrow();
});
it("revierte restauración entera si hay colisión de ID ajeno", async () => {
  const b = await createBackup("luca");
  const row = { ...meta("ari"), date: "2026-09-17", kg: 69 };
  await repository("ari").save("weights", row);
  b.data.weights.push({ ...row, profileId: "luca" });
  await expect(restoreBackup(b, "luca")).rejects.toThrow("otro perfil");
  expect((await repository("ari").list("weights"))[0].kg).toBe(69);
});
it("PIN se guarda derivado con salt y bloquea intentos", async () => {
  await setPin("luca", "1234");
  const p = await db.profiles.get("luca");
  expect(p?.pinHash).toHaveLength(64);
  expect(p?.pinHash).not.toBe("1234");
  expect(p?.pinSalt).toHaveLength(32);
  await verifyPin("luca", "1234");
  for (let i = 0; i < 5; i++)
    await expect(verifyPin("luca", "0000")).rejects.toThrow();
  await expect(verifyPin("luca", "1234")).rejects.toThrow("segundos");
  const b = await createBackup("luca");
  expect(JSON.stringify(b)).not.toContain("pinHash");
}, 15000);
