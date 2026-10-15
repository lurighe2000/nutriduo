import {
  PANTRY_LIMIT,
  pantryActionSchema,
  sharedProductSchema,
  type SharedProduct,
} from "../src/services/pantryContract";
import type { VaultStore } from "./cloud";

const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
const key = (id: string) => `pantry:${id}`;

async function all(store: VaultStore) {
  const items = await store.list<SharedProduct>({ prefix: "pantry:" });
  return [...items.values()]
    .map((p) => sharedProductSchema.safeParse(p))
    .flatMap((p) => (p.success ? [p.data] : []))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

// Shared by both profiles; called only through the Worker after the caller
// authenticated against their own vault. Products are public label data.
export async function pantryRoute(body: unknown, storage: VaultStore) {
  try {
    const input = pantryActionSchema.parse(body);
    return await storage.transaction(async (tx) => {
      if (input.action === "save") {
        const current = await all(tx);
        const byBarcode = new Map(
          current.filter((p) => p.barcode).map((p) => [p.barcode, p]),
        );
        let count = current.length;
        const writes: Record<string, SharedProduct> = {};
        for (const product of input.products) {
          const existing =
            (product.barcode && byBarcode.get(product.barcode)) ||
            current.find((p) => p.id === product.id);
          if (existing && existing.updatedAt > product.updatedAt) continue;
          if (!existing && ++count > PANTRY_LIMIT)
            return response(
              { error: "Se llenó la lista de productos compartidos." },
              409,
            );
          writes[key(existing?.id ?? product.id)] = {
            ...product,
            id: existing?.id ?? product.id,
          };
        }
        if (Object.keys(writes).length) await tx.put(writes);
      } else if (input.action === "remove") await tx.delete([key(input.id)]);
      return response({ products: await all(tx) });
    });
  } catch (error) {
    return response(
      {
        error:
          error instanceof Error && !("issues" in error)
            ? error.message
            : "Datos de productos inválidos.",
      },
      400,
    );
  }
}
