import { describe, expect, it } from "vitest";
import {
  RunSession,
  decodeRoute,
  distance,
  encodeRoute,
  formatClock,
  formatKm,
  formatPace,
  routeSegments,
} from "./runTracker";

const start = { lat: -34.5717, lng: -58.4176 };
// Meters to degrees of latitude.
const north = (meters: number) => meters / 111_195;

function run(
  session: RunSession,
  from: number,
  seconds: number,
  metersPerSecond: number,
  t0: number,
) {
  for (let s = 1; s <= seconds; s++) {
    const now = t0 + s * 1000;
    session.addFix({
      lat: start.lat + north(from + s * metersPerSecond),
      lng: start.lng,
      accuracy: 5,
      time: now,
    });
    session.tick(now);
  }
  return t0 + seconds * 1000;
}

describe("salidas con GPS", () => {
  it("mide distancia, ritmo y parciales de un trote parejo", () => {
    const t0 = 1_000_000;
    const session = new RunSession("Carrera", t0);
    session.addFix({ ...start, accuracy: 6, time: t0 });
    // 1.2 km at 3 m/s (5:33 /km).
    run(session, 0, 400, 3, t0);
    expect(session.distance).toBeGreaterThan(1170);
    expect(session.distance).toBeLessThan(1210);
    expect(session.splits).toHaveLength(1);
    expect(session.splits[0]).toBeGreaterThan(320);
    expect(session.splits[0]).toBeLessThan(345);
    expect(session.averagePace()!).toBeGreaterThan(320);
    expect(session.averagePace()!).toBeLessThan(345);
    expect(session.currentPace()!).toBeGreaterThan(320);
    expect(session.maxSpeed).toBeGreaterThan(10);
    expect(session.maxSpeed).toBeLessThan(12);
  });

  it("ignora fixes imprecisos, saltos imposibles y el temblor parado", () => {
    const t0 = 2_000_000;
    const session = new RunSession("Carrera", t0);
    session.addFix({ ...start, accuracy: 5, time: t0 });
    expect(
      session.addFix({
        ...start,
        lat: start.lat + north(30),
        accuracy: 60,
        time: t0 + 1000,
      }),
    ).toBe(false);
    expect(
      session.addFix({
        ...start,
        lat: start.lat + north(400),
        accuracy: 5,
        time: t0 + 2000,
      }),
    ).toBe(false);
    for (let s = 3; s < 30; s++) {
      session.addFix({
        ...start,
        lat: start.lat + north(s % 2 ? 1.5 : -1.5),
        accuracy: 5,
        time: t0 + s * 1000,
      });
      session.tick(t0 + s * 1000);
    }
    expect(session.distance).toBe(0);
  });

  it("se pausa sola al frenar y no cuenta el salto después de una pausa", () => {
    const t0 = 3_000_000;
    const session = new RunSession("Carrera", t0);
    session.addFix({ ...start, accuracy: 5, time: t0 });
    let now = run(session, 0, 60, 3, t0);
    for (let s = 1; s <= 30; s++) session.tick(now + s * 1000);
    expect(session.autoPaused).toBe(true);
    expect(session.seconds).toBeLessThan(62);
    now += 30_000;
    session.pause(now);
    session.resume(now + 1000);
    const before = session.distance;
    session.addFix({
      ...start,
      lat: start.lat + north(800),
      accuracy: 5,
      time: now + 2000,
    });
    expect(session.distance).toBe(before);
    expect(session.points.at(-1)!.seg).toBe(1);
  });

  it("guarda el recorrido comprimido y lo recupera", () => {
    const t0 = 4_000_000;
    const session = new RunSession("Caminata", t0);
    session.addFix({ ...start, accuracy: 5, time: t0 });
    run(session, 0, 120, 1.4, t0);
    const segments = routeSegments(session.points);
    const decoded = decodeRoute(encodeRoute(segments));
    expect(decoded).toHaveLength(1);
    expect(decoded[0]).toHaveLength(segments[0].length);
    expect(
      distance(
        { lat: decoded[0][5][0], lng: decoded[0][5][1] },
        { lat: segments[0][5][0], lng: segments[0][5][1] },
      ),
    ).toBeLessThan(2);
  });

  it("formatea como en la app", () => {
    expect(formatPace(355)).toBe("5:55");
    expect(formatPace(undefined)).toBe("–:––");
    expect(formatClock(1781)).toBe("29:41");
    expect(formatClock(3725)).toBe("1:02:05");
    expect(formatKm(5029)).toBe("5,02");
  });
});
