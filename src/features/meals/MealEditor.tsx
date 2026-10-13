import { useState, useRef, useEffect } from "react";
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
import { Modal, Button, Field, NumberField, Select } from "../../components/ui";
import { compressPhoto } from "../../services/photos";
import { aiItems, aiPrompt, parseAnalysis } from "../../services/ai";
import { lookupProduct } from "../../services/products";
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
    <div className="ingredient">
      <div className="ingredient-top">
        <Field
          label="Alimento"
          value={item.name}
          required
          onChange={(e) => onChange({ ...item, name: e.target.value })}
        />
        <NumberField
          label="Cantidad (g / ml)"
          value={item.grams}
          min={0.1}
          max={10000}
          onChange={(n) => onChange({ ...item, grams: n })}
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
      <details>
        <summary>Valores por 100 g / ml · {SOURCE_LABELS[item.source]}</summary>
        <p className="muted small">
          Copiá los valores por 100 de la etiqueta. Si el dato es por porción,
          convertí según el peso de esa porción.
        </p>
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
                    source: item.source === "barcode" ? "manual" : item.source,
                  })
                }
              />
            ),
          )}
        </div>
        <div className="form-grid">
          <label className="field">
            <span>Procedencia</span>
            <select
              value={item.source}
              onChange={(e) =>
                onChange({ ...item, source: e.target.value as Item["source"] })
              }
            >
              {Object.entries(SOURCE_LABELS).map(([v, label]) => (
                <option value={v} key={v}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="Método de cocción"
            value={item.cooking}
            onChange={(e) => onChange({ ...item, cooking: e.target.value })}
          />
        </div>
      </details>
      <div className="item-total">
        Esta cantidad: ≈ {rounded(total.calories)} kcal ·{" "}
        {rounded(total.protein)} g proteína · {rounded(total.carbs)} g carbos ·{" "}
        {rounded(total.fat)} g grasas
      </div>
    </div>
  );
}
export default function MealEditor({
  onClose,
  existing,
  recipe,
  recipeMode = false,
}: {
  onClose: () => void;
  existing?: Meal;
  recipe?: Recipe;
  recipeMode?: boolean;
}) {
  const { profile: p, data, date, repo, run, notify } = useApp();
  const [name, setName] = useState(existing?.name ?? recipe?.name ?? ""),
    [type, setType] = useState<Meal["type"]>(existing?.type ?? "Almuerzo"),
    [items, setItems] = useState<Item[]>(
      existing?.items ?? recipe?.items ?? [],
    ),
    [photo, setPhoto] = useState(existing?.photo),
    [notes, setNotes] = useState(existing?.notes ?? ""),
    [servings, setServings] = useState(recipe?.servings ?? 1),
    [time, setTime] = useState(
      existing?.time ?? new Date().toTimeString().slice(0, 5),
    ),
    [tab, setTab] = useState("manual"),
    [search, setSearch] = useState(""),
    [json, setJson] = useState(""),
    [questions, setQuestions] = useState<string[]>([]),
    [code, setCode] = useState(""),
    [scanning, setScanning] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [remember, setRemember] = useState(true);
  const total = mealTotal(items);
  const update = (idx: number, item: Item) =>
    setItems((v) => v.map((it, i) => (i === idx ? item : it)));
  function addFood(food: Food) {
    setItems((v) => [
      ...v,
      {
        id: crypto.randomUUID(),
        foodId: food.id,
        name: food.name,
        grams: food.servingSize,
        per100: food.per100,
        source: food.source,
        cooking: "",
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
          photo,
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
  async function findProduct(value = code) {
    setBusy(true);
    setError("");
    try {
      const food = await lookupProduct(p.id, value);
      await repo.save("foods", food);
      addFood(food);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No pudimos consultar el producto.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function photoInput(file?: File) {
    if (!file) return;
    await run(async () => {
      const compressed = await compressPhoto(file);
      setPhoto(compressed.image);
    });
  }
  function importAI(repair = false) {
    try {
      const parsed = parseAnalysis(json, repair);
      setName(parsed.meal_name);
      setItems(aiItems(parsed));
      setQuestions(parsed.questions);
      setNotes(
        `Análisis IA · confianza ${Math.round(parsed.confidence * 100)}%. ${parsed.questions.join(" ")}`,
      );
      setTab("manual");
      setError("");
    } catch (e) {
      setError(
        e instanceof ZodError
          ? e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" · ")
          : "JSON inválido. Revisá el formato o intentá repararlo.",
      );
    }
  }
  return (
    <Modal
      title={
        recipeMode
          ? "Tu receta casera"
          : existing
            ? "Editar comida"
            : "Registrar comida"
      }
      onClose={onClose}
    >
      <div className="tabs compact">
        {["manual", "buscar", "código", "IA externa"].map((t, i) => (
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
                <Search size={16} />,
                <ScanBarcode size={16} />,
                <Clipboard size={16} />,
              ][i]
            }
            {t === "manual"
              ? "Componentes"
              : t === "buscar"
                ? "Mis alimentos"
                : t === "código"
                  ? "Código de barras"
                  : t}
          </button>
        ))}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {tab === "buscar" ? (
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
        <>
          <p>
            Buscá un producto en Open Food Facts y verificá los datos con su
            etiqueta.
          </p>
          <Field
            label="Código de barras"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Ej. 779…"
          />
          <div className="actions">
            <Button disabled={busy} onClick={() => void findProduct()}>
              {busy ? "Buscando…" : "Buscar producto"}
            </Button>
            <Button secondary onClick={() => setScanning(!scanning)}>
              <Camera size={17} />
              Usar cámara
            </Button>
          </div>
          {scanning && (
            <Scanner
              onResult={(v) => {
                setScanning(false);
                setCode(v);
                void findProduct(v);
              }}
              onError={setError}
            />
          )}
          <p className="muted small">
            Si no aparece, cargá los valores de la etiqueta en Componentes. La
            cámara requiere HTTPS y permiso.
          </p>
        </>
      ) : tab === "IA externa" ? (
        <>
          <p>
            Analizá la foto fuera de NutriDuo. Después pegá el JSON y revisá
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
            {photo && (
              <Button
                secondary
                onClick={() =>
                  void run(async () => {
                    const blob = await (await fetch(photo)).blob();
                    const file = new File([blob], "comida.jpg", {
                      type: "image/jpeg",
                    });
                    if (navigator.canShare?.({ files: [file] }))
                      await navigator.share({
                        files: [file],
                        text: aiPrompt(p),
                      });
                    else {
                      const a = document.createElement("a");
                      a.href = photo;
                      a.download = "comida.jpg";
                      a.click();
                    }
                  }, "Foto preparada")
                }
              >
                <Share2 size={17} />
                Compartir foto
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
            <div className="photo-inputs">
              <label className="upload-button">
                <Camera size={17} />
                Sacar foto
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => void photoInput(e.target.files?.[0])}
                />
              </label>
              <label className="upload-button">
                Elegir foto / etiqueta
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => void photoInput(e.target.files?.[0])}
                />
              </label>
              <Field
                label="Hora"
                type="time"
                value={time}
                required
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          )}
          {photo && (
            <div className="meal-photo-preview">
              <img src={photo} alt="Comida registrada" />
              <button
                type="button"
                className="text-button"
                onClick={() => setPhoto(undefined)}
              >
                Quitar foto
              </button>
            </div>
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
            <span>{recipeMode ? "Por porción" : "Total de la comida"}</span>
            <strong>
              ≈ {rounded(total.calories / (recipeMode ? servings : 1))} kcal
            </strong>
            <small>
              {rounded(total.protein / (recipeMode ? servings : 1))} g proteína
              · {rounded(total.carbs / (recipeMode ? servings : 1))} g carbos ·{" "}
              {rounded(total.fat / (recipeMode ? servings : 1))} g grasas
            </small>
          </div>
          <Button type="submit" disabled={busy || !items.length}>
            {busy
              ? "Guardando…"
              : recipeMode
                ? "Guardar receta"
                : existing
                  ? "Guardar cambios"
                  : "Confirmar y registrar"}
          </Button>
        </form>
      )}
    </Modal>
  );
}
function Scanner({
  onResult,
  onError,
}: {
  onResult: (code: string) => void;
  onError: (s: string) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const handlers = useRef({ onResult, onError });
  handlers.current = { onResult, onError };
  useEffect(() => {
    let cancelled = false;
    let controls: { stop: () => void } | undefined;
    void import("@zxing/browser")
      .then(async ({ BrowserMultiFormatReader }) => {
        if (cancelled) return;
        const reader = new BrowserMultiFormatReader();
        controls = await reader.decodeFromVideoDevice(
          undefined,
          video.current!,
          (result) => {
            if (result && !cancelled) {
              cancelled = true;
              controls?.stop();
              handlers.current.onResult(result.getText());
            }
          },
        );
        if (cancelled) controls.stop();
      })
      .catch(() =>
        handlers.current.onError(
          "No pudimos abrir la cámara. Revisá el permiso o escribí el código.",
        ),
      );
    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, []);
  return <video className="scanner" ref={video} muted playsInline />;
}
export function foodFromPortion(
  name: string,
  macros: Food["per100"],
  grams: number,
) {
  return { name, per100: scale(macros, 100 / grams) };
}
