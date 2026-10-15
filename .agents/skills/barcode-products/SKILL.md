---
name: barcode-products
description: Barcode scanning, Open Food Facts lookups and the shared "Productos de la casa" list in NutriDuo. Use when touching the scanner, product card, product data or its cloud sync.
---

# Barcode products in NutriDuo

## Flow

1. Comidas → Registrar comida → "Código de barras" tab (`src/features/meals/ProductsPanel.tsx`).
2. "Escanear producto" opens `BarcodeScanner.tsx`: its own `<dialog>` (so it stacks above the meal modal), back camera (`facingMode: environment`), native `BarcodeDetector` when present (Chrome Android), otherwise ZXing `decodeFromStream`. Codes are accepted only with a valid EAN/UPC check digit (`validBarcode`). Torch toggle when the track supports it; "Escribir el número" fallback.
3. `findProduct` (`src/services/products.ts`): this profile's saved products first, then Open Food Facts (`lc=es`, label fields, image, ingredients, allergens, Nutri-Score, NOVA). Missing macros are listed so the card opens in edit mode.
4. `ProductSheet.tsx`: full label table per 100 and per chosen amount, allergens, ingredients, "Agregar a la comida" (adds the item with the chosen grams) and "Corregir datos" (marks it verified).
5. Not on Open Food Facts, or missing values: the card opens in edit mode. "Sacale una foto a la tabla" sends one photo to the Worker route `/label` (Groq vision, `src/services/labelContract.ts`); it returns the printed values per 100 or per portion and `labelPer100` converts them. The person always reviews before saving.
6. "¿Cuánto comiste?": 1 or 2 portions, half or whole package (parsed from the package quantity), 100 g, or any amount.

## Sharing between Luca and Ari

- Products live in each profile's `foods` table (`source: "barcode"`), so "Mis alimentos" and offline use keep working.
- `src/services/pantry.ts` syncs them with the Worker route `/cloud/pantry` (contract in `src/services/pantryContract.ts`, storage in `worker/pantry.ts`: one Durable Object key per product in the shared `nutriduo-household` vault). The caller must authenticate against their own vault first (same as the shared menu). Without "Cuenta y respaldo" products stay on that phone.
- Merge rule: compare label content (ignoring id, author and dates); if different, the newest `updatedAt` wins. Same barcode means same product.
- Label data is public product information, so it is stored in plain text, unlike personal backups.

## Shipping

- Worker changes need `npx wrangler deploy` from `worker/` on Luca's PC: create `_publicar/worker.flag` next to `_publicar/subir.flag`.
- Tests: `src/services/pantry.test.ts` (route with an in-memory store, check digits) and the Playwright tests "producto, corrección…" and "escanea un producto que no existe…".
