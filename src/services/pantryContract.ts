// "Productos de la casa": packaged products scanned by Luca or Ari, shared by both.
import { z } from "zod";

const amount = z.number().finite().nonnegative().max(100000);

export const sharedProductSchema = z
  .object({
    id: z.string().min(1).max(64),
    barcode: z
      .string()
      .regex(/^\d{8,14}$/)
      .or(z.literal("")),
    name: z.string().trim().min(1).max(150),
    brand: z.string().max(150).default(""),
    quantity: z.string().max(60).optional(),
    category: z.string().max(120).optional(),
    image: z
      .string()
      .max(500)
      .regex(/^https:\/\//)
      .optional(),
    servingSize: z.number().positive().max(10000).default(100),
    unit: z.enum(["g", "ml"]).default("g"),
    per100: z.object({
      calories: amount,
      protein: amount,
      carbs: amount,
      fat: amount,
      fiber: amount,
    }),
    sugars: amount.optional(),
    saturatedFat: amount.optional(),
    sodiumMg: amount.optional(),
    fiberKnown: z.boolean().optional(),
    ingredients: z.string().max(2000).optional(),
    allergens: z.array(z.string().max(60)).max(30).optional(),
    nutriScore: z.enum(["a", "b", "c", "d", "e"]).optional(),
    nova: z.number().int().min(1).max(4).optional(),
    source: z.enum(["openfoodfacts", "manual"]),
    verified: z.boolean().default(false),
    addedBy: z.enum(["luca", "ari"]),
    updatedAt: z.string().max(40),
  })
  .strict();
export type SharedProduct = z.infer<typeof sharedProductSchema>;

const who = z.enum(["luca", "ari"]);
export const pantryActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("read"), profileId: who }).strict(),
  z
    .object({
      action: z.literal("save"),
      profileId: who,
      products: z.array(sharedProductSchema).min(1).max(100),
    })
    .strict(),
  z
    .object({
      action: z.literal("remove"),
      profileId: who,
      id: z.string().min(1).max(64),
    })
    .strict(),
]);
export type PantryAction = z.infer<typeof pantryActionSchema>;
export const PANTRY_LIMIT = 3000;
