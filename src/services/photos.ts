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
    return canvas.toDataURL("image/jpeg", quality);
  };
  const image = encode(1440, 0.78),
    thumbnail = encode(320, 0.65);
  bitmap.close();
  return { image, thumbnail };
}
