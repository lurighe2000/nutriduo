import { readFile, writeFile } from "node:fs/promises";
import JSZip from "jszip";
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
const catalog = JSON.parse(await readFile("worker/nutrition-catalog.json", "utf8"));
const specs = [
  ["oats", "2708489", "Avena", "seca", "Cereales", ["avena"]],
  ["milk", "2705387", "Leche descremada 1%", "lista para consumir", "Lácteos", ["leche", "lacteos"]],
  ["yogurt", "2705419", "Yogur natural descremado", "listo para consumir", "Lácteos", ["yogur", "lacteos"]],
  ["bread", "2707709", "Pan integral", "listo para consumir", "Cereales", ["pan", "trigo", "gluten"]],
  ["rice", "2512381", "Arroz blanco", "seco", "Cereales", ["arroz"]],
  ["brownRice", "2512380", "Arroz integral", "seco", "Cereales", ["arroz"]],
  ["chicken", "2646170", "Pechuga de pollo sin piel", "cruda", "Carnes y huevos", ["pollo", "carne"]],
  ["beef", "746760", "Carne vacuna magra (peceto)", "cruda", "Carnes y huevos", ["carne", "carne vacuna"]],
  ["egg", "2707152", "Huevo entero, sin cáscara", "crudo; cocinar", "Carnes y huevos", ["huevo"]],
  ["lentils", "2644283", "Lentejas", "secas", "Legumbres", ["lentejas", "legumbres"]],
  ["banana", "2709224", "Banana, sin cáscara", "cruda", "Frutas y verduras", ["banana", "fruta"]],
  ["apple", "2709215", "Manzana, parte comestible", "cruda", "Frutas y verduras", ["manzana", "fruta"]],
  ["tomato", "2709719", "Tomate", "crudo", "Frutas y verduras", ["tomate", "verduras"]],
  ["carrot", "2709660", "Zanahoria", "cruda", "Frutas y verduras", ["zanahoria", "verduras"]],
  ["potato", "2346403", "Papa sin cáscara", "cruda", "Frutas y verduras", ["papa"]],
  ["lettuce", "2709789", "Lechuga", "cruda", "Frutas y verduras", ["lechuga", "verduras"]],
  ["peanuts", "2515376", "Maní sin sal", "crudo; puede tostarse sin aceite", "Almacén", ["mani", "frutos secos"]],
  ["tuna", "2706311", "Atún en lata escurrido", "listo para consumir", "Carnes y huevos", ["atun"]],
  ["creamCheese", "2705775", "Queso untable (referencia genérica)", "listo para consumir", "Lácteos", ["queso", "lacteos"]],
  ["riceCake", "2708162", "Galletas de arroz", "listas para consumir", "Cereales", ["arroz"]],
];
const foods = specs.map(([key, id, name, weighing, category, tags]) => {
  const reference = catalog.foods.find(f => f.nutritionReference.id === id);
  if (!reference) throw Error(`Missing official food ${id}`);
  return { ...reference, key, name, weighing, category, tags };
});
// This food is outside the broad search catalog's category filter.
const url = catalog.sources.find(s => s.includes("survey_food"));
const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
if (!response.ok) throw Error(`USDA download ${response.status}`);
const zip = await JSZip.loadAsync(await response.arrayBuffer());
const entry = Object.values(zip.files).find(f => f.name.endsWith(".json") && !f.dir);
const raw = Object.values(JSON.parse(await entry.async("string"))).find(Array.isArray);
const olive = raw.find(f => /^olive oil$/i.test(f.description));
if (!olive) throw Error("No official olive oil record found");
await build({ entryPoints: ["worker/index.ts"], bundle: true, platform: "node", format: "esm", outfile: ".wrangler/menu-mapper.mjs" });
const { mapUSDA } = await import(pathToFileURL(resolve(".wrangler/menu-mapper.mjs")).href);
const [mapped] = mapUSDA({ foods: [{ fdcId: olive.fdcId, description: olive.description,
  foodNutrients: olive.foodNutrients.filter(n => Number.isFinite(n.amount) && n.amount >= 0 && n.nutrient?.id).map(n => ({ nutrientId: n.nutrient.id, unitName: n.nutrient.unitName, value: n.amount })) }] });
if (!mapped) throw Error("Invalid olive oil nutrients");
foods.push({ ...mapped, key: "oil", name: "Aceite de oliva", weighing: "tal como se usa", category: "Almacén", tags: ["aceite", "oliva"] });
await writeFile("src/nutrition/menu-foods.json", JSON.stringify({ source: catalog.source, license: catalog.license, sources: catalog.sources, foods }) + "\n", "utf8");
console.log(JSON.stringify({ foods: foods.length, source: catalog.source }));
