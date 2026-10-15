// Imports runs exported from adidas Running (zip or JSON) or any GPX file.
import { distance, encodeRoute, type RunKind } from "./runTracker";

export interface ImportedRun {
  startedAt: number;
  kind: RunKind;
  distanceKm: number;
  durationSeconds: number;
  calories?: number;
  elevation?: number;
  maxSpeed?: number;
  heartRate?: number;
  heartRateMax?: number;
  splits?: number[];
  route?: string;
  source: string;
}

type Point = { lat: number; lng: number; time?: number; ele?: number };
type Known = Partial<Omit<ImportedRun, "kind" | "route" | "splits" | "source">>;

const num = (value: unknown) => {
  const n = typeof value === "string" && value.trim() ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
};
const time = (value: unknown) =>
  typeof value === "string" && !/^\d+$/.test(value)
    ? Date.parse(value) || undefined
    : num(value);

function encodeShort(points: Point[]) {
  for (const minMeters of [5, 10, 20, 40, 80]) {
    const kept: [number, number][] = [];
    let last: Point | undefined;
    for (const p of points)
      if (!last || distance(last, p) >= minMeters) {
        kept.push([p.lat, p.lng]);
        last = p;
      }
    const route = encodeRoute([kept]);
    if (route.length <= 80000) return route;
  }
  return undefined;
}

/** Distance, splits, elevation gain and max speed from timed points. */
export function trackStats(points: Point[]) {
  const along = [0];
  for (let i = 1; i < points.length; i++)
    along.push(along[i - 1] + distance(points[i - 1], points[i]));
  const splits: number[] = [];
  let nextKm = 1000;
  let splitStart = points[0]?.time;
  let maxSpeed = 0;
  let gain = 0;
  let ref: number | undefined;
  let j = 0;
  for (let i = 1; i < points.length; i++) {
    const t = points[i].time;
    if (t !== undefined && splitStart !== undefined)
      while (along[i] >= nextKm) {
        splits.push(Math.max(1, Math.round((t - splitStart) / 1000)));
        splitStart = t;
        nextKm += 1000;
      }
    if (t !== undefined) {
      // Speed over a sliding window of at least 5 seconds.
      while (j < i - 1 && (points[j + 1].time ?? 0) <= t - 5000) j++;
      const tj = points[j].time;
      if (tj !== undefined && t - tj >= 5000)
        maxSpeed = Math.max(
          maxSpeed,
          ((along[i] - along[j]) / ((t - tj) / 1000)) * 3.6,
        );
    }
    const ele = points[i].ele;
    if (ele !== undefined) {
      if (ref === undefined) ref = ele;
      else if (ele - ref >= 3) {
        gain += ele - ref;
        ref = ele;
      } else if (ref - ele >= 3) ref = ele;
    }
  }
  return { meters: along.at(-1) ?? 0, splits, maxSpeed, gain };
}

export function guessKind(secondsPerKm: number): RunKind {
  if (secondsPerKm > 8.5 * 60) return "Caminata";
  if (secondsPerKm > 6.75 * 60) return "Caminata y trote";
  return "Carrera";
}

/** Run kind from a GPX type or name; null means "not a run or walk". */
export function kindFromText(text?: string | null): RunKind | null | undefined {
  if (!text) return undefined;
  const t = text.toLowerCase();
  if (/bik|cycl|cicl|bici|ride|swim|nata|ski|row/.test(t)) return null;
  if (/walk|camin|hik|sender|trek/.test(t)) return "Caminata";
  if (/run|corr|trail|jog|trote/.test(t)) return "Carrera";
  return undefined;
}

function build(
  points: Point[],
  known: Known,
  source: string,
  kind?: RunKind | null,
): ImportedRun | null {
  if (kind === null) return null;
  const stats = points.length > 1 ? trackStats(points) : undefined;
  const timed = points.filter((p) => p.time !== undefined);
  const startedAt = known.startedAt ?? timed[0]?.time;
  const km = known.distanceKm ?? (stats ? stats.meters / 1000 : 0);
  const seconds =
    known.durationSeconds ??
    (timed.length > 1 ? (timed.at(-1)!.time! - timed[0].time!) / 1000 : 0);
  if (
    !startedAt ||
    !(km >= 0.05) ||
    km > 200 ||
    !(seconds > 0) ||
    seconds > 86400
  )
    return null;
  const maxSpeed = known.maxSpeed ?? stats?.maxSpeed;
  return {
    startedAt,
    kind: kind ?? guessKind(seconds / km),
    distanceKm: Math.round(km * 100) / 100,
    durationSeconds: Math.round(seconds),
    calories:
      known.calories !== undefined ? Math.round(known.calories) : undefined,
    elevation:
      known.elevation !== undefined
        ? Math.round(known.elevation)
        : stats?.gain
          ? Math.round(stats.gain)
          : undefined,
    maxSpeed: maxSpeed
      ? Math.round(Math.min(99, maxSpeed) * 10) / 10
      : undefined,
    heartRate: known.heartRate ? Math.round(known.heartRate) : undefined,
    heartRateMax: known.heartRateMax
      ? Math.round(known.heartRateMax)
      : undefined,
    splits: stats?.splits.length ? stats.splits : undefined,
    route: points.length > 1 ? encodeShort(points) : undefined,
    source,
  };
}

function gpxPoints(text: string) {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) return undefined;
  const points: Point[] = [];
  const hr: number[] = [];
  const nodes = [
    ...Array.from(doc.getElementsByTagName("trkpt")),
    ...Array.from(doc.getElementsByTagName("rtept")),
  ];
  for (const node of nodes) {
    const lat = num(node.getAttribute("lat"));
    const lng = num(node.getAttribute("lon"));
    if (lat === undefined || lng === undefined) continue;
    const children = Array.from(node.getElementsByTagName("*"));
    const value = (tag: RegExp) =>
      children.find((e) => tag.test(e.localName))?.textContent ?? undefined;
    const bpm = num(value(/^hr$/));
    if (bpm) hr.push(bpm);
    points.push({
      lat,
      lng,
      ele: num(value(/^ele$/)),
      time: time(value(/^time$/)),
    });
  }
  const tag = (name: string) =>
    doc.getElementsByTagName(name)[0]?.textContent ?? undefined;
  return {
    points,
    heart: hr.length
      ? {
          heartRate: hr.reduce((a, b) => a + b, 0) / hr.length,
          heartRateMax: Math.max(...hr),
        }
      : {},
    kind: kindFromText(tag("type")) ?? kindFromText(tag("name")),
  };
}

export function parseGpx(text: string, source = "GPX"): ImportedRun | null {
  const gpx = gpxPoints(text);
  return gpx ? build(gpx.points, gpx.heart, source, gpx.kind) : null;
}

const ADIDAS_SPORT: Record<string, RunKind | null> = {
  "1": "Carrera",
  "2": "Caminata",
  "7": "Caminata",
  "19": "Caminata",
  "3": null,
  "4": null,
  "15": null,
  "22": null,
};

/** One adidas Running session (Sport-sessions/*.json) plus its GPS file when present. */
export function parseAdidasSession(
  text: string,
  gps?: string,
): ImportedRun | null {
  let s: Record<string, unknown>;
  try {
    s = JSON.parse(text);
  } catch {
    return null;
  }
  if (!s || typeof s !== "object") return null;
  const start = time(s.start_time);
  const end = time(s.end_time);
  const ms = (v?: number) => (v !== undefined && v > 86400 ? v / 1000 : v);
  let duration =
    ms(num(s.duration)) ?? (start && end ? (end - start) / 1000 : undefined);
  const pause = ms(num(s.pause_duration)) ?? 0;
  if (duration !== undefined && pause < duration && !num(s.duration))
    duration -= pause;
  const meters = num(s.distance);
  const sport = String(s.sport_type_id ?? s.sport_type ?? "");
  const kind =
    sport in ADIDAS_SPORT ? ADIDAS_SPORT[sport] : kindFromText(sport);
  let points: Point[] = [];
  let heart = {};
  const raw = gps?.trim();
  if (raw?.startsWith("<")) {
    const parsed = gpxPoints(raw);
    points = parsed?.points ?? [];
    heart = parsed?.heart ?? {};
  } else if (raw) {
    try {
      const list = JSON.parse(raw) as Record<string, unknown>[];
      if (Array.isArray(list))
        points = list.flatMap((p) => {
          const lat = num(p.latitude) ?? num(p.lat);
          const lng = num(p.longitude) ?? num(p.lng) ?? num(p.lon);
          return lat === undefined || lng === undefined
            ? []
            : [
                {
                  lat,
                  lng,
                  ele: num(p.altitude) ?? num(p.elevation),
                  time: time(p.timestamp ?? p.time),
                },
              ];
        });
    } catch {
      points = [];
    }
  }
  return build(
    points,
    {
      ...heart,
      startedAt: start,
      distanceKm: meters ? meters / 1000 : undefined,
      durationSeconds: duration,
      calories: num(s.calories),
      elevation: num(s.elevation_gain),
      maxSpeed: num(s.max_speed),
      ...(num(s.pulse_avg) ? { heartRate: num(s.pulse_avg) } : {}),
      ...(num(s.pulse_max) ? { heartRateMax: num(s.pulse_max) } : {}),
    },
    "adidas Running",
    kind,
  );
}

/** Minimal zip reader (stored and deflate) using the browser's DecompressionStream. */
export async function readZip(data: ArrayBuffer) {
  const view = new DataView(data);
  let end = -1;
  for (
    let i = data.byteLength - 22;
    i >= Math.max(0, data.byteLength - 66000);
    i--
  )
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  if (end < 0) throw new Error("No es un archivo .zip válido.");
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  const decoder = new TextDecoder();
  const entries: { name: string; text: () => Promise<string> }[] = [];
  for (let n = 0; n < count && offset + 46 <= data.byteLength; n++) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    const method = view.getUint16(offset + 10, true);
    const size = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extra = view.getUint16(offset + 30, true);
    const comment = view.getUint16(offset + 32, true);
    const local = view.getUint32(offset + 42, true);
    const name = decoder.decode(new Uint8Array(data, offset + 46, nameLength));
    offset += 46 + nameLength + extra + comment;
    if (name.endsWith("/")) continue;
    entries.push({
      name,
      text: async () => {
        const start =
          local +
          30 +
          view.getUint16(local + 26, true) +
          view.getUint16(local + 28, true);
        const bytes = new Uint8Array(data, start, size);
        if (method === 0) return decoder.decode(bytes);
        if (method !== 8) throw new Error("Compresión no soportada.");
        const stream = new Blob([bytes])
          .stream()
          .pipeThrough(new DecompressionStream("deflate-raw"));
        return new Response(stream).text();
      },
    });
  }
  return entries;
}

const baseName = (path: string) =>
  path
    .split("/")
    .pop()!
    .replace(/\.[^.]+$/, "");

/** Reads a mix of .zip, .gpx and session .json files and returns the runs found. */
export async function importRunFiles(files: File[]) {
  const runs: ImportedRun[] = [];
  let skipped = 0;
  const sessions: { name: string; text: () => Promise<string> }[] = [];
  const gps = new Map<string, () => Promise<string>>();
  const gpxFiles: { name: string; text: () => Promise<string> }[] = [];
  for (const file of files) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".zip")) {
      for (const entry of await readZip(await file.arrayBuffer())) {
        const name = entry.name.toLowerCase();
        if (/gps-data\/[^/]+\.(gpx|json)$/.test(name))
          gps.set(baseName(entry.name), entry.text);
        else if (/sport-sessions\/[^/]+\.json$/.test(name))
          sessions.push(entry);
        else if (name.endsWith(".gpx")) gpxFiles.push(entry);
      }
    } else if (lower.endsWith(".gpx"))
      gpxFiles.push({ name: file.name, text: () => file.text() });
    else if (lower.endsWith(".json"))
      sessions.push({ name: file.name, text: () => file.text() });
  }
  for (const session of sessions) {
    const id = baseName(session.name);
    const track = gps.get(id);
    gps.delete(id);
    const run = parseAdidasSession(
      await session.text(),
      track ? await track() : undefined,
    );
    if (run) runs.push(run);
    else skipped++;
  }
  for (const file of gpxFiles) {
    const run = parseGpx(await file.text());
    if (run) runs.push(run);
    else skipped++;
  }
  return { runs: runs.sort((a, b) => a.startedAt - b.startedAt), skipped };
}
