import { z } from "zod";
import { meta, repository } from "../db";
import type { Food, ProfileId } from "../schemas";

const responseSchema = z.object({
  status: z.number(),
  product: z
    .object({
      product_name: z.string().optional(),
      product_name_es: z.string().optional(),
      brands: z.string().optional(),
      quantity: z.string().optional(),
      serving_quantity: z.union([z.number(), z.string()]).optional(),
      nutriments: z.record(z.string(), z.unknown()).optional(),
      image_front_small_url: z.string().optional(),
      image_front_url: z.string().optional(),
      ingredients_text_es: z.string().optional(),
      ingredients_text: z.string().optional(),
      allergens_tags: z.array(z.string()).optional(),
      nutriscore_grade: z.string().optional(),
      nova_group: z.union([z.number(), z.string()]).optional(),
    })
    .optional(),
});

const ALLERGENS: Record<string, string> = {
  gluten: "Gluten",
  milk: "Leche",
  eggs: "Huevo",
  nuts: "Frutos secos",
  peanuts: "Maní",
  soybeans: "Soja",
  fish: "Pescado",
  crustaceans: "Crustáceos",
  molluscs: "Moluscos",
  "sesame-seeds": "Sésamo",
  celery: "Apio",
  mustard: "Mostaza",
  lupin: "Lupino",
  "sulphur-dioxide-and-sulphites": "Sulfitos",
};

export class ProductNotFound extends Error {
  constructor(readonly barcode: string) {
    super("No encontramos este producto. Podés cargarlo con su etiqueta.");
  }
}

/** EAN-8, EAN-13, UPC-A and GTIN-14 check digit. */
export function validBarcode(code: string) {
  if (!/^(\d{8}|\d{12,14})$/.test(code)) return false;
  const digits = [...code].map(Number);
  const check = digits.pop()!;
  const sum = digits
    .reverse()
    .reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** Product data from Open Food Facts; `missing` lists macros the label lacks. */
export async function fetchProduct(profileId: ProfileId, barcode: string) {
  if (!navigator.onLine)
    throw new Error("Sin conexión. Podés cargar la etiqueta a mano.");
  const fields = [
    "product_name",
    "product_name_es",
    "brands",
    "quantity",
    "serving_quantity",
    "nutriments",
    "image_front_small_url",
    "image_front_url",
    "ingredients_text_es",
    "ingredients_text",
    "allergens_tags",
    "nutriscore_grade",
    "nova_group",
  ].join(",");
  const response = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?lc=es&fields=${fields}`,
    { signal: AbortSignal.timeout(10000) },
  );
  if (response.status === 404) throw new ProductNotFound(barcode);
  if (!response.ok)
    throw new Error("Open Food Facts no responde. Probá en un rato.");
  const data = responseSchema.parse(await response.json());
  if (data.status !== 1 || !data.product) throw new ProductNotFound(barcode);
  const p = data.product;
  const n = p.nutriments ?? {};
  const get = (key: string) => {
    const v = Number(n[key]);
    return n[key] !== undefined && n[key] !== "" && Number.isFinite(v) && v >= 0
      ? v
      : undefined;
  };
  const calories =
    get("energy-kcal_100g") ??
    (get("energy_100g") !== undefined
      ? get("energy_100g")! / 4.184
      : undefined);
  const missing = [
    calories === undefined && "calorías",
    get("proteins_100g") === undefined && "proteínas",
    get("carbohydrates_100g") === undefined && "carbohidratos",
    get("fat_100g") === undefined && "grasas",
  ].filter(Boolean) as string[];
  const sodium =
    get("sodium_100g") ??
    (get("salt_100g") !== undefined ? get("salt_100g")! / 2.5 : undefined);
  const image = p.image_front_small_url || p.image_front_url;
  const serving = Number(p.serving_quantity);
  const name =
    (p.product_name_es || p.product_name || "").trim() || "Producto sin nombre";
  const grade = p.nutriscore_grade?.toLowerCase();
  const nova = Number(p.nova_group);
  const food: Food = {
    ...meta(profileId),
    name: name.slice(0, 150),
    brand: (p.brands ?? "").split(",")[0].trim().slice(0, 150),
    barcode,
    source: "barcode",
    per100: {
      calories: Math.round((calories ?? 0) * 10) / 10,
      protein: get("proteins_100g") ?? 0,
      carbs: get("carbohydrates_100g") ?? 0,
      fat: get("fat_100g") ?? 0,
      fiber: get("fiber_100g") ?? 0,
    },
    servingSize: serving > 0 && serving <= 10000 ? serving : 100,
    unit: /\b(ml|l|cl)\b/i.test(p.quantity ?? "") ? "ml" : "g",
    verified: false,
    favorite: false,
    sourceUrl: `https://world.openfoodfacts.org/product/${barcode}`,
    sugars: get("sugars_100g"),
    saturatedFat: get("saturated-fat_100g"),
    sodium,
    salt: get("salt_100g"),
    fiberKnown: get("fiber_100g") !== undefined,
    micronutrientsPer100:
      sodium === undefined ? undefined : { sodium_mg: sodium * 1000 },
    nutritionReference: {
      source: "openfoodfacts",
      id: barcode,
      description: name.slice(0, 150),
    },
    quantity: p.quantity?.slice(0, 60) || undefined,
    image:
      image && /^https:\/\//.test(image) && image.length <= 500
        ? image
        : undefined,
    ingredients:
      (p.ingredients_text_es || p.ingredients_text || "")
        .trim()
        .slice(0, 2000) || undefined,
    allergens: p.allergens_tags?.length
      ? [
          ...new Set(
            p.allergens_tags.map((t) => {
              const k = t.replace(/^[a-z]{2}:/, "");
              return ALLERGENS[k] ?? k;
            }),
          ),
        ].slice(0, 30)
      : undefined,
    nutriScore:
      grade && /^[a-e]$/.test(grade)
        ? (grade as Food["nutriScore"])
        : undefined,
    nova: nova >= 1 && nova <= 4 ? nova : undefined,
    sharedBy: profileId,
  };
  return { food, missing };
}

/** Local product first (scanned before by either profile), then Open Food Facts. */
export async function findProduct(profileId: ProfileId, barcode: string) {
  const code = barcode.trim();
  if (!/^\d{8,14}$/.test(code))
    throw new Error("Ingresá entre 8 y 14 dígitos.");
  const cached = (await repository(profileId).list("foods")).find(
    (f) => f.barcode === code,
  );
  if (cached) return { food: cached, missing: [] as string[], cached: true };
  return { ...(await fetchProduct(profileId, code)), cached: false };
}
