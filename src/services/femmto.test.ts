import { expect, it } from "vitest";
import { parseFemmtoLines, reportFeedback } from "./femmto";
import { weightSchema } from "../schemas";
import { meta } from "../db";
const lines = [
  "ID Altura Edad Género Fecha / hora",
  "Persona Ejemplo 170 cm 30 Masculino 2026-09-01 10:00",
  "Análisis de Masa muscular",
  "Peso (Kg) 35 44 53 62 71 80",
  "70,2",
  "Masa muscular esqueletica",
  "35.7",
  "Masa de grasa corporal (Kg) 1 5 9 13 17",
  "9.8",
  "IMC",
  "(Kg/m²)",
  "11 15 19 23 27 31",
  "Indice de masa corporal",
  "24.3",
  "PGC (%)",
  "0 7 14 21 28",
  "Porcentaje de grasa corporal",
  "14,05",
];
it("lee valores y fecha de medición, omite ejes y respeta unidades", () => {
  const r = parseFemmtoLines(lines);
  expect(r.date).toBe("2026-09-01");
  expect(r.kg).toBe(70.2);
  expect(r.name).toBe("Persona Ejemplo");
  expect(r.metrics).toContainEqual({
    name: "IMC",
    value: 24.3,
    unit: "índice",
  });
  expect(r.metrics).toContainEqual({
    name: "Grasa corporal",
    value: 14.05,
    unit: "%",
  });
  expect(r.metrics).toContainEqual({
    name: "Músculo esquelético",
    value: 35.7,
    unit: "kg",
  });
  expect(() => parseFemmtoLines(lines.slice(2))).toThrow("fecha");
});
it("no interpreta composición aislada ni compara porcentajes contra kilos", () => {
  const old = weightSchema.parse({
    ...meta("luca"),
    date: "2026-09-01",
    kg: 70,
    composition: {
      source: "Femmto",
      metrics: [{ name: "Músculo esquelético", value: 50, unit: "%" }],
    },
  });
  const recent = weightSchema.parse({
    ...meta("luca"),
    date: "2026-09-08",
    kg: 70.2,
    composition: {
      source: "Femmto",
      metrics: [{ name: "Músculo esquelético", value: 35, unit: "kg" }],
    },
  });
  expect(reportFeedback([old])).toContainEqual(
    expect.stringContaining("referencia inicial"),
  );
  expect(reportFeedback([old, recent]).join(" ")).not.toContain(
    "Músculo esquelético:",
  );
  expect(reportFeedback([old, recent]).join(" ")).toContain("+0.20 kg");
  expect(() =>
    weightSchema.parse({
      ...recent,
      composition: {
        source: "Femmto",
        metrics: [{ name: "Grasa corporal", value: 120, unit: "%" }],
      },
    }),
  ).toThrow();
});
