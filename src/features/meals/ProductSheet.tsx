import { useRef, useState } from "react";
import { Camera, Check, PencilLine, Plus, Users } from "lucide-react";
import { useApp } from "../../app/context";
import { Button, Field, Modal, NumberField } from "../../components/ui";
import { saveProduct } from "../../services/pantry";
import { readNutritionLabel } from "../../services/integratedAI";
import { labelPer100 } from "../../services/labelContract";
import type { Food } from "../../schemas";

const round = (n: number, d = 1) => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};
/** Grams or ml of the whole package, from "400 g", "1 kg", "1,5 L"… */
function packageAmount(quantity?: string) {
  const m = /([\d.,]+)\s*(kg|g|ml|cl|l)\b/i.exec(quantity ?? "");
  if (!m) return undefined;
  const n = Number(m[1].replace(",", "."));
  const unit = m[2].toLowerCase();
  const value =
    n * (unit === "kg" || unit === "l" ? 1000 : unit === "cl" ? 10 : 1);
  return value > 0 && value <= 10000 ? Math.round(value) : undefined;
}
const fmt = (n?: number, d = 1) =>
  n === undefined ? "—" : round(n, d).toLocaleString("es-AR");

/** Product card: full label breakdown, portion picker and corrections. */
export default function ProductSheet({
  food: initial,
  missing = [],
  isNew = false,
  shared,
  onAdd,
  onClose,
}: {
  food: Food;
  missing?: string[];
  isNew?: boolean;
  shared?: boolean;
  onAdd?: (food: Food, grams: number) => void;
  onClose: () => void;
}) {
  const { profile, notify } = useApp();
  const [food, setFood] = useState(initial);
  const [grams, setGrams] = useState(initial.servingSize);
  const [editing, setEditing] = useState(isNew || missing.length > 0);
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [isShared, setShared] = useState(shared);
  const [reading, setReading] = useState(false);
  const photo = useRef<HTMLInputElement>(null);
  const pack = packageAmount(food.quantity);
  const amounts = [
    {
      g: food.servingSize,
      label: `1 porción · ${food.servingSize} ${food.unit}`,
    },
    {
      g: food.servingSize * 2,
      label: `2 porciones · ${food.servingSize * 2} ${food.unit}`,
    },
    ...(pack && pack > food.servingSize
      ? [
          {
            g: Math.round(pack / 2),
            label: `½ envase · ${Math.round(pack / 2)} ${food.unit}`,
          },
          { g: pack, label: `Envase entero · ${pack} ${food.unit}` },
        ]
      : []),
    { g: 100, label: `100 ${food.unit}` },
  ].filter((a, i, list) => list.findIndex((b) => b.g === a.g) === i);

  async function readLabel(file: File) {
    setReading(true);
    try {
      const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const result = await readNutritionLabel(profile.id, url);
      if (result.status !== "ready") {
        notify(`No se pudo leer: ${result.reason}`);
        return;
      }
      const values = labelPer100(result.label);
      setDraft((d) => ({
        ...d,
        name: d.name || result.label.name?.trim() || "",
        brand: d.brand || result.label.brand?.trim() || "",
        per100: values.per100,
        fiberKnown: values.fiberKnown,
        sugars: values.sugars,
        saturatedFat: values.saturatedFat,
        sodium:
          values.sodiumMg === undefined ? undefined : values.sodiumMg / 1000,
        micronutrientsPer100:
          values.sodiumMg === undefined
            ? d.micronutrientsPer100
            : { ...d.micronutrientsPer100, sodium_mg: values.sodiumMg },
        servingSize: values.servingSize ?? d.servingSize,
        unit: values.unit,
      }));
      notify("Etiqueta leída: revisá que los números coincidan");
    } catch (e) {
      notify(e instanceof Error ? e.message : "No se pudo leer la etiqueta.");
    } finally {
      setReading(false);
    }
  }
  const unit = food.unit;
  const sodiumMg =
    food.micronutrientsPer100?.sodium_mg ??
    (food.sodium !== undefined ? food.sodium * 1000 : undefined);
  const rows: [string, number | undefined, string, boolean?][] = [
    ["Energía", food.per100.calories, "kcal"],
    ["Proteínas", food.per100.protein, "g"],
    ["Carbohidratos", food.per100.carbs, "g"],
    ["de los cuales azúcares", food.sugars, "g", true],
    ["Grasas", food.per100.fat, "g"],
    ["de las cuales saturadas", food.saturatedFat, "g", true],
    ["Fibra", food.fiberKnown === false ? undefined : food.per100.fiber, "g"],
    ["Sodio", sodiumMg, "mg"],
  ];

  async function save() {
    if (busy) return;
    if (!draft.name.trim()) return notify("Poné el nombre del producto.");
    const macros = Object.values(draft.per100);
    if (macros.some((n) => !Number.isFinite(n) || n < 0))
      return notify("Revisá los valores de la etiqueta.");
    setBusy(true);
    try {
      const result = await saveProduct(profile.id, {
        ...draft,
        verified: true,
        fiberKnown: true,
        sharedBy: draft.sharedBy ?? profile.id,
      });
      setFood(result.food);
      setShared(result.shared);
      setGrams(result.food.servingSize);
      setEditing(false);
      notify(
        result.shared
          ? "Producto guardado para los dos"
          : "Producto guardado en este celular",
      );
    } catch {
      notify("No se pudo guardar el producto.");
    } finally {
      setBusy(false);
    }
  }

  const number = (
    label: string,
    value: number | undefined,
    set: (n: number) => void,
  ) => (
    <NumberField
      label={label}
      value={value ?? NaN}
      required={false}
      onChange={set}
    />
  );

  return (
    <Modal
      title={editing ? "Datos de la etiqueta" : "Producto"}
      onClose={onClose}
      className="product-sheet"
    >
      {editing ? (
        <form
          className="product-edit"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          {missing.length > 0 && (
            <p className="notice small">
              A esta ficha le falta: {missing.join(", ")}. Copialo de la
              etiqueta (valores cada 100 {unit}).
            </p>
          )}
          {isNew && (
            <p className="muted small">
              No está en Open Food Facts. Cargalo una vez desde la tabla
              nutricional del envase y queda guardado para los dos.
            </p>
          )}
          <button
            type="button"
            className="products-scan product-photo"
            disabled={reading}
            onClick={() => photo.current?.click()}
          >
            <Camera size={26} />
            <span>
              <strong>
                {reading
                  ? "Leyendo la etiqueta…"
                  : "Sacale una foto a la tabla"}
              </strong>
              <small>La IA copia los valores y vos los revisás</small>
            </span>
          </button>
          <input
            ref={photo}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            aria-label="Foto de la tabla nutricional"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void readLabel(file);
            }}
          />
          <Field
            label="Nombre del producto"
            required
            maxLength={150}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <Field
            label="Marca"
            maxLength={150}
            value={draft.brand}
            onChange={(e) => setDraft({ ...draft, brand: e.target.value })}
          />
          <div className="form-grid">
            {number(`Porción (${unit})`, draft.servingSize, (n) =>
              setDraft({ ...draft, servingSize: n > 0 ? n : 100 }),
            )}
            {number("Energía (kcal) cada 100", draft.per100.calories, (n) =>
              setDraft({ ...draft, per100: { ...draft.per100, calories: n } }),
            )}
            {number("Proteínas (g)", draft.per100.protein, (n) =>
              setDraft({ ...draft, per100: { ...draft.per100, protein: n } }),
            )}
            {number("Carbohidratos (g)", draft.per100.carbs, (n) =>
              setDraft({ ...draft, per100: { ...draft.per100, carbs: n } }),
            )}
            {number("Azúcares (g)", draft.sugars, (n) =>
              setDraft({
                ...draft,
                sugars: Number.isFinite(n) ? n : undefined,
              }),
            )}
            {number("Grasas (g)", draft.per100.fat, (n) =>
              setDraft({ ...draft, per100: { ...draft.per100, fat: n } }),
            )}
            {number("Grasas saturadas (g)", draft.saturatedFat, (n) =>
              setDraft({
                ...draft,
                saturatedFat: Number.isFinite(n) ? n : undefined,
              }),
            )}
            {number("Fibra (g)", draft.per100.fiber, (n) =>
              setDraft({
                ...draft,
                per100: { ...draft.per100, fiber: Number.isFinite(n) ? n : 0 },
              }),
            )}
            {number(
              "Sodio (mg)",
              draft.micronutrientsPer100?.sodium_mg ??
                (draft.sodium !== undefined ? draft.sodium * 1000 : undefined),
              (n) =>
                setDraft({
                  ...draft,
                  sodium: Number.isFinite(n) ? n / 1000 : undefined,
                  micronutrientsPer100: Number.isFinite(n)
                    ? { ...draft.micronutrientsPer100, sodium_mg: n }
                    : undefined,
                }),
            )}
          </div>
          <div className="actions">
            <Button type="submit" disabled={busy}>
              <Check size={17} />
              {busy ? "Guardando…" : "Guardar producto"}
            </Button>
            {!isNew && missing.length === 0 && (
              <Button secondary onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            )}
          </div>
        </form>
      ) : (
        <>
          <div className="product-head">
            {food.image ? (
              <img src={food.image} alt="" loading="lazy" />
            ) : (
              <span className="product-initial" aria-hidden="true">
                {food.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div>
              <strong>{food.name}</strong>
              <span className="muted small">
                {[food.brand, food.quantity].filter(Boolean).join(" · ") ||
                  food.barcode}
              </span>
              {food.category && (
                <span className="product-category">{food.category}</span>
              )}
              <div className="product-badges">
                {food.nutriScore && (
                  <span className={`nutri-score ns-${food.nutriScore}`}>
                    Nutri-Score {food.nutriScore.toUpperCase()}
                  </span>
                )}
                {food.nova && (
                  <span className="product-chip">
                    {food.nova === 4 ? "Ultraprocesado" : `NOVA ${food.nova}`}
                  </span>
                )}
                {food.verified && (
                  <span className="product-chip">Revisado</span>
                )}
              </div>
            </div>
          </div>

          <div className="product-amount">
            <span>¿Cuánto comiste?</span>
            <div className="product-amount-chips">
              {amounts.map((a) => (
                <button
                  type="button"
                  key={a.g}
                  aria-pressed={grams === a.g}
                  onClick={() => setGrams(a.g)}
                >
                  {a.label}
                </button>
              ))}
            </div>
            <NumberField
              label={`Cantidad (${unit})`}
              value={grams}
              min={1}
              max={10000}
              onChange={(n) => setGrams(n)}
            />
          </div>

          <table className="product-table">
            <thead>
              <tr>
                <th scope="col">Nutriente</th>
                <th scope="col">100 {unit}</th>
                <th scope="col">
                  Comiste {Number.isFinite(grams) ? fmt(grams, 0) : "—"} {unit}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, value, u, sub]) => (
                <tr key={label} className={sub ? "sub" : ""}>
                  <th scope="row">{label}</th>
                  <td>
                    {fmt(value, u === "mg" || u === "kcal" ? 0 : 1)} {u}
                  </td>
                  <td>
                    {value === undefined || !Number.isFinite(grams)
                      ? "—"
                      : `${fmt((value * grams) / 100, u === "mg" || u === "kcal" ? 0 : 1)} ${u}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {food.allergens && food.allergens.length > 0 && (
            <p className="product-allergens">
              <strong>Contiene:</strong> {food.allergens.join(", ")}
            </p>
          )}
          {food.ingredients && (
            <details className="product-ingredients">
              <summary>Ingredientes</summary>
              <p>{food.ingredients}</p>
            </details>
          )}
          <p className="muted small product-source">
            <Users size={14} />{" "}
            {isShared === false
              ? "Guardado en este celular. Activá Cuenta y respaldo en Más para compartirlo con el otro perfil."
              : "En Productos de la casa: Luca y Ari lo tienen a mano."}{" "}
            {food.sourceUrl.includes("openfoodfacts") && !food.verified
              ? "Datos de Open Food Facts: compará con la etiqueta."
              : ""}
          </p>

          <div className="actions">
            {onAdd && (
              <Button
                disabled={!Number.isFinite(grams) || grams <= 0}
                onClick={() => onAdd(food, grams)}
              >
                <Plus size={17} />
                Agregar a la comida
              </Button>
            )}
            <Button
              secondary
              onClick={() => {
                setDraft(food);
                setEditing(true);
              }}
            >
              <PencilLine size={17} />
              Corregir datos
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
