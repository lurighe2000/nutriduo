import { z } from "zod";
import { aiSchema, type Profile, type Item } from "../schemas";
import { scale } from "../nutrition/formulas";
export function parseAnalysis(text: string, repair = false) {
  let raw = text.trim();
  if (repair) {
    raw = raw
      .replace(/^```(?:json)?\s*/, "")
      .replace(/\s*```$/, "")
      .replace(/,\s*([}\]])/g, "$1");
  }
  return aiSchema.parse(JSON.parse(raw));
}
export function aiItems(data: z.infer<typeof aiSchema>): Item[] {
  return data.foods.map((f) => ({
    id: crypto.randomUUID(),
    name: f.name,
    grams: f.estimated_grams,
    per100: scale(
      {
        calories: f.calories,
        protein: f.protein_g,
        carbs: f.carbs_g,
        fat: f.fat_g,
        fiber: f.fiber_g ?? 0,
      },
      100 / f.estimated_grams,
    ),
    source: "ai_estimated",
    confidence: f.confidence,
    cooking: "",
  }));
}
export function aiPrompt(p: Profile) {
  return `Analizá la fotografía de esta comida. Usuario: ${p.name}. Objetivo: ${p.goal === "gain" ? "ganancia muscular controlada" : "reducción de grasa preservando masa muscular"}. Identificá alimentos visibles. Estimá gramos sólo cuando sea razonable y expresá incertidumbre. Prestá atención a aceite, salsas, bebidas, empanizados, quesos y cocción. No inventes ingredientes invisibles. Preguntá lo que falte. Los valores nutricionales deben corresponder a la cantidad estimada de cada componente, NO a 100 g. No diagnostiques. Devolvé exclusivamente JSON conforme a este schema completo:\n${JSON.stringify(z.toJSONSchema(aiSchema), null, 2)}`;
}
