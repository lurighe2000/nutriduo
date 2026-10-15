// GPS run tracking: pure logic, no browser APIs, so it can be unit-tested.

export type RunKind = "Carrera" | "Caminata y trote" | "Caminata";

export interface Fix {
  lat: number;
  lng: number;
  accuracy: number;
  time: number;
  altitude?: number | null;
  altitudeAccuracy?: number | null;
}

export interface TrackPoint {
  lat: number;
  lng: number;
  time: number;
  /** Cumulative distance in meters when this point was recorded. */
  dist: number;
  /** Segment number: a new one starts after every manual pause. */
  seg: number;
}

type LatLng = { lat: number; lng: number };

const EARTH_RADIUS = 6371008.8;
const FIRST_FIX_ACCURACY = 40;
const FIX_ACCURACY = 25;
const AUTO_PAUSE_MS = 10_000;
const MAX_SPEED: Record<RunKind, number> = {
  Caminata: 4,
  "Caminata y trote": 7,
  Carrera: 10,
};
const KCAL_PER_KG_KM: Record<RunKind, number> = {
  Caminata: 0.6,
  "Caminata y trote": 0.85,
  Carrera: 1,
};

export function distance(a: LatLng, b: LatLng) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Small Kalman filter for lat/lng; the measurement noise is the GPS accuracy. */
class Smoother {
  variance = -1;
  lat = 0;
  lng = 0;
  time = 0;
  private readonly metersPerSecond: number;
  constructor(metersPerSecond: number) {
    this.metersPerSecond = metersPerSecond;
  }
  process(fix: Fix): LatLng {
    const accuracy = Math.max(fix.accuracy, 1);
    if (this.variance < 0) {
      this.lat = fix.lat;
      this.lng = fix.lng;
      this.time = fix.time;
      this.variance = accuracy * accuracy;
      return { lat: fix.lat, lng: fix.lng };
    }
    const dt = (fix.time - this.time) / 1000;
    if (dt > 0) {
      this.variance += dt * this.metersPerSecond * this.metersPerSecond;
      this.time = fix.time;
    }
    const gain = this.variance / (this.variance + accuracy * accuracy);
    this.lat += gain * (fix.lat - this.lat);
    this.lng += gain * (fix.lng - this.lng);
    this.variance *= 1 - gain;
    return { lat: this.lat, lng: this.lng };
  }
}

export interface RunSnapshot {
  kind: RunKind;
  startedAt: number;
  points: TrackPoint[];
  distance: number;
  movingMs: number;
  elevationGain: number;
  splits: number[];
  maxSpeed: number;
  paused: boolean;
  savedAt: number;
}

export class RunSession {
  readonly kind: RunKind;
  readonly startedAt: number;
  points: TrackPoint[] = [];
  distance = 0;
  movingMs = 0;
  elevationGain = 0;
  /** Seconds taken by each full kilometer. */
  splits: number[] = [];
  /** Fastest sustained speed, km/h. */
  maxSpeed = 0;
  paused = false;
  autoPaused = false;
  lastAccuracy?: number;
  private segment = 0;
  private newSegment = false;
  private lastTick: number;
  private lastMoveAt: number;
  private anchor?: LatLng & { time: number };
  private smoother: Smoother;
  private altitudeRef?: number;

  constructor(kind: RunKind, now: number) {
    this.kind = kind;
    this.startedAt = now;
    this.lastTick = now;
    this.lastMoveAt = now;
    this.smoother = new Smoother(kind === "Caminata" ? 2 : 4);
  }

  static restore(snapshot: RunSnapshot, now: number) {
    const session = new RunSession(snapshot.kind, snapshot.startedAt);
    session.points = snapshot.points;
    session.distance = snapshot.distance;
    session.movingMs = snapshot.movingMs;
    session.elevationGain = snapshot.elevationGain;
    session.splits = snapshot.splits;
    session.maxSpeed = snapshot.maxSpeed;
    session.paused = true;
    session.lastTick = now;
    session.lastMoveAt = now;
    session.segment = (snapshot.points.at(-1)?.seg ?? 0) + 1;
    return session;
  }

  snapshot(now: number): RunSnapshot {
    return {
      kind: this.kind,
      startedAt: this.startedAt,
      points: this.points,
      distance: this.distance,
      movingMs: this.movingMs,
      elevationGain: this.elevationGain,
      splits: this.splits,
      maxSpeed: this.maxSpeed,
      paused: this.paused,
      savedAt: now,
    };
  }

  get seconds() {
    return this.movingMs / 1000;
  }

  /** Advances the clock; call it about once per second. */
  tick(now: number) {
    if (!this.paused && !this.autoPaused) this.movingMs += now - this.lastTick;
    this.lastTick = now;
    if (
      !this.paused &&
      !this.autoPaused &&
      this.points.length > 0 &&
      now - this.lastMoveAt > AUTO_PAUSE_MS
    ) {
      // Standing still: stop the clock and give back the idle seconds.
      this.autoPaused = true;
      this.movingMs = Math.max(0, this.movingMs - (now - this.lastMoveAt));
    }
  }

  pause(now: number) {
    this.tick(now);
    this.paused = true;
  }

  resume(now: number) {
    this.paused = false;
    this.autoPaused = false;
    this.lastTick = now;
    this.lastMoveAt = now;
    this.newSegment = true;
    this.smoother = new Smoother(this.kind === "Caminata" ? 2 : 4);
  }

  /** Feeds one GPS fix. Returns true when it moved the runner forward. */
  addFix(fix: Fix): boolean {
    this.lastAccuracy = fix.accuracy;
    const limit = this.points.length ? FIX_ACCURACY : FIRST_FIX_ACCURACY;
    if (!(fix.accuracy <= limit) || this.paused) return false;
    if (this.anchor && !this.newSegment) {
      // Drop impossible jumps before they can pull the smoothed position.
      const seconds = (fix.time - this.anchor.time) / 1000;
      if (seconds <= 0) return false;
      const jump = distance(this.anchor, fix) - fix.accuracy;
      if (jump / seconds > MAX_SPEED[this.kind]) return false;
    }
    const smooth = this.smoother.process(fix);
    if (this.newSegment || !this.anchor) {
      // First point, or first one after a pause: the gap is not distance.
      if (this.newSegment) this.segment += 1;
      this.newSegment = false;
      this.anchor = { ...smooth, time: fix.time };
      this.points.push({
        ...smooth,
        time: fix.time,
        dist: this.distance,
        seg: this.segment,
      });
      return true;
    }
    const step = distance(this.anchor, smooth);
    const dt = (fix.time - this.anchor.time) / 1000;
    if (dt <= 0 || step / dt > MAX_SPEED[this.kind]) return false;
    if (step < Math.max(2, fix.accuracy * 0.5)) return false;
    if (this.autoPaused) {
      this.autoPaused = false;
      this.lastTick = fix.time;
    }
    this.lastMoveAt = fix.time;
    this.distance += step;
    this.anchor = { ...smooth, time: fix.time };
    this.points.push({
      ...smooth,
      time: fix.time,
      dist: this.distance,
      seg: this.segment,
    });
    this.trackSpeed();
    this.trackElevation(fix);
    while (this.distance >= (this.splits.length + 1) * 1000) {
      const done = this.splits.reduce((a, b) => a + b, 0);
      this.splits.push(Math.max(1, Math.round(this.seconds - done)));
    }
    return true;
  }

  private trackSpeed() {
    const last = this.points.at(-1)!;
    for (let i = this.points.length - 2; i >= 0; i--) {
      const p = this.points[i];
      if (p.seg !== last.seg) return;
      const dt = (last.time - p.time) / 1000;
      if (dt >= 5) {
        const kmh = ((last.dist - p.dist) / dt) * 3.6;
        if (kmh > this.maxSpeed) this.maxSpeed = kmh;
        return;
      }
    }
  }

  private trackElevation(fix: Fix) {
    if (
      fix.altitude == null ||
      fix.altitudeAccuracy == null ||
      fix.altitudeAccuracy > 15
    )
      return;
    if (this.altitudeRef === undefined) this.altitudeRef = fix.altitude;
    else if (fix.altitude - this.altitudeRef >= 3) {
      this.elevationGain += fix.altitude - this.altitudeRef;
      this.altitudeRef = fix.altitude;
    } else if (this.altitudeRef - fix.altitude >= 3)
      this.altitudeRef = fix.altitude;
  }

  /** Pace over the last ~200 m or 30 s, in seconds per km. */
  currentPace(): number | undefined {
    if (this.paused || this.autoPaused) return undefined;
    const last = this.points.at(-1);
    if (!last) return undefined;
    for (let i = this.points.length - 2; i >= 0; i--) {
      const p = this.points[i];
      if (p.seg !== last.seg) break;
      const meters = last.dist - p.dist;
      if (meters >= 200 || last.time - p.time >= 30_000)
        return meters < 20
          ? undefined
          : (last.time - p.time) / 1000 / (meters / 1000);
    }
    return undefined;
  }

  averagePace(): number | undefined {
    return this.distance >= 20
      ? this.seconds / (this.distance / 1000)
      : undefined;
  }
}

export function calories(kind: RunKind, km: number, weightKg = 70) {
  return Math.round(km * weightKg * KCAL_PER_KG_KM[kind]);
}

export function formatPace(secondsPerKm?: number) {
  if (!secondsPerKm || !Number.isFinite(secondsPerKm) || secondsPerKm > 3600)
    return "–:––";
  const s = Math.round(secondsPerKm);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function formatClock(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}

export function formatKm(meters: number) {
  return (Math.floor(meters / 10) / 100).toFixed(2).replace(".", ",");
}

/** Points per segment, without points closer than `minMeters` to the last kept one. */
export function routeSegments(points: TrackPoint[], minMeters = 5) {
  const segments: [number, number][][] = [];
  let current: [number, number][] = [];
  let seg = -1;
  let kept: LatLng | undefined;
  for (const p of points) {
    if (p.seg !== seg) {
      if (current.length) segments.push(current);
      current = [];
      seg = p.seg;
      kept = undefined;
    }
    if (!kept || distance(kept, p) >= minMeters) {
      current.push([p.lat, p.lng]);
      kept = p;
    }
  }
  if (current.length) segments.push(current);
  return segments;
}

function encodeNumber(value: number) {
  let v = value < 0 ? ~(value << 1) : value << 1;
  let out = "";
  while (v >= 0x20) {
    out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  return out + String.fromCharCode(v + 63);
}

/** Google encoded polyline (5 decimals); segments separated by spaces. */
export function encodeRoute(segments: [number, number][][]) {
  return segments
    .map((segment) => {
      let lat = 0;
      let lng = 0;
      return segment
        .map(([a, b]) => {
          const la = Math.round(a * 1e5);
          const lo = Math.round(b * 1e5);
          const chunk = encodeNumber(la - lat) + encodeNumber(lo - lng);
          lat = la;
          lng = lo;
          return chunk;
        })
        .join("");
    })
    .join(" ");
}

export function decodeRoute(route: string): [number, number][][] {
  return route
    .split(" ")
    .filter(Boolean)
    .map((text) => {
      const points: [number, number][] = [];
      let index = 0;
      let lat = 0;
      let lng = 0;
      const next = () => {
        let result = 0;
        let shift = 0;
        let byte: number;
        do {
          byte = text.charCodeAt(index++) - 63;
          result |= (byte & 0x1f) << shift;
          shift += 5;
        } while (byte >= 0x20 && index < text.length);
        return result & 1 ? ~(result >> 1) : result >> 1;
      };
      while (index < text.length) {
        lat += next();
        lng += next();
        points.push([lat / 1e5, lng / 1e5]);
      }
      return points;
    });
}
