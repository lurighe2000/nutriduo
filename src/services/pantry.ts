// Syncs "Productos de la casa" between this profile's foods and the shared list.
import { meta, repository } from "../db";
import type { Food, ProfileId } from "../schemas";
import { cloudRequest } from "./cloudBackup";
import { sharedProductSchema, type SharedProduct } from "./pantryContract";

export function toShared(food: Food, profileId: ProfileId): SharedProduct {
  return sharedProductSchema.parse({
    id: food.id.slice(0, 64),
    barcode: /^\d{8,14}$/.test(food.barcode) ? food.barcode : "",
    name: food.name,
    brand: food.brand.slice(0, 150),
    quantity: food.quantity,
    category: food.category,
    image: food.image,
    servingSize: food.servingSize,
    unit: food.unit,
    per100: food.per100,
    sugars: food.sugars,
    saturatedFat: food.saturatedFat,
    sodiumMg:
      food.micronutrientsPer100?.sodium_mg ??
      (food.sodium !== undefined ? food.sodium * 1000 : undefined),
    fiberKnown: food.fiberKnown,
    ingredients: food.ingredients,
    allergens: food.allergens,
    nutriScore: food.nutriScore,
    nova: food.nova,
    source: food.sourceUrl.includes("openfoodfacts")
      ? "openfoodfacts"
      : "manual",
    verified: food.verified,
    addedBy: food.sharedBy ?? profileId,
    updatedAt: food.updatedAt,
  });
}

export function fromShared(
  product: SharedProduct,
  profileId: ProfileId,
  existing?: Food,
): Food {
  const sodium =
    product.sodiumMg !== undefined ? product.sodiumMg / 1000 : undefined;
  return {
    ...(existing ?? meta(profileId)),
    profileId,
    updatedAt: product.updatedAt,
    name: product.name,
    brand: product.brand,
    barcode: product.barcode,
    source: "barcode",
    per100: product.per100,
    servingSize: product.servingSize,
    unit: product.unit,
    verified: product.verified,
    favorite: existing?.favorite ?? false,
    sourceUrl:
      product.source === "openfoodfacts" && product.barcode
        ? `https://world.openfoodfacts.org/product/${product.barcode}`
        : "",
    sugars: product.sugars,
    saturatedFat: product.saturatedFat,
    sodium,
    fiberKnown: product.fiberKnown,
    micronutrientsPer100:
      product.sodiumMg === undefined
        ? existing?.micronutrientsPer100
        : { ...existing?.micronutrientsPer100, sodium_mg: product.sodiumMg },
    nutritionReference:
      product.source === "openfoodfacts" && product.barcode
        ? {
            source: "openfoodfacts",
            id: product.barcode,
            description: product.name,
          }
        : existing?.nutritionReference,
    quantity: product.quantity,
    category: product.category,
    image: product.image,
    ingredients: product.ingredients,
    allergens: product.allergens,
    nutriScore: product.nutriScore,
    nova: product.nova,
    sharedBy: product.addedBy,
  };
}

const sameKey = (food: Food, product: SharedProduct) =>
  product.barcode ? food.barcode === product.barcode : food.id === product.id;
function safeShared(food: Food, profileId: ProfileId) {
  try {
    return toShared(food, profileId);
  } catch {
    return undefined;
  }
}
/** Label content only, so re-saving the same data never ping-pongs. */
const content = (p: SharedProduct) =>
  JSON.stringify({ ...p, id: "", addedBy: "", updatedAt: "" });

/** Two-way merge; when the label data differs, the newest version wins. */
export async function syncPantry(profileId: ProfileId) {
  const repo = repository(profileId);
  const data = (await cloudRequest(profileId, "pantry", { action: "read" })) as
    { products?: unknown[] } | undefined;
  if (!data) return { shared: false, added: 0 };
  const remote = (data.products ?? []).flatMap((p) => {
    const parsed = sharedProductSchema.safeParse(p);
    return parsed.success ? [parsed.data] : [];
  });
  const local = (await repo.list("foods")).filter(
    (f) => f.source === "barcode",
  );
  let added = 0;
  const push: Food[] = [];
  for (const product of remote) {
    const mine = local.find((f) => sameKey(f, product));
    if (!mine) {
      await repo.save("foods", fromShared(product, profileId));
      added++;
    } else {
      const ours = safeShared(mine, profileId);
      if (!ours || content(ours) === content(product)) continue;
      if (mine.updatedAt < product.updatedAt)
        await repo.save("foods", fromShared(product, profileId, mine));
      else push.push(mine);
    }
  }
  for (const food of local)
    if (!remote.some((p) => sameKey(food, p))) push.push(food);
  const outgoing = push.flatMap((f) => safeShared(f, profileId) ?? []);
  for (let i = 0; i < outgoing.length; i += 100)
    await cloudRequest(profileId, "pantry", {
      action: "save",
      products: outgoing.slice(i, i + 100),
    });
  return { shared: true, added };
}

/** Saves a product locally and, when the account is active, for both profiles. */
export async function saveProduct(profileId: ProfileId, food: Food) {
  const next = { ...food, updatedAt: new Date().toISOString() };
  await repository(profileId).save("foods", next);
  try {
    const sent = await cloudRequest(profileId, "pantry", {
      action: "save",
      products: [toShared(next, profileId)],
    });
    return { food: next, shared: Boolean(sent) };
  } catch {
    return { food: next, shared: false };
  }
}
