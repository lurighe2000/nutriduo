import { describe, expect, it } from "vitest";
import { decodeRoute } from "./runTracker";
import {
  guessKind,
  importRunFiles,
  kindFromText,
  parseAdidasSession,
  readZip,
  trackStats,
} from "./runImport";

const t0 = Date.parse("2026-10-12T10:00:00Z");
// 2.2 km straight north at 3 m/s, one point every 10 s.
const gpsPoints = Array.from({ length: 74 }, (_, i) => ({
  latitude: -34.5717 + (i * 30) / 111_195,
  longitude: -58.4176,
  altitude: 10 + (i > 40 ? 8 : 0),
  timestamp: new Date(t0 + i * 10_000).toISOString(),
}));

/** Builds an uncompressed zip in memory. */
function storedZip(files: Record<string, string>) {
  const enc = new TextEncoder();
  const parts: Uint8Array<ArrayBuffer>[] = [];
  const central: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const n = enc.encode(name);
    const body = enc.encode(text);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint32(18, body.length, true);
    local.setUint32(22, body.length, true);
    local.setUint16(26, n.length, true);
    parts.push(new Uint8Array(local.buffer), n, body);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true);
    c.setUint32(20, body.length, true);
    c.setUint32(24, body.length, true);
    c.setUint16(28, n.length, true);
    c.setUint32(42, offset, true);
    central.push(new Uint8Array(c.buffer), n);
    offset += 30 + n.length + body.length;
  }
  const size = central.reduce((a, b) => a + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, Object.keys(files).length, true);
  end.setUint16(10, Object.keys(files).length, true);
  end.setUint32(12, size, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, new Uint8Array(end.buffer)]);
}

describe("importar salidas", () => {
  it("lee una sesión de adidas Running con su GPS", () => {
    const run = parseAdidasSession(
      JSON.stringify({
        start_time: t0,
        end_time: t0 + 730_000,
        duration: 730_000,
        distance: 2190,
        calories: 160,
        sport_type_id: "1",
        pulse_avg: 151,
      }),
      JSON.stringify(gpsPoints),
    )!;
    expect(run.kind).toBe("Carrera");
    expect(run.distanceKm).toBe(2.19);
    expect(run.durationSeconds).toBe(730);
    expect(run.calories).toBe(160);
    expect(run.heartRate).toBe(151);
    expect(run.splits).toHaveLength(2);
    expect(decodeRoute(run.route!)[0].length).toBeGreaterThan(50);
  });

  it("descarta bicicleta y datos rotos", () => {
    expect(
      parseAdidasSession(
        JSON.stringify({
          start_time: t0,
          duration: 600000,
          distance: 5000,
          sport_type_id: "3",
        }),
      ),
    ).toBe(null);
    expect(parseAdidasSession("{nope")).toBe(null);
    expect(kindFromText("Ciclismo")).toBe(null);
    expect(kindFromText("running")).toBe("Carrera");
    expect(guessKind(10 * 60)).toBe("Caminata");
  });

  it("calcula parciales y desnivel desde los puntos", () => {
    const stats = trackStats(
      gpsPoints.map((p) => ({
        lat: p.latitude,
        lng: p.longitude,
        ele: p.altitude,
        time: Date.parse(p.timestamp),
      })),
    );
    expect(Math.round(stats.meters)).toBeGreaterThan(2150);
    expect(stats.splits).toHaveLength(2);
    expect(stats.gain).toBe(8);
    expect(stats.maxSpeed).toBeGreaterThan(10);
  });

  it("abre el .zip de la exportación y une cada sesión con su GPS", async () => {
    const zip = storedZip({
      "Sport-sessions/abc.json": JSON.stringify({
        start_time: t0,
        duration: 730000,
        distance: 2190,
        sport_type_id: "1",
      }),
      "Sport-sessions/GPS-data/abc.json": JSON.stringify(gpsPoints),
      "Sport-sessions/bike.json": JSON.stringify({
        start_time: t0,
        duration: 600000,
        distance: 9000,
        sport_type_id: "3",
      }),
      "Profile/user.json": "{}",
    });
    expect(await readZip(await zip.arrayBuffer())).toHaveLength(4);
    const file = new File([zip], "export.zip");
    const result = await importRunFiles([file]);
    expect(result.runs).toHaveLength(1);
    expect(result.skipped).toBe(1);
    expect(result.runs[0].route).toBeTruthy();
  });
});
