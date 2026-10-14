import { dateSchema, type Records } from "../schemas";
type Metric = NonNullable<Records["weights"]["composition"]>["metrics"][number];
export type FemmtoReading = {
  date: string;
  kg: number;
  name: string;
  metrics: Metric[];
};
const clean = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
export function parseFemmtoLines(lines: string[]): FemmtoReading {
  const rows = lines.map(clean);
  const header = rows.find((r) => /\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(r));
  if (!header)
    throw new Error(
      "No se detectó la fecha de la medición. No usamos la fecha del nombre del archivo. Podés registrar los datos manualmente.",
    );
  const date = dateSchema.parse(header.match(/\d{4}-\d{2}-\d{2}/)![0]);
  const number = (s: string) => Number(s.replace(",", "."));
  function after(label: RegExp, last = false) {
    const indexes = rows.flatMap((r, i) => (label.test(r) ? [i] : []));
    const index = last ? indexes.at(-1) : indexes[0];
    if (index === undefined) return undefined;
    for (const row of rows.slice(index + 1, index + 7)) {
      if (/^\d+[.,]?\d*$/.test(row)) return number(row);
      if (/Analisis|Peso|PGC|IMC/.test(row)) break;
    }
    return undefined;
  }
  const kg = after(/^Peso\s*\(Kg\)/i);
  if (kg === undefined || kg < 25 || kg > 350)
    throw new Error(
      "No se pudo leer el peso con seguridad. Registrá la medición manualmente.",
    );
  const metrics: Metric[] = [];
  for (const [label, name, unit, last] of [
    [/^IMC\b/, "IMC", "índice", false],
    [/^Porcentaje de grasa corporal/, "Grasa corporal", "%", false],
    [/^Masa muscular esqueletica/, "Músculo esquelético", "kg", false],
    [/^Masa de grasa corporal\s*\(Kg\)/i, "Masa de grasa corporal", "kg", true],
  ] as const) {
    const value = after(label, last);
    if (value !== undefined && (unit !== "%" || value <= 100))
      metrics.push({ name, value, unit });
  }
  const water = rows.find((r) =>
    /^Total de agua corporal\s*\(L\)\s+\d/.test(r),
  );
  if (water) {
    const n = water.match(/\(L\)\s+(\d+[.,]?\d*)/);
    if (n)
      metrics.push({ name: "Agua corporal", value: number(n[1]), unit: "L" });
  }
  return {
    date,
    kg,
    name: header.split(/\s+\d+[.,]?\d*\s+cm\b/i)[0].trim(),
    metrics,
  };
}
export async function readFemmtoPDF(file: File) {
  if (file.size > 10_000_000) throw new Error("Máximo 10 MB por informe");
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-")
    throw new Error("Elegí un archivo PDF válido");
  const pdf = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdf.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdf.getDocument({
    data: bytes,
    useSystemFonts: true,
  });
  try {
    const doc = await task.promise;
    if (doc.numPages > 20)
      throw new Error("El informe debe tener como máximo 20 páginas");
    const page = await doc.getPage(1),
      content = await page.getTextContent();
    const lines = new Map<number, { x: number; text: string }[]>();
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      const row = lines.get(y) ?? [];
      row.push({ x: item.transform[4], text: item.str });
      lines.set(y, row);
    }
    const text = [...lines]
      .sort((a, b) => b[0] - a[0])
      .map(([, row]) =>
        row
          .sort((a, b) => a.x - b.x)
          .map((i) => i.text)
          .join(" "),
      );
    return parseFemmtoLines(text);
  } finally {
    await task.destroy();
  }
}
export function reportFeedback(rows: Records["weights"][]) {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const current = sorted.at(-1);
  if (!current)
    return [
      "Subí un informe o guardá una medición para empezar el seguimiento.",
    ];
  const previous = sorted
    .filter(
      (r) =>
        r.date <= current.date &&
        new Date(current.date).getTime() - new Date(r.date).getTime() >=
          7 * 86400000,
    )
    .at(-1);
  const feedback = [`Última medición: ${current.kg} kg, del ${current.date}.`];
  if (!previous)
    feedback.push(
      "Todavía no hay dos mediciones separadas por al menos siete días. Este informe es una referencia inicial, no permite confirmar ganancia muscular ni pérdida de grasa.",
    );
  else {
    const days = Math.round(
      (new Date(current.date).getTime() - new Date(previous.date).getTime()) /
        86400000,
    );
    const delta = current.kg - previous.kg;
    feedback.push(
      `El peso cambió ${delta >= 0 ? "+" : ""}${delta.toFixed(2)} kg en ${days} días. Compará también los promedios semanales de Peso, energía y rendimiento.`,
    );
    for (const m of current.composition?.metrics ?? []) {
      const old =
        previous.composition?.source === current.composition?.source
          ? previous.composition?.metrics.find(
              (x) => x.name === m.name && x.unit === m.unit,
            )
          : undefined;
      if (!old) continue;
      const difference = m.value - old.value;
      feedback.push(
        `${m.name}: ${difference >= 0 ? "+" : ""}${difference.toFixed(2)} ${m.unit === "%" ? "puntos porcentuales" : m.unit} entre esas mediciones. Es un cambio en la estimación de la balanza.`,
      );
    }
  }
  feedback.push(
    "Mantené condiciones similares al medir. Grasa, tejido magro y músculo estimados cambian con la hidratación; un cambio aislado no demuestra tejido ganado o perdido. El informe no modifica tus objetivos automáticamente.",
  );
  return feedback;
}
