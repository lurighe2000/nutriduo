import { describe, expect, it } from "vitest";
import { decryptCloud, deriveCloudKeys, encryptCloud, randomSalt } from "./cloudCrypto";
describe("copias cifradas", () => {
  it("separa autenticación y cifrado; la misma cuenta se puede recuperar sin almacenamiento local", async () => {
    const salt = randomSalt();
    const keys = await deriveCloudKeys("una contraseña larga de prueba", salt);
    const restored = await deriveCloudKeys("una contraseña larga de prueba", salt);
    expect(restored).toEqual(keys);
    expect(keys.auth).not.toBe(keys.encryptionKey);
    const payload = JSON.stringify({ meals: ["ayer", "hoy"], photo: "imagen privada" });
    const encrypted = await encryptCloud(payload, keys.encryptionKey, "ari");
    expect(new TextDecoder().decode(encrypted.encrypted)).not.toContain("imagen privada");
    expect(await decryptCloud(encrypted.encrypted, restored.encryptionKey, encrypted.iv, "ari")).toBe(payload);
    await expect(decryptCloud(encrypted.encrypted, restored.encryptionKey, encrypted.iv, "luca")).rejects.toThrow("descifrar");
    const altered = encrypted.encrypted.slice(); altered[0] ^= 1;
    await expect(decryptCloud(altered, restored.encryptionKey, encrypted.iv, "ari")).rejects.toThrow("descifrar");
    const wrong = await deriveCloudKeys("una contraseña que no coincide", salt);
    await expect(decryptCloud(encrypted.encrypted, wrong.encryptionKey, encrypted.iv, "ari")).rejects.toThrow("descifrar");
  });
});
