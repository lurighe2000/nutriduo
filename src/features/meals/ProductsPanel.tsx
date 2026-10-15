import { useEffect, useState } from "react";
import { ScanBarcode, Search } from "lucide-react";
import { useApp } from "../../app/context";
import { meta } from "../../db";
import { Button, Field } from "../../components/ui";
import { findProduct, ProductNotFound } from "../../services/products";
import { saveProduct, syncPantry } from "../../services/pantry";
import type { Food } from "../../schemas";
import BarcodeScanner from "./BarcodeScanner";
import ProductSheet from "./ProductSheet";

type Sheet = {
  food: Food;
  missing: string[];
  isNew: boolean;
  shared?: boolean;
};

function blankProduct(profileId: Food["profileId"], barcode: string): Food {
  return {
    ...meta(profileId),
    name: "",
    brand: "",
    barcode,
    source: "barcode",
    per100: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    servingSize: 100,
    unit: "g",
    verified: false,
    favorite: false,
    sourceUrl: "",
    sharedBy: profileId,
  };
}

/**
 * Closing the product card pops its history entry; adding the food switches
 * the meal tab, which pushes a new one. Wait for the pop so the meal editor
 * itself is not closed by it.
 */
function afterBack(action: () => void) {
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    window.removeEventListener("popstate", run);
    window.setTimeout(action, 0);
  };
  window.addEventListener("popstate", run);
  window.setTimeout(run, 700);
}

/** Scan or type a barcode, see the full label and pick from the shared list. */
export default function ProductsPanel({
  onAdd,
}: {
  onAdd: (food: Food, grams: number) => void;
}) {
  const { profile, data } = useApp();
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [sheet, setSheet] = useState<Sheet>();
  const [sync, setSync] = useState<"syncing" | "shared" | "local" | "error">(
    "syncing",
  );

  useEffect(() => {
    let alive = true;
    void syncPantry(profile.id)
      .then((r) => alive && setSync(r.shared ? "shared" : "local"))
      .catch(() => alive && setSync("error"));
    return () => {
      alive = false;
    };
  }, [profile.id]);

  const shared =
    sync === "shared" ? true : sync === "local" ? false : undefined;
  const needle = query.trim().toLowerCase();
  const products = data.foods
    .filter((f) => f.source === "barcode")
    .filter(
      (f) =>
        !needle ||
        `${f.name} ${f.brand} ${f.barcode}`.toLowerCase().includes(needle),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  async function lookup(value: string) {
    setBusy(true);
    setError("");
    try {
      const found = await findProduct(profile.id, value);
      if (!found.cached && found.missing.length === 0) {
        const saved = await saveProduct(profile.id, found.food);
        setSheet({
          food: saved.food,
          missing: [],
          isNew: false,
          shared: saved.shared,
        });
      } else
        setSheet({
          food: found.food,
          missing: found.missing,
          isNew: false,
          shared,
        });
    } catch (e) {
      if (e instanceof ProductNotFound)
        setSheet({
          food: blankProduct(profile.id, e.barcode),
          missing: [],
          isNew: true,
          shared,
        });
      else
        setError(
          e instanceof Error ? e.message : "No pudimos consultar el producto.",
        );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="products-panel">
      <button
        type="button"
        className="products-scan"
        onClick={() => setScanning(true)}
      >
        <ScanBarcode size={30} />
        <span>
          <strong>Escanear producto</strong>
          <small>Con la cámara: ves todo lo que contiene</small>
        </span>
      </button>
      <form
        className="products-code"
        onSubmit={(e) => {
          e.preventDefault();
          void lookup(code);
        }}
      >
        <Field
          label="Código de barras"
          inputMode="numeric"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Ej. 779…"
        />
        <Button type="submit" disabled={busy}>
          {busy ? "Buscando…" : "Buscar producto"}
        </Button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <section className="products-library" aria-label="Productos de la casa">
        <div className="products-library-head">
          <strong>Productos de la casa</strong>
          <span className="muted small">
            {sync === "syncing"
              ? "Actualizando…"
              : sync === "shared"
                ? "Compartidos entre Luca y Ari"
                : sync === "local"
                  ? "Solo en este celular"
                  : "Sin conexión: se muestran los guardados"}
          </span>
        </div>
        {products.length > 6 || needle ? (
          <label className="products-search">
            <Search size={16} />
            <input
              aria-label="Buscar en productos de la casa"
              placeholder="Buscar por nombre o marca"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
        ) : null}
        {products.length === 0 ? (
          <p className="muted small">
            {needle
              ? "No hay productos con ese nombre."
              : "Todavía no hay productos. Lo que escanee cualquiera de los dos aparece acá."}
          </p>
        ) : (
          <div className="products-list">
            {products.slice(0, 60).map((f) => (
              <button
                type="button"
                key={f.id}
                className="products-item"
                onClick={() =>
                  setSheet({ food: f, missing: [], isNew: false, shared })
                }
              >
                {f.image ? (
                  <img src={f.image} alt="" loading="lazy" />
                ) : (
                  <span className="product-initial" aria-hidden="true">
                    {f.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span>
                  <strong>{f.name}</strong>
                  <small>
                    {[
                      f.brand,
                      `${Math.round(f.per100.calories)} kcal / 100 ${f.unit}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {scanning && (
        <BarcodeScanner
          onResult={(value) => {
            setScanning(false);
            setCode(value);
            void lookup(value);
          }}
          onClose={() => setScanning(false)}
        />
      )}
      {sheet && (
        <ProductSheet
          key={sheet.food.id}
          food={sheet.food}
          missing={sheet.missing}
          isNew={sheet.isNew}
          shared={sheet.shared}
          onAdd={(food, grams) => {
            setSheet(undefined);
            afterBack(() => onAdd(food, grams));
          }}
          onClose={() => setSheet(undefined)}
        />
      )}
    </div>
  );
}
