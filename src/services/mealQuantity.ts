import { z } from "zod";
import type { Item, Food } from "../schemas";

const positive = z.number().finite().positive().max(10000);
export const measurementSchema = z
  .object({
    basis: z.enum(["g", "ml"]),
    mode: z.enum(["g", "ml", "units"]),
    unitSize: positive.optional(),
    gramsPerMl: z.number().finite().positive().max(100).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.mode === "units" && !value.unitSize)
      ctx.addIssue({
        code: "custom",
        path: ["unitSize"],
        message: "Indicá cuánto pesa o contiene una unidad.",
      });
    if (
      value.mode !== "units" &&
      value.mode !== value.basis &&
      !value.gramsPerMl
    )
      ctx.addIssue({
        code: "custom",
        path: ["gramsPerMl"],
        message: "Indicá el peso de 100 ml para convertir la cantidad.",
      });
  });
export type Measurement = z.infer<typeof measurementSchema>;
export function measurementOf(
  item: Pick<Item, "measurement" | "grams">,
): Measurement {
  return item.measurement ?? { basis: "g", mode: "g" };
}
export function foodMeasurement(
  food: Pick<Food, "measurement" | "unit">,
): Measurement {
  return food.measurement?.basis === food.unit
    ? food.measurement
    : { basis: food.unit, mode: food.unit };
}
/** Canonical amount is always expressed in the nutrition label's basis. */
export function quantityFactor(m: Measurement): number | undefined {
  if (m.mode === "units") return m.unitSize;
  if (m.mode === m.basis) return 1;
  if (!m.gramsPerMl) return undefined;
  return m.basis === "g" ? m.gramsPerMl : 1 / m.gramsPerMl;
}
export function quantityReady(item: Item) {
  return (
    (!item.measurement ||
      measurementSchema.safeParse(item.measurement).success) &&
    Number.isFinite(item.grams) &&
    item.grams > 0 &&
    item.grams <= 10000
  );
}
const number = (n: number) =>
  n.toLocaleString("es-AR", { maximumFractionDigits: 3 });
export function quantityLabel(item: Item) {
  const m = measurementOf(item);
  const factor = quantityFactor(m);
  if (!quantityReady(item) || !factor) return "Cantidad por completar";
  if (m.mode === "units")
    return `${number(item.grams / factor)} ${item.grams / factor === 1 ? "unidad" : "unidades"} · ${number(item.grams)} ${m.basis}`;
  if (m.mode !== m.basis)
    return `${number(item.grams / factor)} ${m.mode} · ${number(item.grams)} ${m.basis}`;
  return `${number(item.grams)} ${m.basis}`;
}
/** A USDA label is per 100 g; never treat 100 ml as 100 g implicitly. */
export function rebaseQuantity(item: Item, basis: "g" | "ml") {
  const m = measurementOf(item);
  if (m.basis === basis) return item;
  if (!m.gramsPerMl) return undefined;
  const factor = basis === "g" ? m.gramsPerMl : 1 / m.gramsPerMl;
  return {
    ...item,
    grams: item.grams * factor,
    measurement: {
      ...m,
      basis,
      unitSize: m.unitSize === undefined ? undefined : m.unitSize * factor,
    },
  };
}
