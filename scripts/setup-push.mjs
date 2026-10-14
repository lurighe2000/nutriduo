import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import webpush from "web-push";
const privatePath = resolve(".wrangler/nutriduo-vapid-private.json");
await mkdir(resolve(".wrangler"), { recursive: true });
let keys;
try {
  keys = JSON.parse(await readFile(privatePath, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  keys = webpush.generateVAPIDKeys();
  await writeFile(privatePath, JSON.stringify(keys), { mode: 0o600 });
}
const path = resolve("worker/wrangler.jsonc");
const config = JSON.parse(
  (await readFile(path, "utf8")).replace(/,\s*([}\]])/g, "$1"),
);
config.compatibility_flags = [
  ...new Set([...(config.compatibility_flags ?? []), "nodejs_compat"]),
];
config.vars.VAPID_PUBLIC_KEY = keys.publicKey;
config.vars.VAPID_SUBJECT = "https://github.com/lurighe2000/nutriduo/issues";
config.triggers = { crons: ["*/5 * * * *"] };
await writeFile(path, JSON.stringify(config, null, 2) + "\n");
if (process.argv.includes("--publish-secret")) {
  const result = spawnSync(
    process.execPath,
    [
      resolve("node_modules/wrangler/bin/wrangler.js"),
      "secret",
      "put",
      "VAPID_PRIVATE_KEY",
      "--config",
      path,
    ],
    { input: keys.privateKey + "\n", encoding: "utf8", windowsHide: true },
  );
  if (result.status !== 0)
    throw new Error(
      "No se pudo guardar el secreto VAPID en Cloudflare. La clave privada permanece local y no se imprimió.",
    );
  await writeFile(
    "C:/Users/lucar/Downloads/NutriDuo_Accesos_Notificaciones_2026-10-14.txt",
    `NutriDuo — claves privadas de notificaciones\nCuenta Cloudflare: la misma del análisis (ver el archivo privado NutriDuo_Accesos_2026-10-13.txt)\nServicio: https://nutriduo-ai.lucarighetti2000.workers.dev\nClave pública VAPID: ${keys.publicKey}\nClave privada VAPID (guardada como secreto en Cloudflare): ${keys.privateKey}\nConservar privado. No subir a GitHub ni pegar en la app. La app usa la clave pública; el envío se firma en el servidor.\n`,
  );
  console.log(
    "Clave privada de notificaciones guardada como secreto y respaldada en Downloads. No se imprimieron credenciales.",
  );
} else
  console.log(
    "Claves de notificaciones preparadas localmente. Clave privada fuera del repositorio; configuración pública lista.",
  );
