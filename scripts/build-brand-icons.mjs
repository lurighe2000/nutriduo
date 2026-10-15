import sharp from "sharp";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, URL } from "node:url";
import { Buffer } from "node:buffer";

// Deterministic size/format exports. Creative edits belong in the source artwork.
const source = new URL("../assets/brand/logo-source.png", import.meta.url);
const publicFile = (name) => new URL(`../public/${name}`, import.meta.url);
for (const [size, names] of [
  [192, ["icon-192-duo.png", "icon-192.png"]],
  [512, ["icon-512-duo.png", "icon-512.png"]],
  [180, ["apple-touch-icon-duo.png"]],
  [64, ["favicon-duo.png"]],
]) {
  const png = await sharp(fileURLToPath(source))
    .resize(size, size)
    .png({ palette: true, colours: 256, dither: 0.5 })
    .toBuffer();
  for (const name of names) await writeFile(publicFile(name), png);
}
const mark = await readFile(
  new URL("../assets/brand/notification-mark.svg", import.meta.url),
  "utf8",
);
// Rasterize the glyph only: untouched alpha outside the white shapes, no tile.
const badge = await sharp(Buffer.from(mark)).resize(96, 96).png().toBuffer();
await writeFile(publicFile("badge-duo.png"), badge);
// Notification images can be fetched outside the service worker's precache.
// Keep this small glyph self-contained, including when a push wakes an offline app.
const pushFile = publicFile("push-handler.js");
const pushHandler = await readFile(pushFile, "utf8");
const badgeDeclaration = /const NUTRIDUO_NOTIFICATION_BADGE =\s*"[^"]*";/;
if (!badgeDeclaration.test(pushHandler)) {
  throw new Error("Missing embedded notification badge declaration.");
}
await writeFile(
  pushFile,
  pushHandler.replace(
    badgeDeclaration,
    `const NUTRIDUO_NOTIFICATION_BADGE =\n  "data:image/png;base64,${badge.toString("base64")}";`,
  ),
);
const favicon = mark
  .replace(
    '<g fill="#fff">',
    '<rect width="128" height="128" rx="28" fill="#080d29"/><g fill="#5ccaff">',
  )
  .replace('<circle cx="88"', '<circle fill="#f47cae" cx="88"')
  .replace('<path d="M106', '<path fill="#f47cae" d="M106');
await writeFile(publicFile("favicon.svg"), favicon);
console.log("Exported app, Apple, favicon and transparent notification icons.");
