import { describe, expect, it } from "vitest";
import { pantryRoute } from "../../worker/pantry";
import type { VaultStore } from "../../worker/cloud";
import type { SharedProduct } from "./pantryContract";
import { validBarcode } from "./products";

function memoryStore(): VaultStore {
  const data = new Map<string, unknown>();
  const store: VaultStore = {
    async get<T>(key: string) {
      return data.get(key) as T | undefined;
    },
    async put(key: string | Record<string, unknown>, value?: unknown) {
      if (typeof key === "string") data.set(key, value);
      else for (const [k, v] of Object.entries(key)) data.set(k, v);
    },
    async delete(keys: string[]) {
      return keys.filter((k) => data.delete(k)).length;
    },
    async list<T>({ prefix }: { prefix: string }) {
      return new Map(
        [...data].filter(([k]) => k.startsWith(prefix)) as [string, T][],
      );
    },
    async transaction<T>(work: (s: VaultStore) => Promise<T>) {
      return work(store);
    },
  };
  return store;
}

const product = (over: Partial<SharedProduct> = {}): SharedProduct => ({
  id: "p1",
  barcode: "7790580123456",
  name: "Yogur",
  brand: "Casa",
  servingSize: 190,
  unit: "g",
  per100: { calories: 80, protein: 9, carbs: 6, fat: 2, fiber: 0 },
  source: "manual",
  verified: true,
  addedBy: "luca",
  updatedAt: "2026-10-15T10:00:00.000Z",
  ...over,
});

async function call(store: VaultStore, body: object) {
  const response = await pantryRoute(body, store);
  return { status: response.status, data: await response.json() };
}

describe("productos de la casa", () => {
  it("lo que guarda Luca lo ve Ari, y gana la versión más nueva", async () => {
    const store = memoryStore();
    await call(store, {
      action: "save",
      profileId: "luca",
      products: [product()],
    });
    let read = await call(store, { action: "read", profileId: "ari" });
    expect(read.data.products).toHaveLength(1);
    // Ari corrects the label under another id: same barcode, newer date.
    await call(store, {
      action: "save",
      profileId: "ari",
      products: [
        product({
          id: "p2",
          name: "Yogur natural",
          addedBy: "ari",
          updatedAt: "2026-10-16T10:00:00.000Z",
        }),
      ],
    });
    // An older copy does not overwrite it.
    await call(store, {
      action: "save",
      profileId: "luca",
      products: [product()],
    });
    read = await call(store, { action: "read", profileId: "luca" });
    expect(read.data.products).toHaveLength(1);
    expect(read.data.products[0].name).toBe("Yogur natural");
    expect(read.data.products[0].id).toBe("p1");
    await call(store, { action: "remove", profileId: "ari", id: "p1" });
    read = await call(store, { action: "read", profileId: "ari" });
    expect(read.data.products).toHaveLength(0);
  });

  it("rechaza datos inválidos", async () => {
    const bad = await call(memoryStore(), {
      action: "save",
      profileId: "luca",
      products: [{ ...product(), barcode: "abc" }],
    });
    expect(bad.status).toBe(400);
  });

  it("valida el dígito verificador del código de barras", () => {
    expect(validBarcode("3017620422003")).toBe(true);
    expect(validBarcode("3017620422004")).toBe(false);
    expect(validBarcode("12345")).toBe(false);
  });
});
