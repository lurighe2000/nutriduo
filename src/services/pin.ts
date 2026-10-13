import { db } from "../db";
import type { ProfileId } from "../schemas";
const hex = (v: ArrayBuffer) =>
  Array.from(new Uint8Array(v))
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
async function hash(pin: string, salt: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return hex(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: new TextEncoder().encode(salt),
        iterations: 600000,
        hash: "SHA-256",
      },
      key,
      256,
    ),
  );
}
export async function setPin(id: ProfileId, pin: string, oldPin?: string) {
  if (!/^\d{4}$/.test(pin)) throw new Error("Usá exactamente 4 dígitos.");
  const p = await db.profiles.get(id);
  if (!p) throw new Error("Perfil no encontrado.");
  if (p.pinHash) {
    if (!oldPin) throw new Error("Ingresá el PIN actual.");
    await verifyPin(id, oldPin);
  }
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  const pinHash = await hash(pin, salt);
  await db.profiles.update(id, {
    pinHash,
    pinSalt: salt,
    failedAttempts: 0,
    lockedUntil: 0,
  });
}
export async function verifyPin(id: ProfileId, pin: string) {
  const p = await db.profiles.get(id);
  if (!p?.pinHash || !p.pinSalt) throw new Error("Configurá un PIN primero.");
  if (p.lockedUntil > Date.now())
    throw new Error(
      `Probá de nuevo en ${Math.ceil((p.lockedUntil - Date.now()) / 1000)} segundos.`,
    );
  const value = await hash(pin, p.pinSalt);
  let diff = value.length ^ p.pinHash.length;
  for (let i = 0; i < value.length; i++)
    diff |= value.charCodeAt(i) ^ p.pinHash.charCodeAt(i);
  if (diff) {
    const attempts = p.failedAttempts + 1;
    await db.profiles.update(id, {
      failedAttempts: attempts,
      lockedUntil: attempts >= 5 ? Date.now() + 60000 : 0,
    });
    throw new Error(
      attempts >= 5
        ? "Cinco intentos incorrectos. Esperá un minuto."
        : "El PIN no coincide.",
    );
  }
  await db.profiles.update(id, { failedAttempts: 0, lockedUntil: 0 });
}
