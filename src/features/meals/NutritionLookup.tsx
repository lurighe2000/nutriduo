import { useEffect, useRef, useState } from "react";
import { useApp } from "../../app/context";
import { Field, Button } from "../../components/ui";
import {
  currentAIConnection,
  searchNutrition,
} from "../../services/integratedAI";
import type { Item } from "../../schemas";
import type { NutrientFood } from "../../services/aiContract";
export default function NutritionLookup({
  item,
  onChange,
}: {
  item: Item;
  onChange: (i: Item) => void;
}) {
  const { profile } = useApp();
  const [query, setQuery] = useState(item.nutritionQuery ?? item.name),
    [results, setResults] = useState<NutrientFood[]>([]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  if (!currentAIConnection(profile.id)?.nutritionDatabase) return null;
  return (
    <details className="nutrition-lookup">
      <summary>Buscar una ficha nutricional</summary>
      <p className="muted small">
        Elegí el alimento y cocción que correspondan. USDA muestra sus nombres
        en inglés. La ficha reemplaza los macros y agrega los nutrientes
        disponibles; los gramos quedan como los indicaste.
      </p>
      <Field
        label={`Buscar ficha de ${item.name || "alimento"}`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        maxLength={150}
      />
      <Button
        secondary
        disabled={busy || query.trim().length < 2}
        onClick={() => {
          setBusy(true);
          setError("");
          setResults([]);
          const controller = new AbortController();
          abort.current = controller;
          void searchNutrition(profile.id, query, controller.signal)
            .then((foods) => {
              if (controller.signal.aborted) return;
              setResults(foods);
              if (!foods.length)
                setError(
                  "No hay una ficha completa. Podés usar la etiqueta o conservar la estimación.",
                );
            })
            .catch((e) => {
              if (!controller.signal.aborted)
                setError(e instanceof Error ? e.message : "No se pudo buscar.");
            })
            .finally(() => {
              if (!controller.signal.aborted) setBusy(false);
            });
        }}
      >
        {busy ? "Buscando…" : "Buscar en USDA"}
      </Button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {results.map((food) => (
        <button
          type="button"
          className="list-button"
          key={food.nutritionReference.id}
          onClick={() => {
            onChange({
              ...item,
              per100: food.per100,
              micronutrientsPer100: food.micronutrientsPer100,
              nutritionReference: food.nutritionReference,
              source: "database",
              fiberKnown: food.fiberKnown,
            });
            setResults([]);
          }}
        >
          <span>
            {food.name}
            <small>
              {food.per100.calories} kcal / 100 g ·{" "}
              {Object.keys(food.micronutrientsPer100).length} nutrientes
              adicionales{food.fiberKnown ? "" : " · fibra sin dato"}
            </small>
          </span>
          <span>Elegir ficha</span>
        </button>
      ))}
    </details>
  );
}
