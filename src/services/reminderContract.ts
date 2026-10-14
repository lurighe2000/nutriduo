import { z } from "zod";
export const reminderPreferencesSchema = z.object({
  meals: z.boolean(),
  movement: z.boolean(),
  strength: z.boolean(),
  weight: z.boolean(),
  report: z.boolean(),
});
export type ReminderPreferences = z.infer<typeof reminderPreferencesSchema>;
export const defaultReminders: ReminderPreferences = {
  meals: true,
  movement: true,
  strength: true,
  weight: true,
  report: true,
};
export function remindersAt(
  timestamp: number,
  preferences: ReminderPreferences,
) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Argentina/Buenos_Aires",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(timestamp)
      .map((p) => [p.type, p.value]),
  );
  const date = `${parts.year}-${parts.month}-${parts.day}`,
    minutes = Number(parts.hour) * 60 + Number(parts.minute),
    weekday = new Date(date + "T12:00:00Z").getUTCDay();
  const reminders = [
    {
      id: "weight",
      group: "weight",
      at: 410,
      title: "Un momento para tu seguimiento",
      body: "Si hoy vas a pesarte, hacelo antes de desayunar y entrenar. Guardá el peso cuando puedas.",
    },
    {
      id: "movement",
      group: "movement",
      at: 430,
      title: "¿Salimos a tomar aire?",
      body: "Una caminata o un trote suave para arrancar el día. Después podés guardar tu salida.",
    },
    {
      id: "breakfast",
      group: "meals",
      at: 510,
      title: "Buen día ☀️",
      body: "Cuando desayunes, contanos qué comiste. Tu registro se construye de a poquito.",
    },
    {
      id: "lunch",
      group: "meals",
      at: 780,
      title: "Una pausa para el almuerzo",
      body: "Disfrutá tu comida y acordate de registrarla cuando tengas un momento.",
    },
    {
      id: "snack",
      group: "meals",
      at: 1020,
      title: "¿Cómo viene esa merienda?",
      body: "Si comiste algo, sumalo a tu día. Una foto y una descripción pueden ayudarte.",
    },
    {
      id: "strength",
      group: "strength",
      at: 1080,
      title: "Un ratito para ganar fuerza",
      body: "Hoy toca tu rutina en casa. Hacela a tu ritmo y registrá las series que completaste.",
      days: [2, 5],
    },
    {
      id: "dinner",
      group: "meals",
      at: 1260,
      title: "Cerremos el día con calma",
      body: "Después de cenar, guardá lo que comiste y revisá si tu día quedó completo.",
    },
    {
      id: "report",
      group: "report",
      at: 1170,
      title: "Domingo de seguimiento 🌱",
      body: "Exportá tu PDF de Femmto y subilo en Progreso → Informe Femmto. Revisemos juntos tu recorrido.",
      days: [0],
    },
  ];
  return reminders
    .filter(
      (r) =>
        preferences[r.group as keyof ReminderPreferences] &&
        (!r.days || r.days.includes(weekday)) &&
        minutes >= r.at &&
        minutes < r.at + 5,
    )
    .map((r) => ({ ...r, date, tag: `nutriduo-${date}-${r.id}` }));
}
