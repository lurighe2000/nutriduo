import { z } from "zod";
import { goalSchema, type Profile } from "../schemas";
const assessmentSchema = z.object({
  id: z.enum(["luca", "ari"]),
  assessmentAge: z.number().int().min(18).max(100),
  height: z.number().min(100).max(230),
  initialWeight: z.number().min(25).max(350),
  activity: z.number().min(1.2).max(1.9),
  gymDays: z.number().int().min(0).max(6),
  goal: z.enum(["gain", "loss"]),
  excluded: z.array(z.string().max(80)).max(30),
  targets: goalSchema,
  weeklyBudget: z.number().finite().nonnegative().max(10000000).optional(),
  notes: z.string().max(2000).optional(),
});
export function importGoals(text: string, profile: Profile) {
  if (text.length > 30000)
    throw new Error("La configuración es demasiado grande");
  const pack = z
    .object({
      app: z.literal("NutriDuo-objetivos"),
      profiles: z.array(assessmentSchema).min(1).max(2),
    })
    .parse(JSON.parse(text));
  const selected = pack.profiles.find((p) => p.id === profile.id);
  if (!selected) throw new Error("Este archivo no incluye el perfil activo");
  const { assessmentAge, notes, ...values } = selected;
  return { profile: { ...profile, ...values }, assessmentAge, notes };
}
