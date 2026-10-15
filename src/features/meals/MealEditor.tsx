import { useState, useRef } from "react";
import {
  Plus,
  Trash2,
  Camera,
  ScanBarcode,
  Clipboard,
  Search,
  Share2,
} from "lucide-react";
import { ZodError } from "zod";
import { useApp } from "../../app/context";
import { useHistoryChoice } from "../../app/navigation";
import { meta, db } from "../../db";
import {
  type Meal,
  type Item,
  type Food,
  type Recipe,
  mealSchema,
  recipeSchema,
  foodSchema,
} from "../../schemas";
import { zero, mealTotal, itemTotal, scale } from "../../nutrition/formulas";
import { MEAL_TYPES, SOURCE_LABELS } from "../../nutrition/constants";
import { rounded } from "../../utils/date";
import {
  Modal,
  Button,
  Field,
  NumberField,
  Select,
  ChoicePicker,
} from "../../components/ui";
import { compressPhoto, mealPhotos } from "../../services/photos";
import MealPhotos from "./MealPhotos";
import { aiItems, aiPrompt, parseAnalysis } from "../../services/ai";
import ProductsPanel from "./ProductsPanel";
import AIAnalyzer from "./AIAnalyzer";
import NutritionLookup from "./NutritionLookup";
import Micronutrients from "../../components/Micronutrients";
import MealQuantity from "./MealQuantity";
import { measurementOf, quantityReady } from "../../services/mealQuantity";
import { aiSchema } from "../../schemas";
import { z } from "zod";
export function blankItem(): Item {
  return {
    id: crypto.randomUUID(),
    name: "",
    grams: 100,
    per100: zero(),
    source: "manual",
    cooking: "",
  };
}
export function ItemFields({
  item,
  onChange,
  onRemove,
}: {
  item: Item;
  onChange: (i: Item) => void;
  onRemove: () => void;
}) {
  const total = itemTotal(item);
  return (
    <div className="ingredient item-with-quantity">
      <div className="ingredient-top">
        <Field
          label="Alimento"
          value={item.name}
          required
          onChange={(e) => onChange({ ...item, name: e.target.value })}
        />
        <button
          className="icon-button danger"
          type="button"
          aria-label={`Quitar ${item.name || "alimento"}`}
          onClick={onRemove}
        >
          <Trash2 size={18} />
        </button>
      </div>
      <MealQuantity item={item} onChange={onChange} />
      <details>
        <summary>
          Valores por 100 {measurementOf(item).basis} ·{" "}
          {SOURCE_LABELS[item.source]}
        </summary>
        <p className="muted small">
          Copiá los valores por 100 de la etiqueta. Si el dato es por porción,
          convertí según el peso de esa porción.
        </p>
        <ChoicePicker
          label="Medida de la ficha nutricional"
          value={measurementOf(item).basis}
          options={[
            { value: "g", label: "Valores por 100 g" },
            { value: "ml", label: "Valores por 100 ml" },
          ]}
          onChange={(value) =>
            onChange({
              ...item,
              measurement: {
                basis: value as "g" | "ml",
                mode: value as "g" | "ml",
              },
            })
          }
        />
        <div className="macro-fields">
          {(["calories", "protein", "carbs", "fat", "fiber"] as const).map(
            (k, i) => (
              <NumberField
                key={k}
                label={
                  [
                    "kcal / 100",
                    "Proteína g / 100",
                    "Carbos g / 100",
                    "Grasas g / 100",
                    "Fibra g / 100",
                  ][i]
                }
                value={item.per100[k]}
                onChange={(n) =>
                  onChange({
                    ...item,
                    per100: { ...item.per100, [k]: n },
                    fiberKnown: k === "fiber" ? true : item.fiberKnown,
                    source: ["barcode", "database"].includes(item.source)
                      ? "manual"
                      : item.source,
                  })
                }
              />
            ),
          )}
        </div>
        <div className="form-grid">
          <ChoicePicker
            label="Procedencia"
            value={item.source}
            onChange={(value) =>
              onChange({ ...item, source: value as Item["source"] })
            }
            options={Object.entries(SOURCE_LABELS).map(([value, label]) => ({
              value,
              label,
            }))}
          />
          <Field
            label="Método de cocción"
            value={item.cooking}
            onChange={(e) => onChange({ ...item, cooking: e.target.value })}
          />
        </div>
      </details>
      <div className="item-total">
        {quantityReady(item) ? (
          <>
            Esta cantidad: ≈ {rounded(total.calories)} kcal ·{" "}
            {rounded(total.protein)} g proteína · {rounded(total.carbs)} g
            carbos · {rounded(total.fat)} g grasas
          </>
        ) : (
          "Completá la equivalencia para ver el aporte de esta cantidad."
        )}
      </div>
      {item.nutritionReference && (
        <p className="muted small">
          Ficha seleccionada: {item.nutritionReference.description} ·{" "}
          {item.nutritionReference.source === "usda" ? (
            <a
              href={`https://fdc.nal.usda.gov/food-details/${encodeURIComponent(item.nutritionReference.id)}/nutrients`}
              target="_blank"
              rel="noopener noreferrer"
            >
              USDA
            </a>
          ) : (
            <a
              href={`https://world.openfoodfacts.org/product/${encodeURIComponent(item.nutritionReference.id)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Food Facts
            </a>
          )}
        </p>
      )}
      {item.fiberKnown === false && (
        <p className="muted small">
          Fibra sin dato: el cálculo actual no incluye su aporte. Podés
          completarla desde la etiqueta.
        </p>
      )}
      {quantityReady(item) && <Micronutrients items={[item]} />}
      <NutritionLookup item={item} onChange={onChange} />
    </div>
  );
}
export default function MealEditor({
  onClose,
  existing,
  recipe,
  recipeMode = false,
  planned = false,
}: {
  onClose: () => void;
  existing?: Meal;
  recipe?: Recipe;
  recipeMode?: boolean;
  planned?: boolean;
}) {
  const { profile: p, data, date, repo, run, notify } = useApp();
  const [name, setName] = useState(existing?.name ?? recipe?.name ?? ""),
    [type, setType] = useState<Meal["type"]>(existing?.type ?? "Almuerzo"),
    [items, setItems] = useState<Item[]>(
      existing?.items ?? recipe?.items ?? [],
    ),
    [photos, setPhotos] = useState(() => mealPhotos(existing)),
    [photosBusy, setPhotosBusy] = useState(false),
    [notes, setNotes] = useState(existing?.notes ?? ""),
    [servings, setServings] = useState(recipe?.servings ?? 1),
    [time, setTime] = useState(
      existing?.time ?? new Date().toTimeString().slice(0, 5),
    ),
    [navigationId] = useState(() => crypto.randomUUID()),
    [search, setSearch] = useState(""),
    [json, setJson] = useState(""),
    [description, setDescription] = useState(""),
    [questions, setQuestions] = useState<string[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [remember, setRemember] = useState(true);
  const [tab, setTab] = useHistoryChoice<string>(
    `mealEditor.${navigationId}.tab`,
    "manual",
  );
  const total = mealTotal(items);
  const update = (idx: number, item: Item) =>
    setItems((v) => v.map((it, i) => (i === idx ? item : it)));
  function addFood(food: Food, grams = food.servingSize) {
    setItems((v) => [
      ...v,
      {
        id: crypto.randomUUID(),
        foodId: food.id,
        name: food.name,
        grams,
        measurement: food.measurement ?? { basis: food.unit, mode: food.unit },
        per100: food.per100,
        source: food.source,
        cooking: "",
        micronutrientsPer100: food.micronutrientsPer100,
        nutritionReference: food.nutritionReference,
        fiberKnown: food.fiberKnown,
      },
    ]);
    setTab("manual");
  }
  async function save() {
    setError("");
    setBusy(true);
    try {
      if (recipeMode) {
        await repo.save(
          "recipes",
          recipeSchema.parse({
            ...recipe,
            ...(recipe ?? meta(p.id)),
            name,
            servings,
            items,
          }),
        );
      } else {
        const meal = mealSchema.parse({
          ...existing,
          ...(existing ?? meta(p.id)),
          date: existing?.date ?? date,
          time,
          name:
            name ||
            items
              .map((i) => i.name)
              .join(" + ")
              .slice(0, 150),
          type,
          items,
          photo: photos[0],
          photos,
          notes,
        });
        await db.transaction(
          "rw",
          db.table("meals"),
          db.table("foods"),
          async () => {
            await repo.save("meals", meal);
            if (remember)
              for (const item of items) {
                if (
                  !item.foodId &&
                  !data.foods.some(
                    (f) => f.name.toLowerCase() === item.name.toLowerCase(),
                  )
                )
                  await repo.save(
                    "foods",
                    foodSchema.parse({
                      ...meta(p.id),
                      name: item.name,
                      per100: item.per100,
                      source: item.source,
                      servingSize: item.grams,
                      unit: measurementOf(item).basis,
                      measurement: item.measurement,
                      micronutrientsPer100: item.micronutrientsPer100,
                      nutritionReference: item.nutritionReference,
                      fiberKnown: item.fiberKnown,
                    }),
                  );
              }
          },
        );
      }
      notify(recipeMode ? "Receta guardada" : "Comida guardada");
      onClose();
    } catch (e) {
      setError(
        e instanceof ZodError
          ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" · ")
          : e instanceof Error
            ? e.message
            : "No pudimos guardar.",
      );
    } finally {
      setBusy(false);
    }
  }
  const uploading = useRef(false);
  async function photoInput(files: File[]) {
    if (!files.length || uploading.current) return;
    uploading.current = true;
    setPhotosBusy(true);
    try {
      await run(async () => {
        for (const file of files) {
          const compressed = await compressPhoto(file);
          setPhotos((previous) => [...previous, compressed.image]);
        }
      });
    } finally {
      uploading.current = false;
      setPhotosBusy(false);
    }
  }
  function removePhoto(index: number) {
    setPhotos((previous) => previous.filter((_, i) => i !== index));
  }
  function importAI(repair = false) {
    try {
      const parsed = parseAnalysis(json, repair);
      reviewAI(parsed);
    } catch (e) {
      setError(
        e instanceof ZodError
          ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" · ")
          : "JSON inválido. Revisá el formato o intentá repararlo.",
      );
    }
  }
  function reviewAI(parsed: z.infer<typeof aiSchema>) {
    setName(parsed.meal_name);
    setItems(aiItems(parsed));
    setQuestions(parsed.questions);
    setNotes(
      `${description ? description + "\n" : ""}Análisis IA · confianza ${Math.round(parsed.confidence * 100)}%. ${parsed.questions.join(" ")}`.slice(
        0,
        2000,
      ),
    );
    setTab("manual");
    setError("");
  }
  return (
    <Modal
      title={
        recipeMode
          ? "Tu receta casera"
          : existing && !planned
            ? "Editar comida"
            : "Registrar comida"
      }
      onClose={onClose}
    >
      <div className="tabs compact">
        {["manual", "analizar", "buscar", "código", "IA externa"].map(
          (t, i) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              onClick={() => {
                setTab(t);
                setError("");
              }}
            >
              {
                [
                  <Plus size={16} />,
                  <Camera size={16} />,
                  <Search size={16} />,
                  <ScanBarcode size={16} />,
                  <Clipboard size={16} />,
                ][i]
              }
              {t === "manual"
                ? "Componentes"
                : t === "analizar"
                  ? "Analizar comida"
                  : t === "buscar"
                    ? "Mis alimentos"
                    : t === "código"
                      ? "Código de barras"
                      : t}
            </button>
          ),
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {tab === "analizar" ? (
        <AIAnalyzer
          photos={photos}
          photosBusy={photosBusy}
          description={description}
          setDescription={setDescription}
          onPhoto={photoInput}
          onRemovePhoto={removePhoto}
          onReview={reviewAI}
        />
      ) : tab === "buscar" ? (
        <>
          <Field
            label="Buscar en mis alimentos"
            placeholder="Yogur, arroz, milanesa…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <p className="muted small">
            Tu biblioteca se arma con lo que registrás. No cargamos valores
            inventados.
          </p>
          {data.foods
            .filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
            .sort((a, b) => Number(b.favorite) - Number(a.favorite))
            .map((f) => (
              <button
                className="list-button"
                key={f.id}
                onClick={() => addFood(f)}
              >
                <span>
                  {f.favorite ? "★ " : ""}
                  {f.name}
                  <small>
                    {f.brand} · {SOURCE_LABELS[f.source]}
                  </small>
                </span>
                <span>
                  {rounded(f.per100.calories)} kcal / 100
                  <Plus size={16} />
                </span>
              </button>
            ))}
          <h3>Mis recetas</h3>
          {data.recipes.map((r) => (
            <button
              key={r.id}
              className="list-button"
              onClick={() => {
                setName(r.name);
                setItems((v) => [
                  ...v,
                  ...r.items.map((i) => ({
                    ...i,
                    id: crypto.randomUUID(),
                    grams: i.grams / r.servings,
                  })),
                ]);
                setTab("manual");
              }}
            >
              {r.name}
              <span>
                Agregar 1 porción <Plus size={15} />
              </span>
            </button>
          ))}
          <Button
            secondary
            onClick={() => {
              setItems((v) => [...v, blankItem()]);
              setTab("manual");
            }}
          >
            Cargar alimento manual
          </Button>
        </>
      ) : tab === "código" ? (
        <ProductsPanel onAdd={(food, grams) => addFood(food, grams)} />
      ) : tab === "IA externa" ? (
        <>
          <p>
            Analizá las fotos fuera de NutriDuo. Después pegá el JSON y revisá
            cada componente antes de guardar.
          </p>
          <div className="actions">
            <Button
              secondary
              onClick={() =>
                void run(
                  () => navigator.clipboard.writeText(aiPrompt(p)),
                  "Prompt copiado",
                )
              }
            >
              <Clipboard size={17} />
              Copiar prompt para ChatGPT
            </Button>
            {photos.length > 0 && (
              <Button
                secondary
                onClick={() =>
                  void run(async () => {
                    const files = await Promise.all(
                      photos.map(
                        async (photo, index) =>
                          new File(
                            [await (await fetch(photo)).blob()],
                            `comida-${index + 1}.jpg`,
                            { type: "image/jpeg" },
                          ),
                      ),
                    );
                    if (navigator.canShare?.({ files }))
                      await navigator.share({
                        files,
                        text: aiPrompt(p),
                      });
                    else {
                      for (const [index, photo] of photos.entries()) {
                        const a = document.createElement("a");
                        a.href = photo;
                        a.download = `comida-${index + 1}.jpg`;
                        a.click();
                      }
                    }
                  }, "Fotos preparadas")
                }
              >
                <Share2 size={17} />
                Compartir fotos
              </Button>
            )}
          </div>
          <label className="field">
            <span>Pegar análisis JSON</span>
            <textarea
              rows={9}
              value={json}
              onChange={(e) => setJson(e.target.value)}
              placeholder={
                '{"meal_name":"…", "confidence":0.7, "foods":[…], "questions":[]}'
              }
            />
          </label>
          <div className="actions">
            <Button onClick={() => importAI()}>Validar y revisar</Button>
            <Button secondary onClick={() => importAI(true)}>
              Intentar reparar formato
            </Button>
          </div>
          <p className="muted small">
            Sólo reparamos bloques de código y comas sobrantes. No completamos
            datos nutricionales ausentes.
          </p>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="form-grid">
            <Field
              label={recipeMode ? "Nombre de la receta" : "Nombre de la comida"}
              placeholder="Por ejemplo, almuerzo en casa"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required={recipeMode}
            />
            {recipeMode ? (
              <NumberField
                label="Porciones de la receta"
                value={servings}
                min={0.1}
                max={1000}
                onChange={setServings}
              />
            ) : (
              <Select
                label="Momento"
                value={type}
                onChange={(v) => setType(v as Meal["type"])}
                options={MEAL_TYPES}
              />
            )}
          </div>
          {!recipeMode && (
            <>
              <MealPhotos
                photos={photos}
                onAdd={photoInput}
                onRemove={removePhoto}
                loading={photosBusy}
                disabled={busy}
              />
              <Field
                label="Hora"
                type="time"
                value={time}
                required
                onChange={(e) => setTime(e.target.value)}
              />
            </>
          )}
          {questions.length > 0 && (
            <div className="notice">
              <strong>Antes de confirmar</strong>
              {questions.map((q) => (
                <p key={q}>{q}</p>
              ))}
              <p>
                Las cantidades son aproximadas. Revisalas y corregí lo
                necesario.
              </p>
            </div>
          )}
          {items.map((item, idx) => (
            <ItemFields
              key={item.id}
              item={item}
              onChange={(i) => update(idx, i)}
              onRemove={() => setItems((v) => v.filter((_, i) => i !== idx))}
            />
          ))}
          <Button
            secondary
            onClick={() => setItems((v) => [...v, blankItem()])}
          >
            <Plus size={16} />
            Agregar componente manual
          </Button>
          {!recipeMode && (
            <>
              <label className="field">
                <span>Notas</span>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                Guardar alimentos nuevos para la próxima vez
              </label>
            </>
          )}
          <div className="editor-total">
            {items.every(quantityReady) ? (
              <>
                <span>{recipeMode ? "Por porción" : "Total de la comida"}</span>
                <strong>
                  ≈ {rounded(total.calories / (recipeMode ? servings : 1))} kcal
                </strong>
                <small>
                  {rounded(total.protein / (recipeMode ? servings : 1))} g
                  proteína ·{" "}
                  {rounded(total.carbs / (recipeMode ? servings : 1))} g carbos
                  · {rounded(total.fat / (recipeMode ? servings : 1))} g grasas
                </small>
              </>
            ) : (
              <span>Completá las cantidades para ver el total.</span>
            )}
          </div>
          {items.every(quantityReady) && <Micronutrients items={items} />}
          <Button
            type="submit"
            disabled={
              busy || photosBusy || !items.length || !items.every(quantityReady)
            }
          >
            {busy
              ? "Guardando…"
              : recipeMode
                ? "Guardar receta"
                : existing && !planned
                  ? "Guardar cambios"
                  : "Confirmar y registrar"}
          </Button>
        </form>
      )}
    </Modal>
  );
}
export function foodFromPortion(
  name: string,
  macros: Food["per100"],
  grams: number,
) {
  return { name, per100: scale(macros, 100 / grams) };
}
