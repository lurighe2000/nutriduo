import { z } from "zod";
export const nonnegative = z.number().finite().min(0).max(100000);
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    "Fecha inválida",
  );
export const sourceSchema = z.enum([
  "manual",
  "label",
  "barcode",
  "estimated",
  "ai_estimated",
  "verified",
  "database",
]);
export const micronutrientsSchema = z.object({
  sodium_mg: nonnegative.optional(),
  potassium_mg: nonnegative.optional(),
  calcium_mg: nonnegative.optional(),
  iron_mg: nonnegative.optional(),
  magnesium_mg: nonnegative.optional(),
  zinc_mg: nonnegative.optional(),
  vitamin_a_ug: nonnegative.optional(),
  vitamin_c_mg: nonnegative.optional(),
  vitamin_d_ug: nonnegative.optional(),
  vitamin_e_mg: nonnegative.optional(),
  vitamin_b12_ug: nonnegative.optional(),
  folate_ug: nonnegative.optional(),
});
export const nutritionReferenceSchema = z.object({
  source: z.enum(["usda", "openfoodfacts"]),
  id: z.string().min(1).max(100),
  description: z.string().min(1).max(300),
});
export const macrosSchema = z.object({
  calories: nonnegative,
  protein: nonnegative,
  carbs: nonnegative,
  fat: nonnegative,
  fiber: nonnegative,
});
export const baseSchema = z.object({
  id: z.string().min(1),
  profileId: z.enum(["luca", "ari"]),
  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.number().int().positive(),
});
export const foodSchema = baseSchema.extend({
  name: z.string().trim().min(1).max(150),
  brand: z.string().default(""),
  barcode: z.string().default(""),
  source: sourceSchema,
  per100: macrosSchema,
  servingSize: z.number().positive().max(10000).default(100),
  unit: z.enum(["g", "ml"]).default("g"),
  verified: z.boolean().default(false),
  favorite: z.boolean().default(false),
  sourceUrl: z.string().default(""),
  sugars: nonnegative.optional(),
  saturatedFat: nonnegative.optional(),
  sodium: nonnegative.optional(),
  salt: nonnegative.optional(),
  micronutrientsPer100: micronutrientsSchema.optional(),
  fiberKnown: z.boolean().optional(),
  nutritionReference: nutritionReferenceSchema.optional(),
  // Packaged products (barcode): label details shared in "Productos de la casa".
  quantity: z.string().max(60).optional(),
  category: z.string().max(120).optional(),
  image: z.string().max(500).optional(),
  ingredients: z.string().max(2000).optional(),
  allergens: z.array(z.string().max(60)).max(30).optional(),
  nutriScore: z.enum(["a", "b", "c", "d", "e"]).optional(),
  nova: z.number().int().min(1).max(4).optional(),
  sharedBy: z.enum(["luca", "ari"]).optional(),
});
export const itemSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1).max(150),
  grams: z.number().positive().max(10000),
  per100: macrosSchema,
  source: sourceSchema,
  confidence: z.number().min(0).max(1).optional(),
  cooking: z.string().max(200).default(""),
  foodId: z.string().optional(),
  micronutrientsPer100: micronutrientsSchema.optional(),
  fiberKnown: z.boolean().optional(),
  nutritionReference: nutritionReferenceSchema.optional(),
  nutritionQuery: z.string().max(150).optional(),
});
export const imageSchema = z
  .string()
  .max(4000000)
  .regex(/^data:image\/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$/);
export const mealSchema = baseSchema.extend({
  date: dateSchema,
  time: z.string().regex(/^\d{2}:\d{2}$/),
  name: z.string().trim().min(1).max(150),
  type: z.enum([
    "Desayuno",
    "Almuerzo",
    "Merienda",
    "Cena",
    "Snack",
    "Pre-entreno",
    "Post-entreno",
    "Otro",
  ]),
  items: z.array(itemSchema).min(1).max(50),
  notes: z.string().max(2000).default(""),
  photo: imageSchema.optional(),
  photos: z.array(imageSchema).optional(),
});
export const recipeSchema = baseSchema.extend({
  name: z.string().trim().min(1).max(150),
  servings: z.number().positive().max(1000),
  items: z.array(itemSchema).min(1).max(50),
});
export const weightSchema = baseSchema.extend({
  date: dateSchema,
  kg: z.number().finite().min(25).max(350),
  composition: z
    .object({
      source: z.string().max(80),
      notes: z.string().max(500).default(""),
      reportFile: z.string().max(200).optional(),
      metrics: z
        .array(
          z
            .object({
              name: z.string().trim().min(1).max(80),
              value: z.number().finite().nonnegative().max(10000),
              unit: z.enum(["%", "kg", "L", "kcal/día", "índice", "años"]),
            })
            .refine(
              (m) => m.unit !== "%" || m.value <= 100,
              "Un porcentaje debe estar entre 0 y 100",
            ),
        )
        .max(20),
    })
    .optional(),
});
export const measurementSchema = baseSchema.extend({
  date: dateSchema,
  name: z.string().trim().min(1).max(80),
  cm: z.number().positive().max(400),
});
export const photoSchema = baseSchema.extend({
  date: dateSchema,
  view: z.enum([
    "Frente",
    "Lateral izquierdo",
    "Lateral derecho",
    "Espalda",
    "Libre",
  ]),
  image: imageSchema,
  thumbnail: imageSchema,
  weight: z.number().positive().optional(),
});
export const exerciseSchema = z
  .object({
    id: z.string(),
    name: z.string().trim().min(1).max(120),
    sets: z.number().int().min(1).max(10),
    minReps: z.number().int().min(1).max(100),
    maxReps: z.number().int().min(1).max(100),
  })
  .refine((x) => x.maxReps >= x.minReps, {
    message: "El máximo debe ser mayor o igual al mínimo",
  });
export const planSchema = baseSchema.extend({
  name: z.string().min(1),
  days: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().min(1),
        exercises: z.array(exerciseSchema).min(1),
      }),
    )
    .min(1),
});
export const setSchema = z.object({
  exerciseId: z.string(),
  exerciseName: z.string(),
  kg: z.number().min(0).max(1000),
  reps: z.number().int().min(1).max(200),
  rir: z.number().min(0).max(10).optional(),
  notes: z.string().max(500).default(""),
});
export const sessionSchema = baseSchema.extend({
  date: dateSchema,
  dayId: z.string(),
  name: z.string().min(1),
  sets: z.array(setSchema).min(1).max(200),
  notes: z.string().max(1000).default(""),
});
export const checkinSchema = baseSchema.extend({
  date: dateSchema,
  hunger: z.number().int().min(1).max(5),
  energy: z.number().int().min(1).max(5),
  sleep: z.number().int().min(1).max(5),
  performance: z.number().int().min(1).max(5),
  difficulty: z.number().int().min(1).max(5),
  training: z.number().int().min(1).max(5),
});
export const hydrationSchema = baseSchema.extend({
  date: dateSchema,
  ml: z.number().int().positive().max(5000),
});
export const activitySchema = baseSchema.extend({
  date: dateSchema,
  steps: z.number().int().min(0).max(100000),
  padel: z.boolean().default(false),
  runs: z
    .array(
      z.object({
        id: z.string().min(1),
        kind: z.enum(["Caminata", "Caminata y trote", "Carrera"]),
        distanceKm: z.number().finite().positive().max(200),
        durationSeconds: z.number().int().positive().max(86400),
        calories: nonnegative.optional(),
        maxSpeed: z.number().finite().nonnegative().max(100).optional(),
        elevation: nonnegative.optional(),
        heartRate: z.number().int().min(30).max(240).optional(),
        source: z.string().max(80).default("Manual"),
        notes: z.string().max(1000).default(""),
        // Recorded with the in-app GPS tracker (Mis salidas).
        route: z.string().max(80000).optional(),
        splits: z
          .array(z.number().int().positive().max(7200))
          .max(300)
          .optional(),
        cadence: z.number().int().min(30).max(260).optional(),
        heartRateMax: z.number().int().min(30).max(250).optional(),
        startedAt: z.string().max(40).optional(),
      }),
    )
    .max(20)
    .optional(),
});
export const adjustmentSchema = baseSchema.extend({
  date: dateSchema,
  amount: z.number().min(-150).max(150),
  explanation: z.string(),
  previousCalories: z.number().positive(),
});
export const settingSchema = baseSchema.extend({
  date: dateSchema,
  complete: z.boolean(),
});
export const goalSchema = macrosSchema.extend({
  calories: z.number().finite().min(1200).max(6000),
  protein: z.number().finite().positive().max(500),
  carbs: z.number().finite().positive().max(1200),
  fat: z.number().finite().positive().max(300),
  fiber: z.number().finite().positive().max(100),
  water: z.number().min(250).max(10000),
  steps: z.number().int().min(0).max(50000),
});
export const profileSchema = z.object({
  id: z.enum(["luca", "ari"]),
  name: z.string().min(1).max(50),
  avatar: imageSchema.optional(),
  birthDate: dateSchema.or(z.literal("")),
  sex: z.enum(["male", "female"]),
  height: z.number().min(0).max(230),
  initialWeight: z.number().min(0).max(350),
  activity: z.number().min(1.2).max(1.9),
  gymDays: z.number().int().min(0).max(6),
  goal: z.enum(["gain", "loss"]),
  excluded: z.array(z.string()),
  targets: goalSchema.optional(),
  weeklyBudget: z.number().finite().nonnegative().max(10000000).optional(),
  weeklyMenu: z
    .object({
      week: dateSchema,
      targets: goalSchema,
      meals: z
        .array(
          z.object({
            day: z.number().int().min(0).max(6),
            slot: z.enum(["Desayuno", "Almuerzo", "Merienda", "Cena"]),
            recipe: z.enum([
              "oats",
              "yogurt",
              "toast",
              "cream",
              "chickenRice",
              "beefPotato",
              "lentils",
              "milanesa",
              "tuna",
              "chickenPotato",
              "beefRice",
            ]),
            portions: z.record(
              z
                .string()
                .refine(
                  (key) =>
                    [
                      "oats",
                      "milk",
                      "yogurt",
                      "bread",
                      "rice",
                      "brownRice",
                      "chicken",
                      "beef",
                      "egg",
                      "lentils",
                      "banana",
                      "apple",
                      "tomato",
                      "carrot",
                      "potato",
                      "lettuce",
                      "peanuts",
                      "tuna",
                      "creamCheese",
                      "riceCake",
                      "oil",
                    ].includes(key),
                  "Alimento desconocido en el menú",
                ),
              z.number().finite().positive().max(10000),
            ),
          }),
        )
        .length(28)
        .refine(
          (meals) =>
            new Set(meals.map((m) => `${m.day}:${m.slot}`)).size === 28,
          "El menú debe tener cuatro comidas distintas por día",
        ),
    })
    .optional(),
  onboarded: z.boolean().default(false),
  dark: z.boolean().default(false),
  mascotPaused: z.boolean().optional(),
  reminders: z.boolean().default(true),
  pinHash: z.string().optional(),
  pinSalt: z.string().optional(),
  failedAttempts: z.number().default(0),
  lockedUntil: z.number().default(0),
});
export const aiSchema = z.object({
  meal_name: z.string().trim().min(1).max(150),
  confidence: z.number().min(0).max(1),
  foods: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(150),
        estimated_grams: z.number().positive().max(10000),
        calories: nonnegative,
        protein_g: nonnegative,
        carbs_g: nonnegative,
        fat_g: nonnegative,
        fiber_g: nonnegative.optional(),
        confidence: z.number().min(0).max(1),
        cooking: z.string().max(200).optional(),
        database_query: z.string().max(150).optional(),
      }),
    )
    .min(1)
    .max(50),
  questions: z.array(z.string().max(500)).max(20),
});
export const tables = {
  foods: foodSchema,
  meals: mealSchema,
  recipes: recipeSchema,
  weights: weightSchema,
  measurements: measurementSchema,
  photos: photoSchema,
  plans: planSchema,
  sessions: sessionSchema,
  checkins: checkinSchema,
  hydration: hydrationSchema,
  activity: activitySchema,
  adjustments: adjustmentSchema,
  settings: settingSchema,
};
export type TableName = keyof typeof tables;
export type Records = { [K in TableName]: z.infer<(typeof tables)[K]> };
export const profileIdentitySchema = profileSchema
  .pick({ name: true, avatar: true })
  .extend({ name: z.string().trim().min(1, "Ingresá tu nombre.").max(50) })
  .strict();
export type Profile = z.infer<typeof profileSchema>;
export type ProfileId = Profile["id"];
export type Macros = z.infer<typeof macrosSchema>;
export type Micronutrients = z.infer<typeof micronutrientsSchema>;
export type Item = z.infer<typeof itemSchema>;
export type Food = Records["foods"];
export type Meal = Records["meals"];
export type Recipe = Records["recipes"];
export type Exercise = z.infer<typeof exerciseSchema>;
export type ExerciseSet = z.infer<typeof setSchema>;
export type NutritionGoal = z.infer<typeof goalSchema>;
export type Backup = z.infer<typeof backupSchema>;
export const backupSchema = z
  .object({
    app: z.literal("NutriDuo"),
    schemaVersion: z.literal(1),
    exportedAt: z.string(),
    profile: profileSchema.omit({
      pinHash: true,
      pinSalt: true,
      failedAttempts: true,
      lockedUntil: true,
    }),
    data: z.object({
      foods: z.array(foodSchema),
      meals: z.array(mealSchema),
      recipes: z.array(recipeSchema),
      weights: z.array(weightSchema),
      measurements: z.array(measurementSchema),
      photos: z.array(photoSchema),
      plans: z.array(planSchema),
      sessions: z.array(sessionSchema),
      checkins: z.array(checkinSchema),
      hydration: z.array(hydrationSchema),
      activity: z.array(activitySchema),
      adjustments: z.array(adjustmentSchema),
      settings: z.array(settingSchema),
    }),
  })
  .superRefine((b, ctx) => {
    for (const [table, rows] of Object.entries(b.data)) {
      const ids = new Set<string>();
      for (const row of rows) {
        if (row.profileId !== b.profile.id)
          ctx.addIssue({
            code: "custom",
            message: `${table}: perfil mezclado`,
          });
        if (ids.has(row.id))
          ctx.addIssue({ code: "custom", message: `${table}: ID duplicado` });
        ids.add(row.id);
      }
      if (["weights", "activity", "settings", "checkins"].includes(table)) {
        const dates = rows.map((r) => ("date" in r ? r.date : ""));
        if (new Set(dates).size !== dates.length)
          ctx.addIssue({
            code: "custom",
            message: `${table}: fechas duplicadas`,
          });
      }
    }
  });
