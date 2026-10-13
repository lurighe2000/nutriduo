import { z } from "zod";
import { meta, repository } from "../db";
import type { Food, ProfileId } from "../schemas";
const responseSchema = z.object({
  status: z.number(),
  product: z
    .object({
      product_name: z.string().optional(),
      brands: z.string().optional(),
      serving_quantity: z.number().optional(),
      nutriments: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
});
export async function lookupProduct(
  profileId: ProfileId,
  barcode: string,
): Promise<Food> {
  if (!/^\d{8,14}$/.test(barcode))
    throw new Error("Ingresá entre 8 y 14 dígitos.");
  const repo = repository(profileId);
  const cached = (await repo.list("foods")).find((f) => f.barcode === barcode);
  if (cached) return cached;
  if (!navigator.onLine)
    throw new Error("Sin conexión. Podés cargar la etiqueta manualmente.");
  const response = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=product_name,brands,nutriments,serving_quantity`,
    { signal: AbortSignal.timeout(10000) },
  );
  if (!response.ok)
    throw new Error("Open Food Facts no responde. Probá cargar la etiqueta.");
  const data = responseSchema.parse(await response.json());
  if (data.status !== 1 || !data.product)
    throw new Error("Producto no encontrado. Podés cargarlo manualmente.");
  const p = data.product,
    n = p.nutriments ?? {};
  const get = (key: string) =>
    typeof n[key] === "number" && Number.isFinite(n[key]) && Number(n[key]) >= 0
      ? Number(n[key])
      : undefined;
  const calories =
    get("energy-kcal_100g") ??
    (get("energy_100g") !== undefined
      ? Number(get("energy_100g")) / 4.184
      : undefined);
  if (
    calories === undefined ||
    get("proteins_100g") === undefined ||
    get("carbohydrates_100g") === undefined ||
    get("fat_100g") === undefined
  )
    throw new Error(
      "La ficha no tiene todos los macros. Completá la etiqueta manualmente.",
    );
  return {
    ...meta(profileId),
    name: p.product_name || "Producto sin nombre",
    brand: p.brands ?? "",
    barcode,
    source: "barcode",
    per100: {
      calories,
      protein: get("proteins_100g")!,
      carbs: get("carbohydrates_100g")!,
      fat: get("fat_100g")!,
      fiber: get("fiber_100g") ?? 0,
    },
    servingSize: p.serving_quantity || 100,
    unit: "g",
    verified: false,
    favorite: false,
    sourceUrl: `https://world.openfoodfacts.org/product/${barcode}`,
    sugars: get("sugars_100g"),
    saturatedFat: get("saturated-fat_100g"),
    sodium: get("sodium_100g"),
    salt: get("salt_100g"),
  };
}
