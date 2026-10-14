import { CLOUD_MAX_PLAIN_BYTES } from "./cloudContract";

export function toHex(bytes: Uint8Array) {
  return [...bytes].map((v) => v.toString(16).padStart(2, "0")).join("");
}
export function fromHex(value: string) {
  if (!/^(?:[a-f0-9]{2})+$/.test(value)) throw new Error("Clave inválida.");
  return Uint8Array.from(value.match(/../g)!, (part) => parseInt(part, 16));
}
export function toBase64(bytes: Uint8Array) {
  let value = "";
  for (let i = 0; i < bytes.length; i += 8192)
    value += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(value);
}
export function fromBase64(value: string) {
  return Uint8Array.from(atob(value), (ch) => ch.charCodeAt(0));
}
export function randomSalt() {
  return toHex(crypto.getRandomValues(new Uint8Array(16)));
}
export async function deriveCloudKeys(password: string, salt: string) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        iterations: 600000,
        salt: fromHex(salt),
      },
      material,
      512,
    ),
  );
  return {
    auth: toHex(bits.slice(0, 32)),
    encryptionKey: toHex(bits.slice(32)),
  };
}
export async function digestBytes(bytes: Uint8Array) {
  return toHex(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes.slice())),
  );
}
export async function encryptCloud(
  text: string,
  key: string,
  profileId: string,
) {
  const plain = new TextEncoder().encode(text);
  if (plain.length > CLOUD_MAX_PLAIN_BYTES)
    throw new Error(
      "El respaldo supera 100 MB. Exportá un backup y revisá las fotos antes de continuar.",
    );
  const compressed = await new Response(
    new Blob([plain]).stream().pipeThrough(new CompressionStream("gzip")),
  ).arrayBuffer();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    fromHex(key),
    "AES-GCM",
    false,
    ["encrypt"],
  );
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
        additionalData: new TextEncoder().encode(
          `NutriDuo/cloud/v1/${profileId}`,
        ),
      },
      cryptoKey,
      compressed,
    ),
  );
  return { encrypted, iv: toHex(iv), digest: await digestBytes(encrypted) };
}
export async function decryptCloud(
  encrypted: Uint8Array,
  key: string,
  iv: string,
  profileId: string,
) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    fromHex(key),
    "AES-GCM",
    false,
    ["decrypt"],
  );
  let compressed: ArrayBuffer;
  try {
    compressed = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: fromHex(iv),
        additionalData: new TextEncoder().encode(
          `NutriDuo/cloud/v1/${profileId}`,
        ),
      },
      cryptoKey,
      encrypted.slice(),
    );
  } catch {
    throw new Error(
      "No se pudo descifrar la copia. Revisá la contraseña o el archivo de recuperación.",
    );
  }
  const reader = new Blob([compressed])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"))
    .getReader();
  const decoder = new TextDecoder();
  let text = "",
    size = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > CLOUD_MAX_PLAIN_BYTES) {
      await reader.cancel();
      throw new Error("El respaldo excede el tamaño permitido.");
    }
    text += decoder.decode(part.value, { stream: true });
  }
  return text + decoder.decode();
}
