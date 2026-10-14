export const SOURCES = {
  bmr: "https://pubmed.ncbi.nlm.nih.gov/2305711/",
  protein: "https://pubmed.ncbi.nlm.nih.gov/28642676/",
  fiber:
    "https://nap.nationalacademies.org/catalog/10490/dietary-reference-intakes-for-energy-carbohydrate-fiber-fat-fatty-acids-cholesterol-protein-and-amino-acids",
};
export const SOURCE_LABELS = {
  manual: "Carga manual",
  label: "Etiqueta",
  barcode: "Open Food Facts",
  estimated: "Estimación",
  ai_estimated: "Estimación IA",
  verified: "Verificado",
  database: "Base nutricional · porción estimada",
};
export const MEAL_TYPES = [
  "Desayuno",
  "Almuerzo",
  "Merienda",
  "Cena",
  "Snack",
  "Pre-entreno",
  "Post-entreno",
  "Otro",
] as const;
