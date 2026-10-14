import { createBackup, download } from "./backup";
import { itemTotal, dailyTotals } from "../nutrition/formulas";
import { micronutrientExport } from "../nutrition/micronutrients";
import { type ProfileId, type Backup } from "../schemas";
type Cell = string | number | boolean | null | undefined;
type Row = Record<string, Cell>;
export function exportRows(b: Backup): Record<string, Row[]> {
  const p = b.profile;
  const d = b.data;
  return {
    Resumen: [...new Set(d.meals.map((m) => m.date))].sort().map((date) => ({
      Fecha: date,
      Perfil: p.name,
      ...dailyTotals(d.meals, date),
      Completo: d.settings.some((s) => s.date === date && s.complete),
    })),
    Comidas: d.meals.flatMap((m) =>
      m.items.map((i) => ({
        Fecha: m.date,
        Hora: m.time,
        Perfil: p.name,
        Tipo: m.type,
        Comida: m.name,
        Alimento: i.name,
        Cantidad_g: i.grams,
        Kcal: itemTotal(i).calories,
        Proteína: itemTotal(i).protein,
        Carbohidratos: itemTotal(i).carbs,
        Grasas: itemTotal(i).fat,
        Fibra: itemTotal(i).fiber,
        Fibra_con_dato: i.fiberKnown !== false,
        Fuente: i.source,
        Confianza: i.confidence,
        Notas: m.notes,
        Cocción: i.cooking,
        ...micronutrientExport(i),
        Referencia_nutricional: i.nutritionReference
          ? `${i.nutritionReference.source}:${i.nutritionReference.id}`
          : undefined,
      })),
    ),
    Alimentos: d.foods.map((f) => ({
      Perfil: p.name,
      Nombre: f.name,
      Marca: f.brand,
      Código: f.barcode,
      Fuente: f.source,
      Kcal_100: f.per100.calories,
      Proteína_100: f.per100.protein,
      Carbos_100: f.per100.carbs,
      Grasas_100: f.per100.fat,
      Fibra_100: f.per100.fiber,
      Azúcares_100: f.sugars,
      Sodio_100: f.sodium,
      Sal_100: f.salt,
      Porción: f.servingSize,
      Unidad: f.unit,
      URL: f.sourceUrl,
      ...Object.fromEntries(
        Object.entries(f.micronutrientsPer100 ?? {}).map(([key, value]) => [
          `${key}_100g`,
          value,
        ]),
      ),
    })),
    Peso: d.weights.map((w) => ({ Fecha: w.date, Perfil: p.name, Kg: w.kg })),
    Medidas: d.measurements.map((m) => ({
      Fecha: m.date,
      Perfil: p.name,
      Medida: m.name,
      Cm: m.cm,
    })),
    Entrenamientos: d.sessions.flatMap((s) =>
      s.sets.map((set, i) => ({
        Fecha: s.date,
        Perfil: p.name,
        Sesión: s.name,
        Ejercicio: set.exerciseName,
        Serie: i + 1,
        Kg: set.kg,
        Reps: set.reps,
        RIR: set.rir,
        Notas: set.notes || s.notes,
      })),
    ),
    Fotos_metadata: d.photos.map((ph) => ({
      Fecha: ph.date,
      Perfil: p.name,
      Vista: ph.view,
      Peso: ph.weight,
      ID: ph.id,
    })),
    Objetivos: [{ Perfil: p.name, Objetivo: p.goal, ...p.targets }],
    Checkins: d.checkins.map((c) => ({
      Fecha: c.date,
      Perfil: p.name,
      Hambre: c.hunger,
      Energía: c.energy,
      Sueño: c.sleep,
      Rendimiento: c.performance,
      Dificultad: c.difficulty,
      Entrenamiento: c.training,
    })),
    Recetas: d.recipes.flatMap((r) =>
      r.items.map((i) => ({
        Perfil: p.name,
        Receta: r.name,
        Porciones: r.servings,
        Ingrediente: i.name,
        Gramos: i.grams,
        ...itemTotal(i),
        ...micronutrientExport(i),
      })),
    ),
    Hidratación: d.hydration.map((w) => ({
      Fecha: w.date,
      Perfil: p.name,
      Ml: w.ml,
    })),
    Actividad: d.activity.map((a) => ({
      Fecha: a.date,
      Perfil: p.name,
      Pasos: a.steps,
      Pádel: a.padel,
    })),
    Ajustes: d.adjustments.map((a) => ({
      Fecha: a.date,
      Perfil: p.name,
      Cambio_kcal: a.amount,
      Kcal_anteriores: a.previousCalories,
      Explicación: a.explanation,
    })),
  };
}
export function csv(rows: Row[]) {
  if (!rows.length) return "\ufeffSin registros\r\n";
  const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const cell = (v: Cell) => {
    let s = String(v ?? "");
    if (/^[=+@\-\t\r]/.test(s) && typeof v === "string") s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return (
    "\ufeff" +
    [
      keys.map(cell).join(";"),
      ...rows.map((r) => keys.map((k) => cell(r[k])).join(";")),
    ].join("\r\n")
  );
}
export async function exportData(id: ProfileId, format: "xlsx" | "csv") {
  const b = await createBackup(id),
    rows = exportRows(b);
  const suffix = `${id}-${new Date().toISOString().slice(0, 10)}`;
  if (format === "csv") {
    download(
      csv(rows.Comidas),
      `nutriduo-comidas-${suffix}.csv`,
      "text/csv;charset=utf-8",
    );
    return;
  }
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  for (const [name, data] of Object.entries(rows)) {
    const sheet = workbook.addWorksheet(name);
    if (!data.length) {
      sheet.addRow(["Sin registros"]);
      continue;
    }
    const keys = [...new Set(data.flatMap((row) => Object.keys(row)))];
    sheet.columns = keys.map((key) => ({
      header: key,
      key,
      width: Math.max(16, Math.min(30, key.length + 4)),
    }));
    sheet.addRows(data);
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF123E47" },
    };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: keys.length },
    };
  }
  const buffer = await workbook.xlsx.writeBuffer();
  download(
    new Uint8Array(buffer),
    `nutriduo-${suffix}.xlsx`,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}
