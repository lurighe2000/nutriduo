import { z } from "zod";
import { dateSchema, goalSchema, profileSchema } from "../schemas";
export const householdMemberSchema = z
  .object({
    name: z.string().min(1).max(50),
    targets: goalSchema,
    excluded: z.array(z.string().max(100)).max(100),
    sourceRevision: z.number().int().nonnegative(),
  })
  .strict();
const menu = profileSchema.shape.weeklyMenu.unwrap();
export const householdSchema = z.object({
  revision: z.number().int().nonnegative(),
  members: z.object({
    luca: householdMemberSchema.optional(),
    ari: householdMemberSchema.optional(),
  }),
  menus: z.object({ luca: menu, ari: menu }).nullable(),
});
export const householdActionSchema = z.discriminatedUnion("action", [
  z
    .object({ action: z.literal("read"), profileId: z.enum(["luca", "ari"]) })
    .strict(),
  z
    .object({
      action: z.literal("publish"),
      profileId: z.enum(["luca", "ari"]),
      member: householdMemberSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("prepare"),
      profileId: z.enum(["luca", "ari"]),
      week: dateSchema,
      revision: z.number().int().nonnegative(),
    })
    .strict(),
  z
    .object({
      action: z.literal("replace"),
      profileId: z.enum(["luca", "ari"]),
      day: z.number().int().min(0).max(6),
      slot: z.enum(["Desayuno", "Almuerzo", "Merienda", "Cena"]),
      recipe: menu.shape.meals.element.shape.recipe,
      revision: z.number().int().nonnegative(),
    })
    .strict(),
]);
export type Household = z.infer<typeof householdSchema>;
