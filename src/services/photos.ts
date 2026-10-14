import type { Meal } from "../schemas";

export function mealPhotos(meal?: Pick<Meal, "photo" | "photos">): string[] {
  return meal?.photos ?? (meal?.photo ? [meal.photo] : []);
}

function boundedJPEG(canvas: HTMLCanvasElement, initialQuality = 0.88) {
  const maxLength = 2000000;
  let quality = initialQuality;
  let image = canvas.toDataURL("image/jpeg", quality);
  while (image.length > maxLength) {
    if (quality > 0.55) quality -= 0.1;
    else {
      const smaller = document.createElement("canvas");
      smaller.width = Math.max(1, Math.round(canvas.width * 0.85));
      smaller.height = Math.max(1, Math.round(canvas.height * 0.85));
      const context = smaller.getContext("2d");
      if (!context) throw new Error("No se pudo procesar la foto.");
      context.drawImage(canvas, 0, 0, smaller.width, smaller.height);
      canvas = smaller;
      quality = 0.78;
    }
    image = canvas.toDataURL("image/jpeg", quality);
  }
  return image;
}

// The free AI quota is measured in tokens per minute and every image pixel
// costs tokens. Food and labels stay readable at ~1024 px, so the analysis
// always sends at most two small images. Contact sheets include every photo
// in one meal request; saved originals remain separate and are never replaced.
export const ANALYSIS_MAX_SIDE = 1024;
const SHEET_MAX_SIDE = 1280;
async function analysisImage(photo: string) {
  const bitmap = await createImageBitmap(await (await fetch(photo)).blob());
  try {
    const ratio = Math.min(
      1,
      ANALYSIS_MAX_SIDE / Math.max(bitmap.width, bitmap.height),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo procesar la foto.");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return boundedJPEG(canvas, 0.8);
  } finally {
    bitmap.close();
  }
}
export async function analysisPhotos(photos: string[], signal?: AbortSignal) {
  if (photos.length <= 2) {
    const images: string[] = [];
    for (const photo of photos) {
      signal?.throwIfAborted();
      images.push(await analysisImage(photo));
    }
    return images;
  }
  const sheets: string[] = [];
  for (let start = 0; start < photos.length;) {
    signal?.throwIfAborted();
    const count = Math.ceil((photos.length - start) / (2 - sheets.length));
    const columns = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / columns);
    const tile = Math.min(
      ANALYSIS_MAX_SIDE,
      Math.floor(SHEET_MAX_SIDE / Math.max(columns, rows)),
    );
    const canvas = document.createElement("canvas");
    canvas.width = columns * tile;
    canvas.height = rows * tile;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudieron preparar las fotos.");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < count; index++) {
      signal?.throwIfAborted();
      const bitmap = await createImageBitmap(
        await (await fetch(photos[start + index])).blob(),
      );
      try {
        const x = (index % columns) * tile,
          y = Math.floor(index / columns) * tile;
        const labelHeight = Math.max(22, Math.round(tile * 0.05));
        const ratio = Math.min(
          tile / bitmap.width,
          (tile - labelHeight) / bitmap.height,
        );
        const width = bitmap.width * ratio,
          height = bitmap.height * ratio;
        ctx.drawImage(
          bitmap,
          x + (tile - width) / 2,
          y + labelHeight + (tile - labelHeight - height) / 2,
          width,
          height,
        );
        ctx.fillStyle = "black";
        ctx.font = `${Math.round(labelHeight * 0.75)}px sans-serif`;
        ctx.fillText(`Foto ${start + index + 1}`, x + 6, y + labelHeight * 0.8);
      } finally {
        bitmap.close();
      }
    }
    sheets.push(boundedJPEG(canvas, 0.82));
    start += count;
  }
  return sheets;
}

export async function compressPhoto(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Elegí una imagen.");
  if (file.size > 25000000)
    throw new Error("La foto debe pesar menos de 25 MB.");
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  const encode = (max: number, quality: number) => {
    const ratio = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * ratio);
    canvas.height = Math.round(bitmap.height * ratio);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo procesar la foto.");
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return boundedJPEG(canvas, quality);
  };
  try {
    const image = encode(1440, 0.78),
      thumbnail = encode(320, 0.65);
    return { image, thumbnail };
  } finally {
    bitmap.close();
  }
}
