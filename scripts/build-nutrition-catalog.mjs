import { build } from "esbuild";
import JSZip from "jszip";
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
// Reproducible public-data snapshot. No API keys, user photos or profile data.
const sources = [
  "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_json_2026-04-30.zip",
  "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_survey_food_json_2024-10-31.zip",
];
await build({
  entryPoints: ["worker/index.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: ".wrangler/catalog-mapper.mjs",
});
const { mapUSDA } = await import(
  pathToFileURL(resolve(".wrangler/catalog-mapper.mjs")).href
);
const results = await Promise.allSettled(
  sources.map(async (url) => {
    const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`USDA download ${response.status}`);
    const zip = await JSZip.loadAsync(await response.arrayBuffer());
    const entry = Object.values(zip.files).find(
      (f) => f.name.endsWith(".json") && !f.dir,
    );
    if (!entry) throw new Error("El archivo oficial no contiene JSON.");
    const data = JSON.parse(await entry.async("string"));
    return Object.values(data).find(Array.isArray);
  }),
);
const records = new Map();
const categories =
  /^(rice|chicken|beef|egg|milk|yogurt|cheese|bread|pasta|potato|oat|banana|apple|orange|lentil|bean|oil|tomato|lettuce|carrot|peanut|almond|walnut|fish|pork|spinach|broccoli|onion|butter|tuna|salmon|water|coffee|tea|strawberr|grape|avocado|sugar|salt|cucumber|squash)/i;
for (const result of results) {
  if (result.status === "rejected") throw result.reason;
  if (!result.value) throw new Error("Formato de descarga desconocido.");
  for (const food of result.value) {
    if (
      !food ||
      typeof food.description !== "string" ||
      !categories.test(food.description) ||
      food.description.length > 100
    )
      continue;
    const foodNutrients = (food.foodNutrients ?? [])
      .filter(
        (n) =>
          Number.isFinite(n.amount) &&
          n.amount >= 0 &&
          n.nutrient?.id &&
          n.nutrient?.unitName,
      )
      .map((n) => ({
        nutrientId: n.nutrient.id,
        unitName: n.nutrient.unitName,
        value: n.amount,
      }));
    const mapped = mapUSDA({
      foods: [
        { fdcId: food.fdcId, description: food.description, foodNutrients },
      ],
    })[0];
    if (mapped) records.set(mapped.nutritionReference.id, mapped);
  }
}
if (records.size < 80)
  throw new Error("Catálogo insuficiente; no se reemplazó la copia anterior.");
const snapshot = {
  source: "USDA FoodData Central",
  license: "CC0-1.0",
  sources,
  foods: [...records.values()].sort((a, b) => a.name.localeCompare(b.name)),
};
await writeFile(
  "worker/nutrition-catalog.json",
  JSON.stringify(snapshot) + "\n",
  "utf8",
);
console.log(
  JSON.stringify({
    source: snapshot.source,
    foods: snapshot.foods.length,
    bytes: JSON.stringify(snapshot).length,
  }),
);
